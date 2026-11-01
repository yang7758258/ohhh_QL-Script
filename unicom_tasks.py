# -*- coding: utf-8 -*-
# ---------------------------------------------------------------------------
#  项目名称：中国联通（全任务包装器）
#  脚本文件：unicom_tasks.py
#  更新说明：
#    2026-11-01  Mist  仓库整理：统一项目标识、清理隐私信息
# ---------------------------------------------------------------------------
"""
中国联通「全任务」包装器 —— 把 chinaUnicom.py 的 10 个模块接进主脚本

原脚本 chinaUnicom.py（v1.0.5，5800 行）依赖 token_online，
而主脚本 unicom_signin.js 拿到的是 ecs_token。两者关系：

    token_online --onLine()--> ecs_token

我们已经有 ecs_token 了，所以直接跳过 onLine，把 ecs_token 灌进去。
10 个模块里只有「联通阅读 / 联通爱听」额外需要 token_online，
阅读默认关闭，爱听有手机号兜底。

用法：
  python unicom_tasks.py --phones 18500000000 --cache .unicom_ck.json
  python unicom_tasks.py --phones ... --test      # 只查询资产，不执行任务

输出：stdout 最后一行 %%CU_JSON%%{...}，过程日志全走 stderr
"""
import argparse
import importlib.util
import io
import json
import os
import re
import sys
import time
import traceback

import warnings

warnings.filterwarnings("ignore")

_REAL_STDOUT = sys.stdout

# token / 敏感串脱敏（原脚本会把带 token 的 URL 打进异常信息）
_REDACT = [
    (re.compile(r"eyJ[A-Za-z0-9_\-]{16,}\}?"), "eyJ***REDACTED***"),
    (re.compile(r"(token=)[^&\s\)]+"), r"\1***REDACTED***"),
    (re.compile(r"(ecs_token=)[^;&\s\)]+"), r"\1***REDACTED***"),
]


class _Redactor(io.TextIOBase):
    def __init__(self, inner):
        self._inner = inner

    def write(self, s):
        for pat, rep in _REDACT:
            s = pat.sub(rep, s)
        try:
            self._inner.write(s)
            return len(s)
        except Exception:
            return len(s)

    def flush(self):
        try:
            self._inner.flush()
        except Exception:
            pass

    def isatty(self):
        return False

    @property
    def encoding(self):
        return getattr(self._inner, "encoding", "utf-8")


def _mask(phone):
    p = str(phone or "")
    return (p[:3] + "****" + p[-4:]) if len(p) == 11 else (p or "")


def _load_module(src_path):
    spec = importlib.util.spec_from_file_location("chinaUnicom_mod", src_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _harden_session(u):
    """禁用系统代理 + 跳过证书校验（包装类是 FailoverSession，内外两层都要改）"""
    targets = []
    try:
        s = u.session
        targets.append(s)
        for attr in ("_session", "session"):
            inner = getattr(s, attr, None)
            if inner is not None and inner is not s:
                targets.append(inner)
    except Exception:
        return
    for t in targets:
        try:
            t.trust_env = False
            t.verify = False
        except Exception:
            pass


def _inject_token(u, tok, phone):
    """把 ecs_token 灌进 UserService

    ★ 关键：不能只设 self.ecs_token，还必须写进 session 的 cookie jar。
      原脚本靠 onLine() 让服务端 Set-Cookie 把 ecs_token 塞进 session；
      我们跳过登录链，所以必须手动补，否则 openPlatLineNew 之类的
      「靠 cookie 认证」的接口会返回 200 登录页而不是 302 跳转，
      连带 天天领现金 / 权益超市 两个大模块整段失败。
    """
    u.ecs_token = tok
    u.mobile = phone
    if not u.account_mobile:
        u.account_mobile = phone
    u.valid = True
    try:
        u.session.cookies.set("ecs_token", tok)
    except Exception:
        pass
    try:
        # FailoverSession 是包装类，内层 session 也补一份
        inner = getattr(u.session, "_session", None)
        if inner is not None:
            inner.cookies.set("ecs_token", tok)
    except Exception:
        pass


def _load_tokens(cache_path):
    """从主脚本的 .unicom_ck.json 里取 {手机号: ecs_token}"""
    out = {}
    if not cache_path or not os.path.exists(cache_path):
        return out
    try:
        raw = open(cache_path, encoding="utf-8-sig").read()
        d = json.loads(raw) or {}
    except Exception:
        return out
    for k, v in d.items():
        if not isinstance(v, dict):
            continue
        mobile = str(v.get("mobile") or "")
        tok = str(v.get("token") or "")
        if not tok and str(k).startswith("eyJ"):
            tok = str(k)
        if mobile and tok and len(tok) > 100 and not tok.startswith("RkFL"):
            out[mobile] = tok
    return out


def _apply_patches(mod):
    """对原脚本打运行时补丁（不改源文件，原脚本升级后依然生效）

    补丁1：update_session_cookies 原版只同步 token_online / appId 两个 cookie，
          ecs_token 靠 onLine() 服务端 Set-Cookie 落地。我们跳过 onLine，
          所以必须让它每次都把 ecs_token 也同步进 cookie jar。
    补丁2：各 task 方法套一层 try，单模块异常不拖垮整个账号
          （原脚本 execute_daily_tasks 里的 try 只覆盖了部分路径）。
    """
    import functools

    # ---- 补丁1 ----
    _orig_usc = mod.UserService.update_session_cookies

    def usc_patched(self):
        _orig_usc(self)
        try:
            if getattr(self, "ecs_token", ""):
                self.session.cookies.set("ecs_token", self.ecs_token)
                inner = getattr(self.session, "_session", None)
                if inner is not None:
                    inner.cookies.set("ecs_token", self.ecs_token)
        except Exception:
            pass

    mod.UserService.update_session_cookies = usc_patched

    # ---- 补丁2：阅读专区不强制要求 token_online ----
    # 原版 woread_login() 开头有 `if not self.token_online: return False`，
    # 但实测沃阅读登录接口只传手机号就能成功（返回 32 位 token）。
    # 主脚本的登录链只产 ecs_token，永远没有 token_online，所以这句是硬伤。
    def woread_login_patched(self):
        import base64 as _b64
        import hashlib as _hl
        from datetime import datetime as _dt

        try:
            if not getattr(self, "woread_accesstoken", ""):
                if not self.woread_auth():
                    return False

            timestamp = _dt.now().strftime("%Y%m%d%H%M%S")
            phone_str = self.account_mobile or self.mobile or ""
            inner = {"phone": self.woread_encrypt(phone_str), "timestamp": timestamp}
            # 有 token_online 就带上（更稳），没有就纯手机号登录
            if getattr(self, "token_online", ""):
                inner["tokenOnline"] = self.woread_encrypt(self.token_online)
            sign = self.woread_encrypt(inner)

            headers = {
                "Content-Type": "application/json",
                "User-Agent": mod.COMMON_CONSTANTS["UA"],
                "accesstoken": self.woread_accesstoken,
            }
            res = self.session.post(
                "https://10010.woread.com.cn/ng_woread_service/rest/account/login",
                json={"sign": sign}, headers=headers, timeout=15).json()

            if res.get("code") == "0000":
                d = res.get("data") or {}
                self.woread_token = d.get("token")
                self.woread_userid = d.get("userid")
                self.woread_userindex = d.get("userindex")
                self.woread_verifycode = d.get("verifycode")
                if d.get("phone"):
                    self.mobile = d["phone"]
                mode = "手机号" if not getattr(self, "token_online", "") else "手机号+token_online"
                self.log(f"阅读专区: 登录成功（{mode}）")
                return True
            self.log(f"阅读专区登录失败: {res.get('message')}")
            return False
        except Exception as e:
            self.log(f"woread_login error: {e}")
            return False

    mod.UserService.woread_login = woread_login_patched

    # ---- 补丁3：各 task 方法套一层 try，单模块异常不拖垮整个账号 ----
    TASKS = [
        "sign_task_main", "ltzf_task", "ttlxj_task", "market_task",
        "woread_task", "aiting_task", "securityButlerTask",
        "ltyp_task", "wostore_cloud_task", "regional_task",
    ]
    for name in TASKS:
        orig = getattr(mod.UserService, name, None)
        if orig is None:
            continue

        def make(fn, label):
            @functools.wraps(fn)
            def wrapper(self, *a, **kw):
                try:
                    return fn(self, *a, **kw)
                except Exception as e:
                    self.log(f"⚠️ {label} 异常中断: {e}", notify=True)
                    return None
            return wrapper

        setattr(mod.UserService, name, make(orig, name))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--phones", default="", help="逗号分隔手机号")
    ap.add_argument("--cache", default="", help="主脚本的 .unicom_ck.json")
    ap.add_argument("--src", default="", help="chinaUnicom.py 路径")
    ap.add_argument("--test", action="store_true", help="只查询资产，不执行任务")
    ap.add_argument("--only", default="", help="只跑指定模块（逗号分隔 enable_ 键名）")
    ap.add_argument("--skip", default="", help="跳过指定模块（逗号分隔 enable_ 键名）")
    args = ap.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    src = args.src or os.environ.get("UNICOM_CU_SRC") or ""
    if not src or not os.path.exists(src):
        for cand in [
            os.path.join(here, "..", "主脚本", "chinaUnicom.py"),
            os.path.join(here, "chinaUnicom.py"),
            "/ql/data/scripts/chinaUnicom.py",
            "/ql/scripts/chinaUnicom.py",
        ]:
            if os.path.exists(cand):
                src = os.path.abspath(cand)
                break
    if not src or not os.path.exists(src):
        print("%%CU_JSON%%" + json.dumps(
            {"ok": False, "error": "找不到 chinaUnicom.py"}, ensure_ascii=False))
        return 1

    raw = args.phones or os.environ.get("chinaUnicomCookie", "")
    phones = [x.strip() for x in re.split(r"[,\n&]", raw) if x.strip()]
    if not phones:
        print("%%CU_JSON%%" + json.dumps(
            {"ok": False, "error": "未提供手机号"}, ensure_ascii=False))
        return 1

    tokens = _load_tokens(args.cache)

    # 环境变量必须在 exec_module 之前设好
    os.environ["chinaUnicomCookie"] = "&".join(phones)
    if args.test:
        os.environ["UNICOM_TEST_MODE"] = "query"
    else:
        os.environ.pop("UNICOM_TEST_MODE", None)
    os.environ.pop("UNICOM_PROXY_API", None)   # 本环境直连，不用代理

    sys.stdout = _Redactor(sys.stderr)
    try:
        mod = _load_module(src)
        _apply_patches(mod)

        # 模块开关：默认全开（阅读已用手机号登录兜底，不再依赖 token_online）
        gc = mod.globalConfig
        gc["enable_woread"] = os.environ.get("UNICOM_CU_WOREAD", "on") != "off"
        if args.only:
            keys = [k.strip() for k in args.only.split(",") if k.strip()]
            for k in list(gc.keys()):
                if k.startswith("enable_"):
                    gc[k] = k in keys
        for k in [x.strip() for x in (args.skip or "").split(",") if x.strip()]:
            if k in gc:
                gc[k] = False

        out = []
        for i, phone in enumerate(phones):
            t0 = time.time()
            rec = {
                "index": i + 1,
                "phone": _mask(phone),
                "login": False,
                "logs": [],
                "error": "",
                "seconds": 0,
            }
            u = None
            try:
                u = mod.UserService(i + 1, phone)
                _harden_session(u)

                # ★ 核心：跳过 onLine，直接注入 ecs_token
                tok = tokens.get(phone, "")
                if tok:
                    _inject_token(u, tok, phone)
                    rec["login"] = True
                    u.log("🔑 已注入 ecs_token，跳过 onLine 登录链")
                else:
                    rec["error"] = "没有可用的 ecs_token（主脚本未取到 token）"
                    u.log(f"❌ {rec['error']}", notify=True)

                if rec["login"]:
                    u.execute_daily_tasks(query_only=bool(args.test))
            except Exception as e:
                rec["error"] = f"执行异常: {e}"
                print(f"[包装器] 账号{i + 1} 异常: {e}", file=sys.stderr)
                traceback.print_exc(file=sys.stderr)
            rec["logs"] = [str(x) for x in (getattr(u, "notify_logs", []) or [])]
            rec["seconds"] = round(time.time() - t0, 1)
            out.append(rec)

        payload = {"ok": True, "test": bool(args.test), "accounts": out}
    except Exception as e:
        payload = {"ok": False, "error": f"{e}", "accounts": []}
        traceback.print_exc(file=sys.stderr)
    finally:
        sys.stdout = _REAL_STDOUT

    print("%%CU_JSON%%" + json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())