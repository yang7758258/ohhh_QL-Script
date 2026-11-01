#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
中国联通 App 账号密码全自动登录 —— 过腾讯点选验证码，拿 ecs_token

完整链路（全部实测跑通）：
  1. GET  onLine.htm                    预热 acw_tc（WAF cookie）
  2. POST login.htm（RSA 手机号+密码）  → code=ECS99999 + mobile(640 hex) + type=10
  3. 浏览器打开 loginRisk，注入 TCaptcha SDK（aid=195809716, type=embed）
  4. 抓取提示条(img_index=0) + 背景图(img_index=1)
  5. cap_solver 求解点击坐标（连通域 ∪ AntiCAP 候选 → 旋转不变 IoU 最优分配）
  6. Playwright 真实鼠标按序点击 → 点「确定」→ SDK 自己生成 collect/eks/pow 并验证
  7. 拿到 ticket / randstr
  8. POST validateTencentCaptcha（**明文 JSON，encrypt-key/scene-key 为空**）→ resultToken
  9. POST login.htm（带 resultToken）→ code=0 + ecs_token
 10. 失败自动刷新验证码重试

用法：
  python unicom_auto_login.py --password 'xxx'
  python unicom_auto_login.py --password 'xxx' --json
  python unicom_auto_login.py --password 'xxx' --show      # 显示浏览器窗口便于排查
  python unicom_auto_login.py --password 'xxx' --max-try 5
"""
import argparse
import base64
import gzip
import io
import json
import os
import random
import subprocess
import sys
import tempfile
import time
import uuid
import zlib

# ---------- 依赖自愈：容器重建后 pip 包会丢，这里自动补装 ----------
_PIP_PKGS = [("requests", "requests"), ("Crypto", "pycryptodome"),
             ("PIL", "pillow"), ("numpy", "numpy")]
_PIP_MIRROR = ("-i https://mirrors.aliyun.com/pypi/simple/ "
               "--trusted-host mirrors.aliyun.com")


def _ensure_deps():
    missing = []
    for mod, _ in _PIP_PKGS:
        try:
            __import__(mod)
        except Exception:
            missing.append(mod)
    if not missing:
        return
    print("[deps] 缺少 %s，尝试自动安装…" % ", ".join(missing), file=sys.stderr)
    names = [pkg for mod, pkg in _PIP_PKGS if mod in missing]
    cmd = "%s -m pip install --no-cache-dir %s %s" % (
        sys.executable, _PIP_MIRROR, " ".join(names))
    try:
        import subprocess as _sp
        r = _sp.run(cmd, shell=True, capture_output=True, timeout=600)
        if r.returncode != 0:
            print("[deps] 安装失败，请手动执行：pip3 install %s"
                  % " ".join(names), file=sys.stderr)
    except Exception as e:
        print("[deps] 安装异常：%s" % e, file=sys.stderr)


_ensure_deps()

import requests
from Crypto.Cipher import PKCS1_v1_5
from Crypto.PublicKey import RSA

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cap_solver import solve_captcha          # noqa: E402

requests.packages.urllib3.disable_warnings()
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ============================ 常量 ============================
LOGIN_HOST = "https://loginhl.10010.com"
LOGIN_URL = LOGIN_HOST + "/mobileService/login.htm"
WEB_HOST = LOGIN_HOST + "/login-web"

LOGIN_PUB = (
    "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDc+CZK9bBA9IU+gZUOc6FUGu7y"
    "O9WpTNB0PzmgFBh96Mg1WrovD1oqZ+eIF4LjvxKXGOdI79JRdve9NPhQo07+uqGQ"
    "gE4imwNnRx7PFtCRryiIEcUoavuNtuRVoBAm6qdB0SrctgaqGfLgKvZHOnwTjyNqj"
    "BUxzMeQlEC2czEMSwIDAQAB"
)
APPID = (
    "2c3ac32a43c90c71330643da26f4251e451f333630010de29551653c7af2395a"
    "20fd6b43c77b82a7cc57d2274cfd0ffeb61900741759303d33a60744ca961f04"
    "480708cc14c23046e2e8e031ff9108631f3c2e0620ab34f2669ad145791c2fec"
)
TCAPTCHA_AID = "195809716"
DEVICE_CODE = "D6A33F49-16BB-492E-A997-ABE0B51032D2"
UNIQUE_ID = "iosa9471c321a635b240db36fae8d55cc1db"
DEVICE_ID = "ca35d3a5ee79593d94254997cc8becd2536b4dd1967a0f9bf4e820131d99b2"
UA_APP = ("ChinaUnicom4.x/13.1 (com.chinaunicom.mobilebusiness; build:14; iOS 26.6.1) "
          "Alamofire/4.7.3 unicom{version:iphone_c@13.0100}")
UA_H5 = ("Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 "
         "(KHTML, like Gecko)  unicom{version:iphone_c@13.0100};ltst;OSVersion/26.6.1")

ANTICAP_BASE = os.environ.get("ANTICAP_URL", "http://110.41.61.128:6688")
ANTICAP_USER = os.environ.get("ANTICAP_USER", "admin")
ANTICAP_PASS = os.environ.get("ANTICAP_PASS", "")


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ============================ HTTP 工具 ============================
def decompress(resp):
    raw = resp.content
    for fn in (gzip.decompress, lambda b: zlib.decompress(b, -15)):
        try:
            return fn(raw).decode("utf-8", "replace")
        except Exception:
            pass
    return resp.text


def jload(resp):
    txt = decompress(resp)
    try:
        return json.loads(txt)
    except Exception:
        return {"_raw": txt[:400]}


def rsa_enc(plain: str) -> str:
    key = RSA.import_key(base64.b64decode(LOGIN_PUB))
    return base64.b64encode(PKCS1_v1_5.new(key).encrypt(plain.encode())).decode()


def rand6() -> str:
    return str(random.randint(100000, 999999))


class AntiCap:
    def __init__(self):
        self.s = requests.Session()
        self.s.trust_env = False
        self.s.verify = False
        self.ok = False

    def login(self):
        try:
            r = self.s.post(ANTICAP_BASE + "/api/login",
                            data={"username": ANTICAP_USER, "password": ANTICAP_PASS},
                            timeout=15)
            tok = r.json()["access_token"]
            self.s.headers["Authorization"] = "Bearer " + tok
            self.ok = True
            log("AntiCAP 打码服务已登录")
        except Exception as e:
            log(f"AntiCAP 不可用（降级为纯连通域检测）: {e}")
            self.ok = False
        return self.ok

    def detect_icons(self, img_bytes: bytes):
        if not self.ok:
            return []
        b64 = base64.b64encode(img_bytes).decode()
        r = self.s.post(ANTICAP_BASE + "/api/detection/icon",
                        json={"img_base64": b64}, timeout=60)
        return r.json().get("result", [])


# ============================ 联通登录 ============================
def make_session():
    s = requests.Session()
    s.trust_env = False
    s.verify = False
    s.headers.update({
        "User-Agent": UA_APP,
        "Accept-Encoding": "gzip;q=1.0, compress;q=0.5",
        "Accept": "*/*",
        "Accept-Language": "zh-Hans-CN;q=1.0",
    })
    return s


def warm_up(s):
    try:
        s.get(LOGIN_HOST + "/mobileService/onLine.htm", timeout=20)
    except Exception:
        pass
    for k, v in (("c_version", "iphone_c@13.0100"), ("channel", "GGPD"),
                 ("devicedId", DEVICE_CODE), ("city", "074|795")):
        s.cookies.set(k, v, domain="loginhl.10010.com")
    if not any(c.name == "PvSessionId" for c in s.cookies):
        s.cookies.set("PvSessionId", time.strftime("%Y%m%d%H%M%S") + DEVICE_CODE,
                      domain="loginhl.10010.com")


def post_login(s, mobile, password, result_token=None):
    body = {
        "voipToken": "citc-default-token-do-not-push", "deviceBrand": "iPhone",
        "deviceId": DEVICE_ID,
        "simOperator": "--,--,65535,65535,--@--,--,65535,65535,--", "netWay": "wifi",
        "deviceCode": DEVICE_CODE, "uniqueIdentifier": UNIQUE_ID, "deviceOS": "26.6.1",
        "latitude": "", "version": "iphone_c@13.0100", "pip": "192.168.10.15",
        "isFirstInstall": "0", "remark4": "", "keyVersion": "2", "longitude": "",
        "simCount": "1",
        "mobile": rsa_enc(mobile + rand6()),
        "isRemberPwd": "false", "appId": APPID,
        "reqtime": time.strftime("%Y-%m-%d %H:%M:%S"), "deviceModel": "iPhone17,1",
        "password": rsa_enc(password + rand6()),
    }
    if result_token:
        body["resultToken"] = result_token
    r = s.post(LOGIN_URL, data=body, timeout=25)
    return jload(r)


# ============================ Node 浏览器驱动 ============================
NODE_DRIVER = r"""
const { chromium } = require('playwright-core');
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const out = { ok: false, stage: 'init', attempts: [] };
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: cfg.chromePath,
      headless: cfg.headless,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled',
             '--disable-dev-shm-usage']
    });
    const ctx = await browser.newContext({
      viewport: { width: 402, height: 874 },
      userAgent: cfg.ua,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai'
    });
    const page = await ctx.newPage();
    await page.goto('https://img.client.10010.com/loginRisk/index.html',
                    { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 注入 SDK
    await page.evaluate(async (aid) => {
      window.__capResult = null;
      await new Promise((res, rej) => {
        if (window.TencentCaptcha) return res();
        const s = document.createElement('script');
        s.src = 'https://turing.captcha.qcloud.com/TCaptcha.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      let el = document.getElementById('tc');
      if (!el) {
        el = document.createElement('div');
        el.id = 'tc';
        el.style.cssText =
          'position:fixed;left:0;top:0;width:360px;height:420px;z-index:999999;background:#fff';
        document.body.appendChild(el);
      }
      window.__cap = new TencentCaptcha(el, aid, (r) => { window.__capResult = r; },
        { showHeader: false, userLanguage: 'zh-cn', type: 'embed', needFeedBack: false });
      window.__cap.show();
    }, cfg.aid);
    out.stage = 'sdk_ready';

    const getFrame = () => page.frames().find(f =>
      f.url().includes('drag_ele') || f.url().includes('tcaptcha'));

    const waitFrame = async (ms = 20000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        const f = getFrame();
        if (f) {
          const ready = await f.evaluate(
            () => !!(document.querySelector('.tc-bg-img') &&
                      document.querySelector('img[src*="img_index=0"]'))
          ).catch(() => false);
          if (ready) return f;
        }
        await sleep(400);
      }
      return null;
    };

    for (let attempt = 1; attempt <= cfg.maxTry; attempt++) {
      const rec = { attempt };
      try {
        const frame = await waitFrame();
        if (!frame) throw new Error('验证码 iframe 未就绪');

        // 取图片 URL
        const urls = await frame.evaluate(() => {
          const p = document.querySelector('img[src*="img_index=0"]');
          const bgDiv = document.querySelector('.tc-bg-img');
          const bgUrl = (getComputedStyle(bgDiv).backgroundImage || '')
                          .match(/url\("?([^")]+)"?\)/)?.[1];
          const r = bgDiv.getBoundingClientRect();
          return { prompt: p ? p.src : null, bg: bgUrl,
                   bgRect: { x: r.x, y: r.y, w: r.width, h: r.height } };
        });
        if (!urls.prompt || !urls.bg) throw new Error('未取到图片 URL');

        // 下载（Playwright 网络栈，自带 cookie，无跨域问题）
        const grab = async (u) => {
          const r = await page.request.get(u, { timeout: 30000 });
          return (await r.body()).toString('base64');
        };
        const pb64 = await grab(urls.prompt);
        const bb64 = await grab(urls.bg);
        const nat = async (b) => page.evaluate((x) => new Promise(res => {
          const im = new Image();
          im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
          im.onerror = () => res({ w: 0, h: 0 });
          im.src = 'data:image/jpeg;base64,' + x;
        }), b);
        const pnat = await nat(pb64);
        const bnat = await nat(bb64);

        fs.writeFileSync(cfg.promptFile, Buffer.from(pb64, 'base64'));
        fs.writeFileSync(cfg.bgFile, Buffer.from(bb64, 'base64'));
        fs.writeFileSync(cfg.readyFile, String(attempt));

        // 等 Python 求解
        const clicksFile = cfg.clicksFile + '.' + attempt;
        let clicks = null;
        const t0 = Date.now();
        while (Date.now() - t0 < 90000) {
          await sleep(400);
          if (fs.existsSync(clicksFile)) {
            const t = fs.readFileSync(clicksFile, 'utf8').trim();
            if (t) { clicks = JSON.parse(t); break; }
          }
        }
        if (!clicks || !clicks.length) throw new Error('未收到点击坐标');
        rec.clicks = clicks;

        // 真实点击
        const frameEl = await page.$('#tcaptcha_iframe_dy');
        if (!frameEl) throw new Error('无 iframe 元素');
        const box = await frameEl.boundingBox();
        const sx = urls.bgRect.w / bnat.w;
        const sy = urls.bgRect.h / bnat.h;

        for (const c of clicks) {
          const px = box.x + urls.bgRect.x + c.x * sx;
          const py = box.y + urls.bgRect.y + c.y * sy;
          await page.mouse.move(px - 45, py - 35);
          await sleep(120);
          await page.mouse.move(px, py, { steps: 10 });
          await sleep(160);
          await page.mouse.down();
          await sleep(80);
          await page.mouse.up();
          await sleep(550);
        }

        // 确定
        await sleep(700);
        const btn = await frame.evaluate(() => {
          const c = [...document.querySelectorAll('*')].filter(e =>
            (e.innerText || '').trim() === '确定' && e.children.length === 0);
          if (!c.length) return null;
          const r = c[0].getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        });
        if (!btn) throw new Error('未找到确定按钮');
        await page.mouse.move(box.x + btn.x + btn.w / 2, box.y + btn.y + btn.h / 2,
                              { steps: 6 });
        await sleep(200);
        await page.mouse.down();
        await sleep(90);
        await page.mouse.up();

        // 等回调
        let res = null;
        for (let i = 0; i < 40; i++) {
          await sleep(500);
          res = await page.evaluate(() => window.__capResult);
          if (res) break;
        }
        rec.result = res;
        if (res && res.ret === 0 && res.ticket) {
          out.result = res;
          out.ok = true;
          out.attempts.push(rec);
          break;
        }
        rec.frameText = await frame.evaluate(
          () => (document.body.innerText || '').slice(0, 160)).catch(() => '');
        out.attempts.push(rec);

        // 刷新验证码重试
        await page.evaluate(() => {
          window.__capResult = null;
          try { window.__cap.destroy(); } catch (e) {}
        });
        await page.evaluate(async (aid) => {
          let el = document.getElementById('tc');
          if (el) el.innerHTML = '';
          window.__cap = new TencentCaptcha(el, aid, (r) => { window.__capResult = r; },
            { showHeader: false, userLanguage: 'zh-cn', type: 'embed', needFeedBack: false });
          window.__cap.show();
        }, cfg.aid);
        await sleep(1500);
      } catch (e) {
        rec.error = String(e && e.message ? e.message : e);
        out.attempts.push(rec);
        await sleep(1200);
      }
    }
  } catch (e) {
    out.error = String(e && e.message ? e.message : e);
  } finally {
    fs.writeFileSync(cfg.outFile, JSON.stringify(out, null, 2));
    if (browser) await browser.close().catch(() => {});
  }
})();
"""


def find_chrome():
    """按平台找浏览器：Windows 用 Chrome，Linux/青龙用 chrome-headless-shell"""
    cands = [
        # Linux / 青龙（含 Qinglong 依赖管理装的 headless shell）
        "/ql/scripts/chrome/chrome-headless-shell-linux64/chrome-headless-shell",
        "/ql/data/scripts/chrome/chrome-headless-shell-linux64/chrome-headless-shell",
        "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium", "/usr/bin/chromium-browser",
        # 环境变量优先
        os.environ.get("CHROME_PATH") or "",
        # Windows
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    for p in cands:
        if p and os.path.exists(p):
            return p
    return None


def find_node_root():
    """找到装了 playwright-core 的目录，作为 node 的 cwd 与 NODE_PATH"""
    here = os.path.dirname(os.path.abspath(__file__))
    cands = [
        here,
        os.path.join(here, "unicom_auto"),
        os.path.join(here, "..", "unicom_work"),
        "/ql/data/scripts/unicom_auto",
        "/ql/data/scripts",
        "/ql/scripts",
        os.getcwd(),
    ]
    for k in ("NODE_PATH", "UNICOM_NODE_PATH"):
        for p in str(os.environ.get(k) or "").split(os.pathsep):
            p = p.strip()
            if p:
                cands.append(p)
                cands.append(os.path.dirname(p))

    for d in cands:
        try:
            d = os.path.abspath(d)
        except Exception:
            continue
        if os.path.isdir(os.path.join(d, "node_modules", "playwright-core")):
            return d
    return here


# ============================ 主流程 ============================
def login(mobile, password, headless=True, max_try=4):
    s = make_session()
    warm_up(s)

    log("① 密码登录，申请图形验证码")
    j = post_login(s, mobile, password)
    code = j.get("code")
    log(f"   code={code} dsc={j.get('dsc', '')}")

    if code == "0" and j.get("ecs_token"):
        log("   免验证码直接登录成功")
        return {"ok": True, "ecs_token": j["ecs_token"], "raw": j, "via": "direct"}

    if code != "ECS99999":
        return {"ok": False, "reason": f"code={code} dsc={j.get('dsc')}", "raw": j}

    mobile_hex = j.get("mobile") or ""
    log(f"   验证类型 type={j.get('type')} mobile密文={len(mobile_hex)} hex")
    if not mobile_hex:
        return {"ok": False, "reason": "未拿到 mobile 密文", "raw": j}

    # 打码服务
    anticap = AntiCap()
    anticap.login()

    tmp = tempfile.mkdtemp(prefix="unicom_login_")
    prompt_file = os.path.join(tmp, "prompt.jpg")
    bg_file = os.path.join(tmp, "bg.jpg")
    ready_file = os.path.join(tmp, "ready.txt")
    clicks_base = os.path.join(tmp, "clicks.json")
    out_file = os.path.join(tmp, "result.json")

    chrome = find_chrome()
    if not chrome:
        return {"ok": False, "reason": "未找到 Chrome/Chromium"}

    work = find_node_root()
    drv = os.path.join(tempfile.gettempdir(), "_cap_driver.js")
    open(drv, "w", encoding="utf-8").write(NODE_DRIVER)
    cfg_file = os.path.join(tempfile.gettempdir(), "_cap_cfg.json")
    json.dump({
        "chromePath": chrome, "headless": headless, "ua": UA_H5, "aid": TCAPTCHA_AID,
        "promptFile": prompt_file, "bgFile": bg_file, "readyFile": ready_file,
        "clicksFile": clicks_base, "outFile": out_file, "maxTry": max_try,
    }, open(cfg_file, "w", encoding="utf-8"), ensure_ascii=False)

    log(f"② 启动浏览器过验证码（最多 {max_try} 次）")
    nenv = dict(os.environ)
    nm = os.path.join(work, "node_modules")
    nenv["NODE_PATH"] = nm + (os.pathsep + nenv["NODE_PATH"]
                              if nenv.get("NODE_PATH") else "")
    proc = subprocess.Popen(["node", drv, cfg_file], cwd=work, env=nenv,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

    # 逐轮求解
    served = set()
    deadline = time.time() + 60 * max_try + 60
    while time.time() < deadline:
        time.sleep(0.8)
        # 浏览器已退出或已出结果 → 立即收工
        if proc.poll() is not None or os.path.exists(out_file):
            break
        if not os.path.exists(ready_file):
            continue
        try:
            attempt = int(open(ready_file, encoding="utf-8").read().strip())
        except Exception:
            continue
        if attempt in served:
            continue
        if not (os.path.exists(prompt_file) and os.path.exists(bg_file)):
            continue
        pb = open(prompt_file, "rb").read()
        bb = open(bg_file, "rb").read()
        if len(pb) < 500 or len(bb) < 5000:
            continue

        served.add(attempt)
        log(f"   第 {attempt} 次验证码求解")
        r = solve_captcha(pb, bb, anticap=anticap, verbose=True)
        if r["ok"] and r["clicks"]:
            open(clicks_base + f".{attempt}", "w", encoding="utf-8").write(
                json.dumps([{"x": c["x"], "y": c["y"]} for c in r["clicks"]]))
            log(f"   已下发坐标 conf={r['confidence']}")
        else:
            log(f"   求解失败: {r['reason']}，等浏览器刷新")
            if os.path.exists(ready_file):
                os.remove(ready_file)

    try:
        proc.wait(timeout=60)
    except Exception:
        proc.kill()

    res = json.load(open(out_file, encoding="utf-8")) if os.path.exists(out_file) else {}
    log(f"③ 浏览器结果 ok={res.get('ok')} err={res.get('error')}")

    cap = res.get("result") or {}
    ticket, randstr = cap.get("ticket"), cap.get("randstr")
    if not ticket:
        shutil_copy = os.path.join(work, "last_login_fail.json")
        try:
            json.dump(res, open(shutil_copy, "w", encoding="utf-8"),
                      ensure_ascii=False, indent=2)
        except Exception:
            pass
        return {"ok": False, "reason": "未拿到 ticket", "detail": res}

    log(f"   ticket={ticket[:28]}... randstr={randstr}")

    log("④ validateTencentCaptcha 换 resultToken")
    h5 = requests.Session()
    h5.trust_env = False
    h5.verify = False
    h5.headers.update({"User-Agent": UA_H5,
                       "Content-Type": "application/json",
                       "Origin": "https://img.client.10010.com",
                       "Referer": "https://img.client.10010.com/"})
    for c in s.cookies:
        try:
            h5.cookies.set(c.name, c.value, domain=c.domain)
        except Exception:
            pass

    payload = {"seq": str(uuid.uuid4()), "captchaType": "10", "mobile": mobile_hex,
               "ticket": ticket, "randStr": randstr, "imei": DEVICE_CODE}
    r = h5.post(WEB_HOST + "/v1/chartCaptcha/validateTencentCaptcha",
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers={"encrypt-key": "", "scene-key": ""}, timeout=25)
    jv = jload(r)
    log(f"   {json.dumps(jv, ensure_ascii=False)[:260]}")

    result_token = (jv.get("data") or {}).get("resultToken")
    if not result_token:
        return {"ok": False, "reason": f"validateTencentCaptcha 失败: {jv}"}

    log("⑤ 带 resultToken 重新登录")
    j2 = post_login(s, mobile, password, result_token=result_token)
    log(f"   code={j2.get('code')} dsc={j2.get('dsc', '')}")

    if j2.get("code") == "0" and j2.get("ecs_token"):
        log("✅ 登录成功")
        return {"ok": True, "ecs_token": j2["ecs_token"],
                "private_token": j2.get("private_token"),
                "token_online": j2.get("token_online"),
                "desmobile": j2.get("desmobile"), "via": "captcha", "raw": j2}

    return {"ok": False, "reason": f"最终登录失败 code={j2.get('code')}", "raw": j2}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mobile", default=os.environ.get("UNICOM_MOBILE", "18569788363"))
    ap.add_argument("--password", default=os.environ.get("UNICOM_PASSWORD", ""))
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--show", action="store_true")
    ap.add_argument("--max-try", type=int, default=4)
    a = ap.parse_args()

    if not a.password:
        print("请用 --password 或 UNICOM_PASSWORD 提供密码")
        sys.exit(2)

    res = login(a.mobile, a.password, headless=not a.show, max_try=a.max_try)

    if a.json:
        print(json.dumps({k: v for k, v in res.items() if k != "raw"},
                         ensure_ascii=False))
    elif res.get("ok"):
        print("\n" + "=" * 72)
        print("ecs_token =", res["ecs_token"])
        print("长度 =", len(res["ecs_token"]), " 方式 =", res.get("via"))
        print("=" * 72)
    else:
        print("\n失败:", res.get("reason"))

    sys.exit(0 if res.get("ok") else 1)


if __name__ == "__main__":
    main()