# -*- coding: utf-8 -*-
# ---------------------------------------------------------------------------
#  项目名称：中国联通（云盘活动 · 乘风破浪2026 包装器）
#  脚本文件：unicom_cmf.py
#  更新说明：
#    2026-11-07  Mist  仓库首发：把 lt_cmf2026.py 当模块加载，复用主脚本 ecs_token
# ---------------------------------------------------------------------------
"""
联通云盘「披荆斩棘2026（乘风破浪）」活动 —— 集成包装器

作用：把 lt_cmf2026.py（第三方原脚本，保持不改动）当模块加载，
     复用我们主脚本已经拿到的 ecs_token（写进 token 缓存），
     走它的「二级缓存登录」链路：ecs_token → getTicketByNative → userToken
     （只需 2 次请求，不碰 onLine，不触发密码风控）

用法：
  python unicom_cmf.py --phones 18500000000,17600000000
  python unicom_cmf.py --phones ... --test          # 只查询不执行
  python unicom_cmf.py --phones ... --src /path/to/lt_cmf2026.py

输出：
  stdout 最后一行  %%CMF_JSON%%{...}   供 JS 解析
  中间过程日志全部走 stderr（进青龙日志，便于排查）
"""
import argparse
import importlib.util
import io
import json
import os
import sys
import traceback

# ---- 先压制第三方库的 urllib3 噪音 ----
import warnings  # noqa: E402

warnings.filterwarnings("ignore")

_REAL_STDOUT = sys.stdout

# ---- token / 敏感串脱敏（原脚本会把带 token 的 URL 打进异常信息）----
import re  # noqa: E402

_REDACT_PATTERNS = [
    (re.compile(r"eyJ[A-Za-z0-9_\-]{16,}\}?"), "eyJ***REDACTED***"),
    (re.compile(r"(token=)[^&\s\)]+"), r"\1***REDACTED***"),
    (re.compile(r"(ticket=)[^&\s\)]+"), r"\1***REDACTED***"),
]


class _Redactor(io.TextIOBase):
    """把所有写stderr的文本做敏感串替换"""

    def __init__(self, inner):
        self._inner = inner
        self._buf = ""

    def write(self, s):
        s = self._buf + s
        self._buf = ""
        # 行内处理，避免长 token 被拆成两次 write
        for pat, rep in _REDACT_PATTERNS:
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


def _apply_patches(mod):
    """对原脚本打运行时补丁（不改动源文件，升级后依然生效）

    补丁1「选角延迟生效」：
        实测 moveFile2Person 返回 [200] 后，levelProgress 立刻查仍是 0，
        几秒后才变 1。原脚本选完马上复查 → 误判「第一关未通过」，
        后面打卡全部报 92000010。这里检测到刚选过角就轮询重试。

    补丁2「挂机值系统繁忙」：
        hangValue/userInfo 常返回 [90003507] 系统繁忙，属瞬时错误，重试即可。
    """
    import time as _time

    # ---- 补丁1a：标记「刚调过选角接口」 ----
    _orig_act_post = mod.CloudUser.act_post

    def act_post_patched(self, path, payload=None, extra=None):
        res = _orig_act_post(self, path, payload, extra)
        try:
            if "moveFile2Person" in str(path):
                self._cfm_did_select = True
        except Exception:
            pass
        return res

    mod.CloudUser.act_post = act_post_patched

    # ---- 补丁1b：levelProgress 在刚选角后轮询重试 ----
    _orig_level_progress = mod.CloudUser.level_progress

    def level_progress_patched(self):
        lv = _orig_level_progress(self)
        if lv >= 1:
            self._cfm_did_select = False
            return lv
        if not getattr(self, "_cfm_did_select", False):
            return lv
        for i in range(6):
            _time.sleep(3)
            lv = _orig_level_progress(self)
            if lv >= 1:
                self.log(f"⏳ 选角延迟生效 (第 {i + 1} 次重试后 maxPassLevel={lv})")
                self._cfm_did_select = False
                return lv
        return lv

    mod.CloudUser.level_progress = level_progress_patched

    # ---- 补丁2：挂机值瞬时错误重试 ----
    _orig_hang = mod.CloudUser.hang_user_info

    def hang_user_info_patched(self):
        res = _orig_hang(self)
        for i in range(3):
            if res:
                return res
            _time.sleep(3)
            res = _orig_hang(self)
            if res:
                self.log(f"⏳ 挂机值重试成功 (第 {i + 1} 次)")
                return res
        return res or {}

    mod.CloudUser.hang_user_info = hang_user_info_patched

    # ---- 补丁3：云盘 token 失效（多端互踢）自动重登重试 ----
    def _is_token_dead(res):
        if not isinstance(res, dict):
            return False
        meta = res.get("meta") or {}
        if str(meta.get("code") or "") == "92000014":
            return True
        msg = str(meta.get("message") or "") + str(res.get("message") or "")
        return "token已失效" in msg or "token失效" in msg

    def _wrap_relogin(orig):
        def fn(self, path, payload=None, extra=None):
            res = orig(self, path, payload, extra)
            if _is_token_dead(res) and getattr(self, "_cfm_relogin_n", 0) < 2:
                self._cfm_relogin_n = getattr(self, "_cfm_relogin_n", 0) + 1
                self.log(f"🔄 云盘token失效(多端互踢), 自动重登并重试 {path}")
                try:
                    self.userToken = ""
                    if self.cloud_login(quiet=True, ticket_attempts=3):
                        res = orig(self, path, payload, extra)
                except Exception as e:
                    self.log(f"⚠️ 重登失败: {e}")
            return res
        return fn

    mod.CloudUser.act_post = _wrap_relogin(mod.CloudUser.act_post)
    mod.CloudUser.act_get = _wrap_relogin(mod.CloudUser.act_get)


def _activity_ended(u):
    """活动是否已结束（截止时间过了 / 服务端回「活动已结束」）

    活动结束后所有接口都会报 92000232 / 90003601，
    逐条跑下去只会刷一屏失败日志，不如一开始就判定。
    """
    try:
        data = u.act_get("/activity/checkActivityStatus",
                         {"activityId": u_mod().YPHD_ACTIVITY_ID})
        result = (data or {}).get("result") or {}
        if isinstance(result, dict) and result.get("state") not in (1, "1", None):
            return True
    except Exception:
        pass
    return False


_MOD_REF = {}


def u_mod():
    return _MOD_REF["mod"]


def _harden_session(u):
    """关键：禁用系统代理 + 跳过证书校验（本机/容器环境必须）

    注意 FailoverSession 是包装类，真正的 requests.Session 在 _session 上，
    必须同时设置两边，否则 trust_env 打了外壳、内层仍读系统代理。
    """
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
            t.trust_env = False     # 不读 HTTP_PROXY/HTTPS_PROXY/NO_PROXY
            t.verify = False
            if not t.headers.get("User-Agent"):
                t.headers["User-Agent"] = (
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 "
                    "unicom{version:iphone_c@13.0100}"
                )
        except Exception:
            pass


def _mask(phone):
    p = str(phone or "")
    return (p[:3] + "****" + p[-4:]) if len(p) == 11 else (p or "")


def _load_module(src_path):
    """把 lt_cmf2026.py 作为模块加载（不执行其 main）"""
    spec = importlib.util.spec_from_file_location("lt_cmf2026_mod", src_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _norm_prize(p):
    if not isinstance(p, dict):
        return None
    name = str(p.get("奖品") or p.get("prizeName") or "").strip()
    if not name:
        return None
    return {
        "name": name,
        "code": str(p.get("兑换码") or ""),
        "time": str(p.get("时间") or ""),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--phones", default="", help="逗号分隔手机号")
    ap.add_argument("--src", default="", help="lt_cmf2026.py 路径")
    ap.add_argument("--cache", default="", help="token 缓存路径")
    ap.add_argument("--test", action="store_true", help="只查询不执行")
    args = ap.parse_args()

    # ---- 定位原脚本 ----
    here = os.path.dirname(os.path.abspath(__file__))
    src = args.src or os.environ.get("UNICOM_CMF_SRC") or os.path.join(here, "lt_cmf2026.py")
    if not os.path.exists(src):
        print("%%CMF_JSON%%" + json.dumps({"ok": False, "error": "找不到 lt_cmf2026.py: " + src}, ensure_ascii=False))
        return 1

    # ---- 手机号来源 ----
    raw = args.phones or os.environ.get("chinaUnicomCookie", "")
    phones = [x.strip() for x in raw.replace("\n", ",").replace("&", ",").split(",") if x.strip()]
    if not phones:
        print("%%CMF_JSON%%" + json.dumps({"ok": False, "error": "未提供手机号"}, ensure_ascii=False))
        return 1

    # ---- 环境变量（必须在 exec_module 之前设好，模块导入时读取）----
    os.environ["chinaUnicomCookie"] = "&".join(phones)
    # 缓存必须落在「本包装器所在目录」，否则原脚本默认用自己所在目录（通常是下载目录）
    cache_path = args.cache or os.path.join(here, "unicom_token_cache.json")
    os.environ["UNICOM_TOKEN_CACHE_PATH"] = cache_path
    os.environ.setdefault("UNICOM_PRIZE_CACHE_PATH",
                          os.path.join(here, "unicom_prize_cache.json"))
    if args.test:
        os.environ["UNICOM_TEST_MODE"] = "query"
    # 我们自己统一推送，禁用它的 pushplus
    os.environ.pop("PUSH_PLUS_TOKEN", None)

    # ---- 把模块日志导到 stderr，保持 stdout 干净（并做敏感串脱敏）----
    sys.stdout = _Redactor(sys.stderr)
    try:
        mod = _load_module(src)
        _MOD_REF["mod"] = mod
        _apply_patches(mod)
        users = []
        for i, p in enumerate(phones):
            u = mod.CloudUser(i + 1, p)
            _harden_session(u)
            users.append(u)
        try:
            mod.resolve_extra_config(users)
        except Exception:
            pass

        out = []
        activity_ended = False   # 一旦确认活动结束，后续账号不再登录，直接跳过
        for u in users:
            rec = {
                "index": u.index,
                "phone": _mask(u.mobile or u.account_mobile),
                "login": False,
                "checkin": "",
                "hangValue": "",
                "hangRank": "",
                "hangRegion": "",
                "prizes": [],
                "prizeRecords": [],
                "rows": [],
                "error": "",
                "ended": False,
            }
            if activity_ended:
                rec["ended"] = True
                print(f"[包装器] 账号{u.index} 活动已结束，跳过（不登录）", file=sys.stderr)
                out.append(rec)
                continue
            try:
                if not u.ensure_login():
                    rec["error"] = "登录失败"
                else:
                    rec["login"] = True
                    # ★ 先查活动状态：已结束就静默跳过，不要刷一堆失败日志
                    if _activity_ended(u):
                        rec["ended"] = True
                        rec["login"] = False
                        activity_ended = True
                        rec["error"] = ""
                        print(f"[包装器] 账号{u.index} 活动已结束，跳过", file=sys.stderr)
                        out.append(rec)
                        continue
                    try:
                        u.run_activity()
                    except Exception as e:
                        rec["error"] = f"活动异常: {e}"
                        print(f"[包装器] 账号{u.index} 活动异常: {e}", file=sys.stderr)
                        traceback.print_exc(file=sys.stderr)
            except Exception as e:
                rec["error"] = f"登录异常: {e}"
                traceback.print_exc(file=sys.stderr)

            rec["checkin"] = str(u.checkin_info or "")
            rec["hangValue"] = str(u.hang_value or "")
            rec["hangRank"] = str(u.hang_rank or "")
            rec["hangRegion"] = str(u.hang_region or "")
            rec["rows"] = [[str(a), str(b)] for a, b in (u.rows or [])]
            rec["prizes"] = [x for x in (_norm_prize(p) for p in (u.prizes or [])) if x]
            rec["prizeRecords"] = [x for x in (_norm_prize(p) for p in (u.prize_records or [])) if x]
            out.append(rec)

        payload = {"ok": True, "test": bool(args.test), "accounts": out}
    except Exception as e:
        payload = {"ok": False, "error": f"{e}", "accounts": []}
        traceback.print_exc(file=sys.stderr)
    finally:
        sys.stdout = _REAL_STDOUT

    print("%%CMF_JSON%%" + json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
