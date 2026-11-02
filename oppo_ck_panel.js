#!/usr/bin/env node
/* -------------------------------------------------------------------------
 *  项目名称：OPPO 商城（短信登录取 CK 面板）
 *  脚本文件：oppo_ck_panel.js
 *  更新说明：
 *    2026-11-02  Mist  仓库整理：统一项目标识、清理隐私信息
 * -------------------------------------------------------------------------
 */
/**
 * OPPO 商城 · 短信验证码登录取 CK 面板
 * ---------------------------------------------------------------------------
 * 一个自带 UI 的本地小程序：打开浏览器 → 输手机号 → 收短信 → 输码 → 拿到
 * NEWOPPOSID → 一键写进青龙环境变量。
 *
 * 用法：
 *   node oppo_ck_panel.js
 *   node oppo_ck_panel.js --port 7788 --open
 *
 * 依赖：
 *   同项目的 ../主脚本/oppo_login.js（提供 CDP / WS / launchChrome）
 *   本机的 Chrome / Edge（原生启动，过网易易盾风控）
 *
 * 环境变量：
 *   OPPO_CHROME           指定浏览器路径
 *   OPPO_BROWSER_PROFILE  profile 目录（默认 ~/.oppo-store-profile）
 *   OPPO_DEBUG_PORT       CDP 端口（默认 9333）
 *   OPPO_HEADLESS         1=无头（默认 0，这里默认有头，方便看进度）
 * ---------------------------------------------------------------------------
 */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

// ---------------------------------------------------------------------------
// 一、加载登录内核
// ---------------------------------------------------------------------------
let core = null;
const CORE_PATHS = [
    path.join(__dirname, '..', '主脚本', 'oppo_login.js'),
    path.join(__dirname, 'oppo_login.js'),
    path.join(__dirname, '..', 'oppo_login.js'),
];
for (const p of CORE_PATHS) {
    try {
        if (fs.existsSync(p)) { core = require(p); break; }
    } catch (e) { /* 继续找 */ }
}
if (!core) {
    console.error('找不到 oppo_login.js（应与 主脚本/ 同级）。已尝试：\n  ' + CORE_PATHS.join('\n  '));
    process.exit(1);
}
const { CDP, WS, findChrome, launchChrome } = core;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// 二、页面操作片段（中英文界面都能用）
// ---------------------------------------------------------------------------
const HOME = 'https://www.opposhop.cn/';

const CLICK_ENTRY = '(() => {\n' +
    '  if (/^id\\.(oppo|heytap)\\.com$/.test(location.hostname)) return "ON_LOGIN_PAGE";\n' +
    '  const b = Array.from(document.querySelectorAll("a, span, div, button"))\n' +
    '    .filter((e) => (e.innerText || "").trim() === "登录" && e.offsetParent !== null);\n' +
    '  if (!b.length) return "NO_ENTRY";\n' +
    '  ["pointerdown","mousedown","pointerup","mouseup","click"].forEach((n) =>\n' +
    '    b[0].dispatchEvent(new MouseEvent(n, { bubbles: true, cancelable: true, view: window })));\n' +
    '  return "CLICKED";\n' +
    '})()';

// 切到「验证码登录」标签页
const CLICK_SMS_TAB = '(() => {\n' +
    '  const re = /^(验证码登录|验证码登录\b|Use verification code|Sign in with code|Sign in with SMS)$/i;\n' +
    '  const b = Array.from(document.querySelectorAll("*")).filter((e) =>\n' +
    '    e.children.length === 0 && re.test((e.innerText || "").trim()) && e.offsetParent !== null);\n' +
    '  if (!b.length) return "NO_TAB";\n' +
    '  const t = b[0];\n' +
    '  ["pointerdown","mousedown","pointerup","mouseup","click"].forEach((n) =>\n' +
    '    t.dispatchEvent(new MouseEvent(n, { bubbles: true, cancelable: true, view: window })));\n' +
    '  return "CLICKED";\n' +
    '})()';

const HAS_TEL = '(() => Array.from(document.querySelectorAll(\'input[type="tel"]\'))\n' +
    '  .filter((e) => e.offsetParent !== null).length)()';

const FOCUS_PHONE = '(() => {\n' +
    '  const vs = Array.from(document.querySelectorAll(\'input[type="tel"]\')).filter((e) => e.offsetParent !== null);\n' +
    '  if (!vs.length) return "NO_EL";\n' +
    '  vs[0].focus(); vs[0].click();\n' +
    '  return "OK";\n' +
    '})()';

// 验证码框 = 第二个可见的 tel 输入框
const FOCUS_CODE = '(() => {\n' +
    '  const vs = Array.from(document.querySelectorAll(\'input[type="tel"]\')).filter((e) => e.offsetParent !== null);\n' +
    '  if (vs.length < 2) return "NO_EL";\n' +
    '  vs[1].focus(); vs[1].click();\n' +
    '  return "OK";\n' +
    '})()';

const CLICK_GET_SMS = '(() => {\n' +
    '  const b = Array.from(document.querySelectorAll("div.uc-input-get-code-button, div.uc-button"))\n' +
    '    .filter((e) => e.offsetParent !== null && /获取验证码|Get code|Send code/i.test(e.innerText || ""));\n' +
    '  if (!b.length) return "NO_BTN";\n' +
    '  ["pointerdown","mousedown","pointerup","mouseup","click"].forEach((n) =>\n' +
    '    b[0].dispatchEvent(new MouseEvent(n, { bubbles: true, cancelable: true, view: window })));\n' +
    '  return "CLICKED";\n' +
    '})()';

const CLICK_SUBMIT = '(() => {\n' +
    '  const b = Array.from(document.querySelectorAll("div.uc-button.uc-button-primary"))\n' +
    '    .filter((e) => e.offsetParent !== null && !/disabled/.test(e.className));\n' +
    '  if (!b.length) return "NO_BTN";\n' +
    '  ["pointerdown","mousedown","pointerup","mouseup","click"].forEach((n) =>\n' +
    '    b[0].dispatchEvent(new MouseEvent(n, { bubbles: true, cancelable: true, view: window })));\n' +
    '  return "CLICKED";\n' +
    '})()';

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

const PAGE_TEXT = '(document.body.innerText || "").replace(/\\s+/g, " ").slice(0, 300)';

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

const READ_SEEN = 'JSON.stringify((window.__oppoSeen || [])\n' +
    '  .filter(function (x) { return x.code >= 1000 && x.code !== 102800 && x.code !== 200; }))';

async function waitFor(cond, ms, step) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
        try { if (await cond()) return true; } catch (e) { /* 导航中 */ }
        await sleep(step || 800);
    }
    return false;
}

// ---------------------------------------------------------------------------
// 三、登录会话
// ---------------------------------------------------------------------------
const sessions = new Map();
let SEQ = 0;

function newSession(phone) {
    return {
        id: crypto.randomBytes(6).toString('hex'),
        phone,
        phase: 'booting',      // booting | loading | sending | waiting_sms | verifying | done | error
        logs: [],
        cookie: null,
        error: null,
        resume: null,          // 等到验证码后在这一刻放行
        createdAt: Date.now(),
    };
}

function log(s, text, kind) {
    s.logs.push({ text, kind: kind || 'ok', t: Date.now() });
    if (s.logs.length > 60) s.logs.shift();
    console.log('[panel] ' + text);
}

function emit(s, text) {
    // 把当前正在跑的那一步标成 run
    for (const l of s.logs) if (l.kind === 'run') l.kind = 'ok';
    log(s, text, 'run');
}

function waitCode(s, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            s.resume = null;
            reject(new Error('等验证码超时（5 分钟），请重新获取'));
        }, ms);
        s.resume = (code) => { clearTimeout(timer); s.resume = null; resolve(code); };
    });
}

async function runLogin(s) {
    const cdpPort = Number(process.env.OPPO_DEBUG_PORT || 9333);
    const profileDir = process.env.OPPO_BROWSER_PROFILE
        || path.join(require('os').homedir(), '.oppo-store-profile');
    // 面板默认有头，方便用户看着它动
    const headless = String(process.env.OPPO_HEADLESS || '0') === '1';

    emit(s, '启动浏览器内核');
    await launchChrome(cdpPort, profileDir, headless);
    const c = await CDP.attach(cdpPort);

    try {
        try {
            await c.send('Page.enable');
            await c.send('Page.addScriptToEvaluateOnNewDocument', { source: SEEN_HOOK });
        } catch (e) { /* 缺了只是少个诊断 */ }

        emit(s, '打开 OPPO 商城首页');
        await c.send('Page.navigate', { url: HOME });
        await waitFor(async () => (await c.eval('document.readyState')) === 'complete', 30000, 800);
        await sleep(1500);

        emit(s, '点击登录入口');
        let entry = 'NO_ENTRY';
        for (let i = 0; i < 12; i++) {
            entry = String(await c.eval(CLICK_ENTRY));
            if (entry === 'CLICKED' || entry === 'ON_LOGIN_PAGE') break;
            await sleep(1000);
        }

        const loaded = await waitFor(async () => Number(await c.eval(HAS_TEL)) >= 1, 40000, 800);
        if (!loaded) {
            const u = String(await c.eval('location.href'));
            throw new Error('登录页没加载出来（' + u.split('?')[0] + '），检查网络能不能通 id.oppo.com');
        }
        await sleep(1200);

        emit(s, '切换到「验证码登录」');
        const tab = String(await c.eval(CLICK_SMS_TAB));
        if (tab === 'NO_TAB') {
            // 有的版本默认就是验证码登录，没有标签可点
            log(s, '   没找到切换标签，按默认表单继续', 'ok');
        }
        await sleep(1500);

        emit(s, '填入手机号');
        if ((await c.eval(FOCUS_PHONE)) !== 'OK') throw new Error('手机号输入框定位失败');
        await c.send('Input.insertText', { text: s.phone });
        await sleep(600);

        emit(s, '请求发送短信');
        const got = String(await c.eval(CLICK_GET_SMS));
        if (got === 'NO_BTN') throw new Error('找不到「获取验证码」按钮');
        await sleep(2500);

        // 图形/滑块验证拦截
        const t0 = String(await c.eval(PAGE_TEXT));
        if (/请完成验证|拖动滑块|安全验证|slide to|captcha/i.test(t0)) {
            throw new Error('触发了图形验证：这个账号/网络被要求人工过验证码，暂时走不通，等一段时间再试');
        }

        s.phase = 'waiting_sms';
        emit(s, '短信已发送，等待输入验证码');

        const code = await waitCode(s, 5 * 60 * 1000);

        s.phase = 'verifying';
        emit(s, '填入验证码并提交');
        if ((await c.eval(FOCUS_CODE)) !== 'OK') throw new Error('验证码输入框定位失败');
        await c.send('Input.insertText', { text: code });
        await sleep(600);
        await c.eval(CLICK_SUBMIT);
        await sleep(2500);
        await c.eval(CLICK_AGREE);
        await sleep(3000);

        const landed = await waitFor(async () => /opposhop\.cn$/.test(String(await c.eval('location.hostname'))), 40000, 1000);
        if (!landed) {
            const seen = await readSeenSafe(c);
            const bad = seen.find((x) => /验证码|code/i.test(x.msg));
            if (bad) throw new Error('验证码不对：' + bad.msg);
            const risk = seen.find((x) => x.code === 11208 || /风险|risk|abnormal/i.test(x.msg));
            if (risk) throw new Error('风控 11208：账号登录环境存在风险，隔几小时再试');
            const codes = seen.map((x) => x.code + (x.msg ? '(' + x.msg.slice(0, 24) + ')' : '')).slice(-3).join(', ');
            const txt = String(await c.eval(PAGE_TEXT));
            throw new Error('登录没跳回去' + (codes ? '，接口返回 ' + codes : '') + (txt ? '。页面：' + txt.slice(0, 80) : ''));
        }

        emit(s, '读取登录凭据');
        await sleep(3000);
        let nid = null;
        for (let i = 0; i < 10; i++) {
            const r = await c.send('Network.getAllCookies');
            nid = (r.cookies || []).find((x) => x.name === 'NEWOPPOSID' && /opposhop\.cn$/.test(x.domain));
            if (nid && nid.value) break;
            await sleep(1200);
        }
        if (!nid) throw new Error('登录成功但没拿到 NEWOPPOSID，重试一次');

        s.cookie = nid.value;
        s.phase = 'done';
        emit(s, '拿到 NEWOPPOSID（' + nid.value.length + ' 字符）');
    } finally {
        try { c.close(); } catch (e) { /* ignore */ }
    }
}

async function readSeenSafe(c) {
    try {
        const arr = JSON.parse(String(await c.eval(READ_SEEN)));
        return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
}

// ---------------------------------------------------------------------------
// 四、推送青龙
// ---------------------------------------------------------------------------
function reqJson(method, urlStr, token, body) {
    return new Promise((resolve) => {
        let u;
        try { u = new URL(urlStr); } catch (e) { return resolve({ status: 0, text: 'URL 非法：' + urlStr }); }
        const lib = u.protocol === 'https:' ? https : http;
        const data = body === undefined ? null
            : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8');
        const headers = { 'Content-Type': 'application/json; charset=utf-8' };
        if (token) headers.Authorization = 'Bearer ' + token;
        if (data) headers['Content-Length'] = data.length;
        const r = lib.request({
            hostname: u.hostname,
            port: u.port || (u.protocol === 'https:' ? 443 : 80),
            path: u.pathname + (u.search || ''),
            method, headers, timeout: 30000,
        }, (x) => {
            const cs = [];
            x.on('data', (c) => cs.push(c));
            x.on('end', () => resolve({ status: x.statusCode, text: Buffer.concat(cs).toString('utf8') }));
        });
        r.on('error', (e) => resolve({ status: 0, text: 'ERR ' + e.message }));
        r.on('timeout', () => r.destroy(new Error('超时')));
        if (data) r.write(data);
        r.end();
    });
}

async function pushToQinglong(opt) {
    const base = String(opt.host || '').trim().replace(/\/+$/, '');
    if (!base) throw new Error('没填青龙面板地址');
    const envName = String(opt.env || 'oppo_ck').trim();
    const cookie = String(opt.cookie || '').trim();
    if (!cookie) throw new Error('没有凭据可推');

    const lr = await reqJson('POST', base + '/api/user/login', null, {
        username: opt.user, password: opt.pass,
    });
    let lj = null;
    try { lj = JSON.parse(lr.text); } catch (e) { /* not json */ }
    if (!lj || !lj.data || !lj.data.token) {
        throw new Error('青龙登录失败（' + lr.status + '）：' + String(lr.text).slice(0, 100));
    }
    const token = lj.data.token;

    const er = await reqJson('GET', base + '/api/envs?searchValue=' + encodeURIComponent(envName), token);
    let ej = null;
    try { ej = JSON.parse(er.text); } catch (e) { /* ignore */ }
    const list = (ej && ej.data) || [];
    const hit = list.find((x) => x.name === envName);

    if (hit) {
        // 注意：青龙 PUT /api/envs 收的是「单个对象」，传数组会 400
        const body = { id: hit.id, name: envName, value: cookie, remarks: hit.remarks || 'OPPO商城 登录凭据' };
        const ur = await reqJson('PUT', base + '/api/envs', token, body);
        if (ur.status !== 200) throw new Error('更新环境变量失败：' + String(ur.text).slice(0, 120));
        return { action: 'updated', message: '已更新青龙环境变量 ' + envName };
    }

    const cr = await reqJson('POST', base + '/api/envs', token, [
        { name: envName, value: cookie, remarks: 'OPPO商城 登录凭据' },
    ]);
    if (cr.status !== 200) throw new Error('新建环境变量失败：' + String(cr.text).slice(0, 120));
    return { action: 'created', message: '已在青龙新建环境变量 ' + envName };
}

// ---------------------------------------------------------------------------
// 五、HTTP 服务
// ---------------------------------------------------------------------------
function readBody(req) {
    return new Promise((resolve) => {
        const cs = [];
        let size = 0;
        req.on('data', (c) => {
            size += c.length;
            if (size > 2 * 1024 * 1024) { req.destroy(); return; }
            cs.push(c);
        });
        req.on('end', () => {
            try { resolve(JSON.parse(Buffer.concat(cs).toString('utf8') || '{}')); }
            catch (e) { resolve({}); }
        });
    });
}

function send(res, code, obj, type) {
    const body = Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj), 'utf8');
    res.writeHead(code, {
        'Content-Type': type || 'application/json; charset=utf-8',
        'Content-Length': body.length,
        'Cache-Control': 'no-store',
    });
    res.end(body);
}

const HTML_FILE = path.join(__dirname, 'oppo_ck_panel.html');

const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');

    if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) {
        try {
            return send(res, 200, fs.readFileSync(HTML_FILE, 'utf8'), 'text/html; charset=utf-8');
        } catch (e) {
            return send(res, 500, '找不到 oppo_ck_panel.html（应与本脚本同目录）', 'text/plain; charset=utf-8');
        }
    }

    if (req.method === 'GET' && u.pathname === '/api/status') {
        const s = sessions.get(u.searchParams.get('id'));
        if (!s) return send(res, 200, { ok: false, error: '会话不存在或已过期' });
        return send(res, 200, {
            ok: true, phase: s.phase, logs: s.logs,
            cookie: s.phase === 'done' ? s.cookie : null,
            error: s.error,
        });
    }

    if (req.method === 'POST' && u.pathname === '/api/send') {
        const body = await readBody(req);
        const phone = String(body.phone || '').trim();
        if (!/^1[3-9]\d{9}$/.test(phone)) return send(res, 200, { ok: false, error: '手机号格式不对' });
        if (!findChrome()) return send(res, 200, { ok: false, error: '本机没找到 Chrome / Edge，请设 OPPO_CHROME' });

        // 一个手机号同时只跑一个会话
        for (const [k, v] of sessions) if (v.phone === phone && v.phase !== 'done' && v.phase !== 'error') sessions.delete(k);

        const s = newSession(phone);
        sessions.set(s.id, s);
        runLogin(s).catch((e) => {
            s.phase = 'error';
            s.error = e && e.message ? e.message : String(e);
            for (const l of s.logs) if (l.kind === 'run') l.kind = 'err';
            log(s, '❌ ' + s.error, 'err');
        });
        return send(res, 200, { ok: true, sid: s.id });
    }

    if (req.method === 'POST' && u.pathname === '/api/verify') {
        const body = await readBody(req);
        const s = sessions.get(String(body.id || ''));
        const code = String(body.code || '').replace(/\D/g, '');
        if (!s) return send(res, 200, { ok: false, error: '会话不存在，请重新获取验证码' });
        if (s.phase !== 'waiting_sms' || typeof s.resume !== 'function') {
            return send(res, 200, { ok: false, error: '当前状态不接受验证码（' + s.phase + '）' });
        }
        if (code.length < 4) return send(res, 200, { ok: false, error: '验证码不完整' });
        s.resume(code);
        return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && u.pathname === '/api/push') {
        const body = await readBody(req);
        try {
            const r = await pushToQinglong(body);
            return send(res, 200, { ok: true, message: r.message, action: r.action });
        } catch (e) {
            return send(res, 200, { ok: false, error: e && e.message ? e.message : String(e) });
        }
    }

    send(res, 404, { ok: false, error: 'not found' });
});

// ---------------------------------------------------------------------------
// 六、启动
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const PORT = (() => {
    const i = argv.indexOf('--port');
    return Number(i >= 0 ? argv[i + 1] : process.env.OPPO_PANEL_PORT || 7788) || 7788;
})();
const AUTO_OPEN = argv.includes('--open');

server.listen(PORT, '127.0.0.1', () => {
    const url = 'http://127.0.0.1:' + PORT + '/';
    console.log('');
    console.log('  ╔══════════════════════════════════════════════════════╗');
    console.log('  ║   OPPO 商城 · 短信登录取 CK 面板                      ║');
    console.log('  ╚══════════════════════════════════════════════════════╝');
    console.log('');
    console.log('  打开：' + url);
    const exe = findChrome();
    console.log('  浏览器：' + (exe || '❌ 没找到 Chrome / Edge'));
    console.log('');
    if (AUTO_OPEN) exec('start "" "' + url + '"', { shell: 'cmd.exe' });
});

// 定时清理超过 30 分钟的会话
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of sessions) {
        if (now - v.createdAt > 30 * 60 * 1000 && v.phase !== 'waiting_sms') sessions.delete(k);
    }
}, 60 * 1000);
