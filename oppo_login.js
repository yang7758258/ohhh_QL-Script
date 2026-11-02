/* -------------------------------------------------------------------------
 *  项目名称：OPPO 商城（账号密码登录 / 取 CK 核心）
 *  脚本文件：oppo_login.js
 *  更新说明：
 *    2026-11-02  Mist  仓库整理：统一项目标识、清理隐私信息
 * -------------------------------------------------------------------------
 */
'use strict';
/**
 * OPPO 商城 账号密码登录器（浏览器驱动）
 * ============================================================================
 * 为什么必须用浏览器：
 *   UC 账号中心的 /identity/v1/authn/check 需要请求头 x-euler-const，
 *   那是网易易盾的静默风控 token，由页面里的 SDK 实时生成，
 *   不跑真实浏览器就无法合成。密码本身是明文 POST 的，
 *   卡人的从来不是加密，而是这道风控。
 *
 * 为什么必须用「原生 Chrome + --remote-debugging-port」：
 *   Playwright / Puppeteer 默认会带 --enable-automation，
 *   此时 navigator.webdriver === true，风控直接返回 11208「账号登录环境存在风险」。
 *   原生 Chrome 用 --disable-blink-features=AutomationControlled 启动后
 *   navigator.webdriver 是 false（而且是 data property，不是 getter），
 *   风控认可，登录通过。
 *   —— 千万不要再往页面里注入 navigator.webdriver 的伪造 getter，
 *      那是画蛇添足，反而会被 SDK 的 getOwnPropertyDescriptor 校验识破。
 *
 * 登录产物：
 *   NEWOPPOSID  —— .opposhop.cn 域，有效期 1 天
 *   单这一个 cookie 就能读写 hd.opposhop.cn/api/cn/oapi/marketing/** 的全部接口
 *   （实测 queryMemberCreditInfo 返回 login:true，signIn 返回 5008 已签到）
 *
 * 二次验证：
 *   同一 IP 短时间内反复登录会触发「手机验证码验证」升级验证。
 *   本模块支持从 OPPO_SMS_CODE 环境变量 / OPPO_SMS_FILE 文件 / stdin 读取验证码。
 *   日常每天登录一次通常不会触发。
 *
 * 用法:
 *   node oppo_login.js                        # 只用缓存 profile 静默刷新
 *   node oppo_login.js <手机号> <密码>         # 需要时做完整密码登录
 *   node oppo_login.js <手机号> <密码> --json
 *
 * 环境变量:
 *   OPPO_PHONE / OPPO_PASSWORD   账号密码（等价于命令行参数）
 *   OPPO_BROWSER_PROFILE         浏览器 profile 目录（持久化，保住设备指纹）
 *   OPPO_CHROME                  Chrome 可执行文件路径
 *   OPPO_HEADLESS                1=无头（默认）0=有头
 *   OPPO_DEBUG_PORT              CDP 端口，默认 9333
 *   OPPO_SMS_CODE                短信验证码
 *   OPPO_SMS_FILE                短信验证码文件（脚本轮询）
 *
 * 输出: stdout 最后一行 NEWOPPOSID=<值>
 * ============================================================================
 */
const http = require('http');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
//  一、极简 WebSocket 客户端（RFC6455 文本帧，零依赖）
//      Node 20 没有全局 WebSocket，而 CDP 只走 ws://
// ============================================================================
class WS extends EventEmitter {
    constructor(url) {
        super();
        const u = new URL(url);
        const key = crypto.randomBytes(16).toString('base64');
        this.sock = net.connect({ host: u.hostname, port: Number(u.port || 80) }, () => {
            this.sock.write(
                'GET ' + (u.pathname + (u.search || '')) + ' HTTP/1.1\r\n' +
                'Host: ' + u.host + '\r\n' +
                'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
                'Sec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n'
            );
        });
        this.buf = Buffer.alloc(0);
        this.open = false;
        this.frag = [];
        this.sock.on('data', (d) => this._data(d));
        this.sock.on('error', (e) => this.emit('error', e));
        this.sock.on('close', () => this.emit('close'));
    }
    _data(d) {
        this.buf = Buffer.concat([this.buf, d]);
        if (!this.open) {
            const i = this.buf.indexOf('\r\n\r\n');
            if (i < 0) return;
            const head = this.buf.slice(0, i).toString();
            if (!/101/.test(head.split('\r\n')[0])) {
                this.emit('error', new Error('WS 握手失败: ' + head.split('\r\n')[0]));
                return;
            }
            this.open = true;
            this.buf = this.buf.slice(i + 4);
            this.emit('open');
        }
        while (this.buf.length >= 2) {
            const b0 = this.buf[0], b1 = this.buf[1];
            const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f;
            const masked = (b1 & 0x80) !== 0;
            let len = b1 & 0x7f, off = 2;
            if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
            else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
            let maskKey = null;
            if (masked) { if (this.buf.length < off + 4) return; maskKey = this.buf.slice(off, off + 4); off += 4; }
            if (this.buf.length < off + len) return;
            let payload = this.buf.slice(off, off + len);
            this.buf = this.buf.slice(off + len);
            if (maskKey) { payload = Buffer.from(payload); for (let k = 0; k < payload.length; k++) payload[k] ^= maskKey[k & 3]; }
            if (op === 0x8) { this.emit('close'); try { this.sock.end(); } catch (e) { /* ignore */ } return; }
            if (op === 0x9) { this._frame(payload, 0xa); continue; }
            if (op === 0xa) continue;
            if (op === 0x0) { this.frag.push(payload); if (fin) { const all = Buffer.concat(this.frag); this.frag = []; this.emit('message', all.toString('utf8')); } continue; }
            if (op === 0x1 || op === 0x2) {
                if (!fin) { this.frag = [payload]; continue; }
                this.emit('message', payload.toString('utf8'));
            }
        }
    }
    _frame(payload, op) {
        const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
        const len = data.length;
        const mask = crypto.randomBytes(4);
        let head;
        if (len < 126) { head = Buffer.alloc(6); head[0] = 0x80 | op; head[1] = 0x80 | len; mask.copy(head, 2); }
        else if (len < 65536) { head = Buffer.alloc(8); head[0] = 0x80 | op; head[1] = 0x80 | 126; head.writeUInt16BE(len, 2); mask.copy(head, 4); }
        else { head = Buffer.alloc(14); head[0] = 0x80 | op; head[1] = 0x80 | 127; head.writeBigUInt64BE(BigInt(len), 2); mask.copy(head, 10); }
        const masked = Buffer.from(data);
        for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i & 3];
        this.sock.write(Buffer.concat([head, masked]));
    }
    send(s) { this._frame(s, 0x1); }
    close() { try { this.sock.end(); } catch (e) { /* ignore */ } }
}

// ============================================================================
//  二、Chrome 定位与启动
// ============================================================================
const CHROME_CANDIDATES = [
    process.env.OPPO_CHROME,
    process.env.YZ_CHROME,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/ql/scripts/chrome/chrome-headless-shell-linux64/chrome-headless-shell',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
].filter(Boolean);

function findChrome() {
    for (const p of CHROME_CANDIDATES) {
        try { if (p && fs.existsSync(p)) return p; } catch (e) { /* ignore */ }
    }
    return null;
}

function httpJson(port, p) {
    return new Promise((resolve, reject) => {
        const r = http.request({ host: '127.0.0.1', port, path: p, method: 'GET' }, (x) => {
            const cs = [];
            x.on('data', (c) => cs.push(c));
            x.on('end', () => { try { resolve(JSON.parse(Buffer.concat(cs).toString())); } catch (e) { reject(e); } });
        });
        r.on('error', reject);
        r.setTimeout(3000, () => r.destroy(new Error('timeout')));
        r.end();
    });
}

// ============================================================================
//  三、CDP 客户端
// ============================================================================
class CDP {
    constructor(ws) {
        this.ws = ws;
        this.id = 0;
        this.wait = new Map();
        this.subs = [];
        ws.on('message', (d) => this._on(d));
    }
    static async attach(port) {
        const list = await httpJson(port, '/json/list');
        const t = list.find((x) => x.type === 'page') || list[0];
        if (!t) throw new Error('浏览器里没有可用的标签页');
        const ws = new WS(t.webSocketDebuggerUrl);
        await new Promise((res, rej) => {
            ws.on('open', res);
            ws.on('error', rej);
        });
        return new CDP(ws);
    }
    _on(raw) {
        let m;
        try { m = JSON.parse(raw); } catch (e) { return; }
        if (m.id && this.wait.has(m.id)) {
            const w = this.wait.get(m.id);
            this.wait.delete(m.id);
            m.error ? w.rej(new Error(JSON.stringify(m.error))) : w.res(m.result);
        } else if (m.method) {
            this.subs.forEach((f) => { try { f(m); } catch (e) { /* ignore */ } });
        }
    }
    send(method, params) {
        const id = ++this.id;
        return new Promise((res, rej) => {
            this.wait.set(id, { res, rej });
            this.ws.send(JSON.stringify({ id, method, params: params || {} }));
            setTimeout(() => {
                if (this.wait.has(id)) { this.wait.delete(id); rej(new Error('CDP 超时: ' + method)); }
            }, 40000);
        });
    }
    on(f) { this.subs.push(f); }
    async eval(expr) {
        const r = await this.send('Runtime.evaluate', {
            expression: expr, returnByValue: true, awaitPromise: true, userGesture: true,
        });
        if (r.exceptionDetails) throw new Error('页面 JS 异常: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
        return r.result && r.result.value;
    }
    close() { try { this.ws.close(); } catch (e) { /* ignore */ } }
}

async function launchChrome(port, profileDir, headless) {
    try { await httpJson(port, '/json/version'); return null; } catch (e) { /* 没起 */ }
    const exe = findChrome();
    if (!exe) throw new Error('未找到 Chrome，请设置 OPPO_CHROME 指向浏览器可执行文件');
    fs.mkdirSync(profileDir, { recursive: true });

    const args = [
        '--remote-debugging-port=' + port,
        '--user-data-dir=' + profileDir,
        '--no-first-run',
        '--no-default-browser-check',
        // 关键：让 navigator.webdriver 直接为 false，而不是伪造 getter
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1440,900',
        '--lang=zh-CN',
        'about:blank',
    ];
    // chrome-headless-shell 本身就是无头版，再加 --headless=new 会报错
    const isShell = /headless-shell/i.test(exe);
    if (headless && !isShell) args.unshift('--headless=new', '--disable-gpu');

    const child = spawn(exe, args, { detached: true, stdio: 'ignore' });
    child.unref();

    for (let i = 0; i < 80; i++) {
        await sleep(500);
        try { await httpJson(port, '/json/version'); return child; } catch (e) { /* 等 */ }
    }
    throw new Error('Chrome 启动超时（端口 ' + port + '）');
}

// ============================================================================
//  四、页面操作片段
// ============================================================================
const HOME = 'https://www.opposhop.cn/';

// 点首页右上角的「登录」，让前端自己生成 state 再跳转登录页。
// 直接拼 id.oppo.com/v3/auth/login?callback=... 会缺 state，卡在「正在登录」。
const CLICK_ENTRY = '(() => {\n' +
    '  if (/^id\\.(oppo|heytap)\\.com$/.test(location.hostname)) return "ON_LOGIN_PAGE";\n' +
    '  const els = Array.from(document.querySelectorAll("a, span, div, button"));\n' +
    '  const b = els.filter((e) => (e.innerText || "").trim() === "登录" && e.offsetParent !== null);\n' +
    '  if (!b.length) return "NO_ENTRY";\n' +
    '  b[0].click();\n' +
    '  return "CLICKED";\n' +
    '})()';

const HAS_PHONE_INPUT = '(() => {\n' +
    '  const vs = Array.from(document.querySelectorAll(\'input[type="tel"], input[type="password"]\'))\n' +
    '    .filter((e) => e.offsetParent !== null);\n' +
    '  return vs.length >= 2 ? "YES" : "NO";\n' +
    '})()';

// 中英文页面共用：取「第一个可见的 tel 输入框」和「第一个可见的 password 输入框」
const FOCUS_PHONE = '(() => {\n' +
    '  const vs = Array.from(document.querySelectorAll(\'input[type="tel"]\')).filter((e) => e.offsetParent !== null);\n' +
    '  if (!vs.length) return "NO_EL";\n' +
    '  vs[0].focus(); vs[0].click();\n' +
    '  return "OK";\n' +
    '})()';

const FOCUS_PASSWORD = '(() => {\n' +
    '  const vs = Array.from(document.querySelectorAll(\'input[type="password"]\')).filter((e) => e.offsetParent !== null);\n' +
    '  if (!vs.length) return "NO_EL";\n' +
    '  vs[0].focus(); vs[0].click();\n' +
    '  return "OK";\n' +
    '})()';

const FOCUS_SMSCODE = '(() => {\n' +
    '  const vs = Array.from(document.querySelectorAll(\'input[type="tel"]\')).filter((e) => e.offsetParent !== null);\n' +
    '  if (!vs.length) return "NO_EL";\n' +
    '  const t = vs[vs.length - 1];\n' +
    '  t.focus(); t.click();\n' +
    '  return "OK";\n' +
    '})()';

// 主登录按钮：可见的 uc-button-primary（语言无关）
const CLICK_SUBMIT = '(() => {\n' +
    '  const bs = Array.from(document.querySelectorAll("div.uc-button.uc-button-primary"))\n' +
    '    .filter((e) => e.offsetParent !== null && !/disabled/.test(e.className));\n' +
    '  if (!bs.length) return "NO_BTN";\n' +
    '  const b = bs[0];\n' +
    '  ["pointerdown","mousedown","pointerup","mouseup","click"].forEach((n) =>\n' +
    '    b.dispatchEvent(new MouseEvent(n, { bubbles: true, cancelable: true, view: window })));\n' +
    '  return "CLICKED";\n' +
    '})()';

// 协议弹窗（中文「同意并继续」/ 英文 "Agree and continue"）
const CLICK_AGREE = '(() => {\n' +
    '  const re = /^(同意并继续|同意|Agree and continue|Agree|Continue)$/i;\n' +
    '  const b = Array.from(document.querySelectorAll("*")).filter((e) =>\n' +
    '    e.children.length === 0 && re.test((e.innerText || "").trim()) && e.offsetParent !== null);\n' +
    '  if (!b.length) return "NO_AGREE";\n' +
    '  const t = b[b.length - 1];\n' +
    '  ["pointerdown","mousedown","pointerup","mouseup","click"].forEach((n) =>\n' +
    '    t.dispatchEvent(new MouseEvent(n, { bubbles: true, cancelable: true, view: window })));\n' +
    '  return "AGREED";\n' +
    '})()';

// 二次验证弹窗（中英文）
// 二次验证弹窗：必须真的出现「获取验证码」按钮才算，
// 否则页面上的「验证码登录」标签会造成误判
const SMS_DIALOG = '(() => {\n' +
    '  const re = /^(获取验证码|Get code|Send code|Send)$/i;\n' +
    '  const b = Array.from(document.querySelectorAll("*")).filter((e) =>\n' +
    '    e.children.length === 0 && re.test((e.innerText || "").trim()) && e.offsetParent !== null);\n' +
    '  return b.length ? "YES" : "NO";\n' +
    '})()';

const CLICK_GET_SMS = '(() => {\n' +
    '  const re = /^(获取验证码|Get code|Send code|获取|Send)$/i;\n' +
    '  const b = Array.from(document.querySelectorAll("*")).filter((e) =>\n' +
    '    e.children.length === 0 && re.test((e.innerText || "").trim()) && e.offsetParent !== null);\n' +
    '  if (!b.length) return "NO_GET";\n' +
    '  b[b.length - 1].click();\n' +
    '  return "GOT";\n' +
    '})()';

const CLICK_VERIFY = '(() => {\n' +
    '  const re = /^(开始验证|验证|Verify|Continue)$/i;\n' +
    '  const b = Array.from(document.querySelectorAll("div.uc-button.uc-button-primary"))\n' +
    '    .filter((e) => e.offsetParent !== null && re.test((e.innerText || "").trim()));\n' +
    '  if (!b.length) return "NO_VERIFY";\n' +
    '  b[0].click();\n' +
    '  return "VERIFIED";\n' +
    '})()';

// 登录接口响应是加密信封，但页面解密后必走 JSON.parse —— 埋钩子把 code 记下来，
// 出错时就能明确区分「11208 风控」和「密码错」和「其它」
const SEEN_HOOK = '(function () {\n' +
    '  if (window.__oppoSeen) return;\n' +
    '  window.__oppoSeen = [];\n' +
    '  var orig = JSON.parse;\n' +
    '  JSON.parse = function (t) {\n' +
    '    var v = orig.apply(this, arguments);\n' +
    '    try {\n' +
    '      if (v && typeof v === "object" && v.code !== undefined) {\n' +
    '        window.__oppoSeen.push({ code: v.code, msg: (v.error && v.error.message) || v.msg || "" });\n' +
    '      }\n' +
    '    } catch (e) {}\n' +
    '    return v;\n' +
    '  };\n' +
    '})()';

// 102800 = WEB_NOT_LOGIN（登录前的正常状态），200 = 成功，都不算错误
const READ_SEEN = 'JSON.stringify((window.__oppoSeen || []).filter(function (x) { return x.code >= 1000 && x.code !== 102800 && x.code !== 200; }))';

const PAGE_TEXT = '(document.body.innerText || "").replace(/\\s+/g, " ").slice(0, 400)';
// ============================================================================
//  五、主流程
// ============================================================================
function readSmsCode(opt) {
    if (opt.smsCode) return String(opt.smsCode).trim();
    if (process.env.OPPO_SMS_CODE) return String(process.env.OPPO_SMS_CODE).trim();
    const f = opt.smsFile || process.env.OPPO_SMS_FILE;
    if (f && fs.existsSync(f)) {
        try {
            const t = fs.readFileSync(f, 'utf8').trim();
            if (t) return t;
        } catch (e) { /* ignore */ }
    }
    return null;
}

/** 读出页面里被 JSON.parse 钩子记下的接口 code */
async function readSeen(c) {
    try {
        const s = String(await c.eval(READ_SEEN));
        const arr = JSON.parse(s);
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        return [];
    }
}

async function waitFor(cond, ms, step) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
        try { if (await cond()) return true; } catch (e) { /* 导航中 */ }
        await sleep(step || 1000);
    }
    return false;
}

/**
 * 静默刷新：只打开商城首页，看能不能直接拿到 NEWOPPOSID
 * @returns {Promise<string|null>}
 */
async function silentRefresh(c, log) {
    log('静默刷新：访问商城首页');
    await c.send('Page.navigate', { url: HOME });
    await waitFor(async () => (await c.eval('document.readyState')) === 'complete', 30000, 1000);
    await sleep(4000);
    return harvest(c, log, 3);
}

async function harvest(c, log, tries) {
    for (let i = 0; i < (tries || 8); i++) {
        const r = await c.send('Network.getAllCookies');
        const nid = (r.cookies || []).find((x) => x.name === 'NEWOPPOSID' && /opposhop\.cn$/.test(x.domain));
        if (nid && nid.value) return nid;
        await sleep(1500);
    }
    return null;
}

/**
 * 完整密码登录
 * @returns {Promise<object|null>} cookie 对象
 */
async function passwordLogin(c, phone, password, opt) {
    const log = opt.log || (() => {});

    // 装 JSON.parse 钩子（必须在新文档生效前装上，所以要 addScriptToEvaluateOnNewDocument）
    try {
        await c.send('Page.enable');
        await c.send('Page.addScriptToEvaluateOnNewDocument', { source: SEEN_HOOK });
    } catch (e) { /* 老 CDP 没这方法就跳过，只是少个诊断信息 */ }

    log('打开商城首页');
    await c.send('Page.navigate', { url: HOME });
    await waitFor(async () => (await c.eval('document.readyState')) === 'complete', 30000, 1000);
    await sleep(1500);

    log('点击登录入口');
    for (let i = 0; i < 10; i++) {
        const r = await c.eval(CLICK_ENTRY);
        if (r === 'CLICKED' || r === 'ON_LOGIN_PAGE') break;
        await sleep(1200);
    }

    const ok = await waitFor(async () => (await c.eval(HAS_PHONE_INPUT)) === 'YES', 40000, 1000);
    if (!ok) {
        const u = String(await c.eval('location.href'));
        const t = String(await c.eval(PAGE_TEXT));
        throw new Error('登录页没加载出手机号输入框（' + u.slice(0, 80) + ' | ' + t.slice(0, 120) + '）');
    }
    await sleep(1200);

    // 用真实键盘事件输入，比直接改 value 更接近真人，也不会被 React 受控组件回滚
    log('填入账号');
    if (await c.eval(FOCUS_PHONE) !== 'OK') {
        throw new Error('手机号输入框定位失败');
    }
    await c.send('Input.insertText', { text: phone });
    await sleep(500);

    log('填入密码');
    if (await c.eval(FOCUS_PASSWORD) !== 'OK') {
        throw new Error('密码输入框定位失败');
    }
    await c.send('Input.insertText', { text: password });
    await sleep(800);

    log('提交登录');
    if ((await c.eval(CLICK_SUBMIT)) !== 'CLICKED') throw new Error('没找到「登录」按钮');
    await sleep(2500);

    const agreed = await c.eval(CLICK_AGREE);
    log('  协议弹窗: ' + agreed);
    await sleep(5000);

    // 失败信号
    const txt = String(await c.eval(PAGE_TEXT));
    if (/环境存在风险|risky environment|abnormal/i.test(txt)) {
        throw new Error('风控拦截 11208：登录环境存在风险。同一 IP 短时间内反复登录会触发，隔几小时或换 IP 再试');
    }
    if (/密码错误|账号或密码不正确|密码不正确|wrong password|incorrect/i.test(txt)) throw new Error('密码错误');
    if (/账号不存在|未注册|not registered|does not exist/i.test(txt)) throw new Error('账号不存在');

    // 二次验证（短信）
    for (let round = 0; round < 2; round++) {
        if ((await c.eval(SMS_DIALOG)) !== 'YES') break;
        log('  触发短信二次验证');
        const got = await c.eval(CLICK_GET_SMS);
        log('  获取验证码: ' + got);
        const code = readSmsCode(opt);
        if (!code) {
            throw new Error('需要短信验证码：请设置 OPPO_SMS_CODE 环境变量或 OPPO_SMS_FILE 文件后重跑');
        }
        await sleep(1000);
        if (await c.eval(FOCUS_SMSCODE) !== 'OK') {
            throw new Error('验证码输入框定位失败');
        }
        await c.send('Input.insertText', { text: code });
        await sleep(600);
        log('  提交验证码');
        await c.eval(CLICK_VERIFY);
        await sleep(6000);
        const t2 = String(await c.eval(PAGE_TEXT));
        if (/验证码错误|验证码不正确|已失效|incorrect|expired/i.test(t2)) throw new Error('短信验证码不正确或已失效');
    }

    // 等跳回商城
    log('等待跳回商城');
    const landed = await waitFor(async () => /opposhop\.cn$/.test(String(await c.eval('location.hostname'))), 40000, 1000);
    if (!landed) {
        const u = String(await c.eval('location.href'));
        const t3 = String(await c.eval(PAGE_TEXT));
        // 停在登录页且无任何提示 = 服务端静默风控（11208）
        const seen = await readSeen(c);
        const risk = seen.find((x) => x.code === 11208 || /风险|risk|abnormal/i.test(x.msg));
        const pwdBad = seen.find((x) => /密码|password|账号或密码/i.test(x.msg));
        if (risk) {
            throw new Error('风控 11208：账号登录环境存在风险。短时间内登录太频繁会被锁一段时间，' +
                '隔几小时再跑，或直接用 oppo_ck 兜底');
        }
        if (pwdBad) throw new Error('密码错误：' + pwdBad.msg);
        const codes = seen.map((x) => x.code + (x.msg ? '(' + x.msg.slice(0, 30) + ')' : '')).slice(-4).join(', ');
        throw new Error('登录未完成，停在 ' + u.split('?')[0] +
            (codes ? '。接口返回：' + codes : '。页面无任何报错，说明 authn/check 没被触发' +
                '（多半是风控静默拦截，SDK 直接短路不请求）') +
            '。建议隔几小时再跑，或用 oppo_ck 兜底');
    }
    await sleep(4000);

    const nid = await harvest(c, log, 10);
    if (!nid) throw new Error('登录成功但没取到 NEWOPPOSID');
    return nid;
}

/**
 * 对外入口
 * @param {object} [opt]
 *   { phone, password, profileDir, port, headless, smsCode, smsFile, log }
 * @returns {Promise<{cookie:string, value:string, expires:number, via:string}>}
 */
async function getOpposhopCookie(opt) {
    opt = opt || {};
    const log = opt.log || (() => {});
    const port = Number(opt.port || process.env.OPPO_DEBUG_PORT || 9333);
    const headless = opt.headless === undefined
        ? String(process.env.OPPO_HEADLESS || '1') !== '0'
        : !!opt.headless;
    const profileDir = opt.profileDir || process.env.OPPO_BROWSER_PROFILE
        || path.join(os.homedir(), '.oppo-store-profile');

    const phone = opt.phone || process.env.OPPO_PHONE || '';
    const password = opt.password || process.env.OPPO_PASSWORD || '';

    await launchChrome(port, profileDir, headless);
    const c = await CDP.attach(port);

    try {
        await c.send('Page.enable');
        await c.send('Network.enable');

        // ① 先试静默刷新（profile 里还有 SSO 会话就不用登录）
        let nid = await silentRefresh(c, log);
        let via = 'silent';
        if (nid) {
            log('静默刷新成功，无需登录');
        } else {
            // ② 走密码登录
            if (!phone || !password) {
                throw new Error('会话已失效且未提供账号密码（设置 OPPO_PHONE / OPPO_PASSWORD）');
            }
            log('会话已失效，走密码登录');
            nid = await passwordLogin(c, phone, password, Object.assign({}, opt, { log }));
            via = 'password';
        }

        return { cookie: 'NEWOPPOSID=' + nid.value, value: nid.value, expires: nid.expires, via };
    } finally {
        c.close();
    }
}

module.exports = { getOpposhopCookie, findChrome, launchChrome, CDP, WS, sleep };

// ============================================================================
//  六、命令行入口
// ============================================================================
if (require.main === module) {
    const argv = process.argv.slice(2);
    const jsonMode = argv.indexOf('--json') >= 0;
    const pos = argv.filter((a) => a.indexOf('--') !== 0);

    const opt = {
        phone: pos[0] || process.env.OPPO_PHONE,
        password: pos[1] || process.env.OPPO_PASSWORD,
        log: (m) => console.error('[oppo-login] ' + m),
    };

    if (!opt.phone || !opt.password) {
        console.error('[oppo-login] 未提供账号密码，只做静默刷新');
    }

    getOpposhopCookie(opt)
        .then((r) => {
            if (jsonMode) {
                console.log(JSON.stringify({ NEWOPPOSID: r.value, via: r.via }));
            } else {
                console.log('NEWOPPOSID=' + r.value);
            }
            if (r.expires > 0) {
                console.error('[oppo-login] 成功(' + r.via + ')，有效期至 ' + new Date(r.expires * 1000).toISOString());
            }
        })
        .catch((e) => {
            console.error('[oppo-login] 失败: ' + e.message);
            process.exit(1);
        });
}