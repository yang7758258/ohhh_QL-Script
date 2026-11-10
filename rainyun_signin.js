#!/usr/bin/env node
/**
 * 雨云（rainyun）每日签到 · 积分任务「每日签到」
 * ---------------------------------------------------------------
 * 环境变量：
 *   rainyun_account   手机号#密码  多账号用 & 或换行分隔
 *   rainyun_push      任意值 = 开启推送（走 sendNotify.js，读取 QYWX_AM 等）
 *   rainyun_captcha   auto(默认) | off   是否启用浏览器过 TCaptcha
 *   rainyun_debug     force = 已领取也强制提交一次；1 = 调试日志
 *   YZ_CHROME         指定 chrome/chrome-headless-shell 路径（青龙已内置）
 *
 * 依赖： node(>=18) + puppeteer-core（青龙 dep_cache 自带）+ python3 + ddddocr/pillow/numpy
 * 用法： task rainyun_signin.js
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

const API = 'https://api.v2.rainyun.com';
const ORIGIN = 'https://app.rainyun.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const CAP_APPID = '2039519451';
const TASK_NAME = '每日签到';
const TMP = path.join(os.homedir() ? os.homedir() : '/tmp', '.ry_signin');

const C = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', b: '\x1b[36m', d: '\x1b[90m', x: '\x1b[0m' };
function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}
const log = (...a) => console.log('[' + ts() + '] ' + a.join(' '));
const ok = (...a) => log(C.g + '✅ ' + a.join(' ') + C.x);
const warn = (...a) => log(C.y + '⚠️  ' + a.join(' ') + C.x);
const err = (...a) => log(C.r + '❌ ' + a.join(' ') + C.x);
const info = (...a) => log(C.b + 'ℹ️  ' + a.join(' ') + C.x);
const dbg = (...a) => { if (env('rainyun_debug') === '1' || env('RY_DEBUG') === '1') log(C.d + '[dbg] ' + a.join(' ') + C.x); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function env(key, def) {
  const v = process.env[key];
  return v === undefined || v === '' ? def : v;
}
function parseAccounts() {
  const raw = env('rainyun_account', '') || env('RAINYUN_ACCOUNT', '');
  if (!raw) return [];
  return raw.split(/[\n&;]+/).map((s) => s.trim()).filter(Boolean).map((line) => {
    const i = line.indexOf('#');
    if (i < 0) return { user: line, pass: '' };
    return { user: line.slice(0, i).trim(), pass: line.slice(i + 1).trim() };
  }).filter((a) => a.user && a.pass);
}
const PUSH = !!(env('rainyun_push', '') || env('RAINYUN_PUSH', ''));
const CAP_MODE = String(env('rainyun_captcha', 'auto')).toLowerCase();

function httpRequest(url, opts) {
  opts = opts || {};
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = opts.body ? Buffer.from(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body), 'utf8') : null;
    const headers = Object.assign({
      'user-agent': UA, origin: ORIGIN, referer: ORIGIN + '/', 'accept-language': 'zh-CN,zh;q=0.9',
    }, opts.headers || {});
    if (body) {
      headers['content-type'] = headers['content-type'] || 'application/json';
      headers['content-length'] = body.length;
    }
    const req = https.request({
      hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search,
      method: opts.method || 'GET', headers, timeout: opts.timeout || 20000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch (e) { }
        resolve({ status: res.statusCode, headers: res.headers, raw: text, json });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function makeJar() {
  const store = {};
  return {
    store,
    absorb(headers) {
      let sc = headers['set-cookie'];
      if (!sc) return;
      if (!Array.isArray(sc)) sc = [sc];
      for (const c of sc) {
        const kv = String(c).split(';')[0];
        const i = kv.indexOf('=');
        if (i < 0) continue;
        const k = kv.slice(0, i).trim();
        const v = kv.slice(i + 1).trim();
        if (v === '' || /Max-Age=0/i.test(String(c))) delete store[k];
        else store[k] = v;
      }
    },
    header() { return Object.keys(store).map((k) => k + '=' + store[k]).join('; '); },
    get(k) { return store[k]; },
    set(k, v) { store[k] = v; },
    dump() { return Object.assign({}, store); },
  };
}

const rys = () => String(0 + Date.now() / 1000);
const sessionCacheFile = () => path.join(TMP, 'session.json');
function loadSessionCache() {
  try { return JSON.parse(fs.readFileSync(sessionCacheFile(), 'utf8')); } catch (e) { return {}; }
}
function saveSessionCache(obj) {
  try { fs.mkdirSync(TMP, { recursive: true }); fs.writeFileSync(sessionCacheFile(), JSON.stringify(obj, null, 1)); } catch (e) { }
}
const mask = (s) => String(s).replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');

class Rainyun {
  constructor(acc, jar) {
    this.acc = acc;
    this.jar = jar || makeJar();
    this.user = null;
  }
  headers(extra) {
    const h = Object.assign({ accept: 'application/json, text/plain, */*', RYS: rys() }, extra || {});
    const ck = this.jar.header();
    if (ck) h.cookie = ck;
    const csrf = this.jar.get('X-CSRF-Token');
    if (csrf) h['X-CSRF-Token'] = csrf;
    return h;
  }
  async call(method, p, body, extra) {
    const res = await httpRequest(API + p, { method, body, headers: this.headers(extra) });
    this.jar.absorb(res.headers);
    return res;
  }
  async login() {
    const res = await this.call('POST', '/user/login', { field: this.acc.user, password: this.acc.pass });
    const j = res.json || {};
    if (j.code === 200) { ok('登录成功 ' + mask(this.acc.user)); return true; }
    if (j.code === 10004) {
      warn('登录触发验证码风险校验，转浏览器取票');
      const t = await getTicket();
      if (!t) { err('取票失败，无法登录'); return false; }
      const r2 = await this.call('POST', '/user/login', { field: this.acc.user, password: this.acc.pass, vticket: t.ticket, vrandstr: t.randstr });
      const j2 = r2.json || {};
      if (j2.code === 200) { ok('登录成功（带票） ' + mask(this.acc.user)); return true; }
      err('登录失败：' + (j2.message || r2.status));
      return false;
    }
    err('登录失败：' + (j.message || String(res.raw).slice(0, 120)));
    return false;
  }
  async me() {
    const r = await this.call('GET', '/user/');
    if (r.json && r.json.code === 200) { this.user = r.json.data; return this.user; }
    return null;
  }
  async tasks() {
    const r = await this.call('GET', '/user/reward/tasks');
    if (r.json && r.json.code === 200) return r.json.data || [];
    return null;
  }
  async submitTask(name, ticket) {
    const body = { task_name: name, verifyCode: '' };
    if (ticket && ticket.ticket) { body.vticket = ticket.ticket; body.vrandstr = ticket.randstr || ''; }
    return this.call('POST', '/user/reward/tasks', body);
  }
}

function findChrome() {
  const cands = [
    process.env.YZ_CHROME, process.env.CHROME_PATH, process.env.PUPPETEER_EXECUTABLE_PATH,
    '/ql/scripts/chrome/chrome-headless-shell-linux64/chrome-headless-shell',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const c of cands) { try { if (c && fs.existsSync(c)) return c; } catch (e) { } }
  return null;
}

function findPython() {
  const cands = [process.env.RY_PYTHON, 'python3', 'python', '/usr/bin/python3', '/usr/local/bin/python3'];
  for (const c of cands) {
    if (!c) continue;
    try {
      const r = spawnSync(c, ['-c', 'import sys;print(sys.version_info[0])'], { encoding: 'utf8', timeout: 20000 });
      if (r.status === 0 && String(r.stdout).trim() === '3') return c;
    } catch (e) { }
  }
  return null;
}

function resolveFile(names) {
  const dirs = [__dirname, path.join(__dirname, '..', '主脚本'), path.join(__dirname, '..', '附带脚本'),
    '/ql/data/scripts', '/ql/scripts', process.cwd(), '/ql/data/scripts/雨云'];
  for (const n of names) {
    if (path.isAbsolute(n) && fs.existsSync(n)) return n;
    for (const d of dirs) { try { const p = path.join(d, n); if (fs.existsSync(p)) return p; } catch (e) { } }
  }
  return null;
}

function solveCaptcha(bgB64, spB64) {
  const solver = resolveFile(['rainyun_cap.py']);
  if (!solver) return { ok: false, reason: '找不到 rainyun_cap.py' };
  const py = findPython();
  if (!py) return { ok: false, reason: '找不到 python3' };
  fs.mkdirSync(TMP, { recursive: true });
  const bgPath = path.join(TMP, 'bg.png');
  const spPath = path.join(TMP, 'sprite.png');
  fs.writeFileSync(bgPath, Buffer.from(bgB64, 'base64'));
  fs.writeFileSync(spPath, Buffer.from(spB64, 'base64'));
  const r = spawnSync(py, [solver, '--bg', bgPath, '--sprite', spPath, '--debug'], { encoding: 'utf8', timeout: 240000 });
  const out = String(r.stdout || '').trim().split('\n').pop();
  const errOut = String(r.stderr || '').trim();
  if (errOut) for (const line of errOut.split('\n')) dbg('[cap] ' + line);
  try { return JSON.parse(out); } catch (e) { return { ok: false, reason: '识别输出异常: ' + String(out).slice(0, 160) }; }
}

// ── 页面内函数（由 puppeteer 序列化注入，可安全使用反引号） ──
function inPageReadChallenge() {
  const imgs = Array.prototype.slice.call(document.querySelectorAll('img'));
  const spImg = imgs.filter(function (i) { return /img_index=0/.test(i.src); })[0];
  const bgDiv = document.querySelector('.tc-bg-img');
  if (!spImg || !bgDiv) return null;
  const bgUrl = (getComputedStyle(bgDiv).backgroundImage || '').replace(/^url\("?/, '').replace(/"\)$/, '');
  const r = bgDiv.getBoundingClientRect();
  return {
    sprite: spImg.src, bg: bgUrl,
    rect: [r.left, r.top, r.width, r.height],
    nat: [672, 480],
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 80),
  };
}
function inPageIframeRect() {
  const f = document.getElementById('tcaptcha_iframe_dy');
  if (!f) return null;
  const r = f.getBoundingClientRect();
  return [r.left, r.top, r.width, r.height];
}
function inPageConfirmCenter() {
  const all = Array.prototype.slice.call(document.querySelectorAll('div,a,button,span'));
  const hit = all.filter(function (el) {
    const t = (el.textContent || '').trim();
    const r = el.getBoundingClientRect();
    return (t === '确定' || t === '確 定') && r.width > 20 && r.height > 10;
  })[0];
  if (!hit) return null;
  const r = hit.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}
function inPageHasChallenge() {
  const imgs = Array.prototype.slice.call(document.querySelectorAll('img'));
  return !!(imgs.filter(function (i) { return /img_index=0/.test(i.src); })[0] && document.querySelector('.tc-bg-img'));
}

function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'user-agent': UA,
        referer: 'https://turing.captcha.qcloud.com/',
        accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'accept-language': 'zh-CN,zh;q=0.9',
      },
      timeout: 20000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode !== 200 || buf.length < 500) reject(new Error('图片下载失败 status=' + res.statusCode + ' len=' + buf.length));
        else resolve(buf);
      });
    });
    req.on('timeout', () => req.destroy(new Error('图片下载超时')));
    req.on('error', reject);
    req.end();
  });
}

let TICKET_STATE = { browser: null, page: null };

async function openCaptchaWidget() {
  const bin = findChrome();
  if (!bin) throw new Error('未找到 chrome / chrome-headless-shell');
  let puppeteer;
  try { puppeteer = require('puppeteer-core'); }
  catch (e) { throw new Error('未找到 puppeteer-core（青龙请用 task 方式运行）'); }
  const browser = await puppeteer.launch({
    executablePath: bin,
    headless: 'shell',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
      '--disable-background-timer-throttling', '--window-size=1280,900', '--lang=zh-CN'],
  });
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction('typeof window.TencentCaptcha === "function"', { timeout: 25000 });
  return { browser, page };
}

async function showCaptcha(page) {
  await page.evaluate(function (aid) {
    try { if (window.__cap && window.__cap.destroy) window.__cap.destroy(); } catch (e) { }
    window.__capResult = null;
    window.__cap = new window.TencentCaptcha(aid, function (r) { window.__capResult = r || { ret: -99 }; });
    window.__cap.show();
  }, CAP_APPID);
  for (let i = 0; i < 60; i++) {
    const f = page.frames().filter(function (x) { return /turing|gtimg/.test(x.url()); })[0];
    if (f) {
      try { if (await f.evaluate(inPageHasChallenge)) return f; } catch (e) { }
    }
    await sleep(250);
  }
  throw new Error('验证码 iframe 未就绪');
}

async function captchaOnce(page, frame) {
  const meta = await frame.evaluate(inPageReadChallenge);
  if (!meta) throw new Error('取不到验证码元素');
  dbg('题面：' + meta.text);
  if (!meta.sprite || !meta.bg) throw new Error('未取到验证码图片地址');
  const pair = await Promise.all([fetchImageBuffer(meta.sprite), fetchImageBuffer(meta.bg)]);
  dbg('图片 sprite=' + pair[0].length + 'B bg=' + pair[1].length + 'B');
  const solved = solveCaptcha(pair[1].toString('base64'), pair[0].toString('base64'));
  if (!solved.ok) throw new Error('识别失败：' + (solved.reason || ''));
  info('提示字 ' + JSON.stringify(solved.texts || []) + ' · 背景字 ' + JSON.stringify(solved.bg_texts || []) + ' · 置信 ' + solved.conf);
  dbg('clicks(672x480) ' + JSON.stringify(solved.clicks));
  const fb = await page.evaluate(inPageIframeRect);
  if (!fb) throw new Error('找不到 tcaptcha_iframe_dy');
  const rl = meta.rect[0], rt = meta.rect[1], rw = meta.rect[2], rh = meta.rect[3];
  const sx = rw / meta.nat[0], sy = rh / meta.nat[1];
  const pts = (solved.clicks || []).map(function (p) {
    return [fb[0] + rl + p[0] * sx, fb[1] + rt + p[1] * sy];
  });
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i][0], y = pts[i][1];
    await page.mouse.move(x + (Math.random() * 6 - 3), y + (Math.random() * 6 - 3), { steps: 6 });
    await sleep(120 + Math.random() * 160);
    await page.mouse.click(x, y, { delay: 30 + Math.random() * 50 });
    await sleep(300 + Math.random() * 200);
  }
  await sleep(350);
  const cbox = await frame.evaluate(inPageConfirmCenter);
  if (cbox) await page.mouse.click(fb[0] + cbox[0], fb[1] + cbox[1], { delay: 50 });
  else { warn('未找到「确定」按钮，尝试回车'); await page.keyboard.press('Enter'); }
  for (let i = 0; i < 48; i++) {
    const st = await page.evaluate(function () {
      if (window.__capResult) return { done: window.__capResult };
      return null;
    });
    if (st) return st.done;
    await sleep(250);
  }
  // 超时前看看 iframe 里是否有失败提示
  try {
    const txt = await frame.evaluate(function () { return (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 80); });
    dbg('超时时 iframe 文案：' + txt);
  } catch (e) { }
  return { ret: -98, msg: '等待结果超时' };
}

async function getTicket() {
  if (CAP_MODE === 'off') { warn('rainyun_captcha=off，跳过浏览器验证码'); return null; }
  let lastErr = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (!TICKET_STATE.browser) {
        const ctx = await openCaptchaWidget();
        TICKET_STATE = ctx;
        info('浏览器就绪：' + path.basename(findChrome() || ''));
      }
      const page = TICKET_STATE.page;
      if (attempt > 1) {
        try {
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForFunction('typeof window.TencentCaptcha === "function"', { timeout: 20000 });
        } catch (e) { dbg('重载页面失败：' + e.message); }
      }
      const frame = await showCaptcha(page);
      info('验证码尝试 ' + attempt + '/3');
      const r = await captchaOnce(page, frame);
      if (r && String(r.ret) === '0' && r.ticket) {
        ok('取得票据 ticket=' + String(r.ticket).slice(0, 14) + '...');
        return { ticket: r.ticket, randstr: r.randstr || '' };
      }
      lastErr = 'ret=' + (r && r.ret) + ' ' + ((r && (r.msg || r.errorMessage || r.errMsg)) || '');
      warn('本次未通过：' + lastErr);
      await sleep(1200);
    } catch (e) {
      lastErr = e.message || String(e);
      warn('验证码流程异常：' + lastErr);
      await closeBrowser();
      await sleep(1200);
    }
  }
  err('验证码三轮未通过：' + lastErr);
  return null;
}

async function closeBrowser() {
  try { if (TICKET_STATE.browser) await TICKET_STATE.browser.close(); } catch (e) { }
  TICKET_STATE = { browser: null, page: null };
}

async function runAccount(acc, idx) {
  const label = '账号' + idx + ' ' + mask(acc.user);
  log(C.b + '━━━ ' + label + ' ━━━' + C.x);
  const jar = makeJar();
  const cache = loadSessionCache();
  if (cache[acc.user] && cache[acc.user].session) {
    jar.set('rain-session', cache[acc.user].session);
    if (cache[acc.user].csrf) jar.set('X-CSRF-Token', cache[acc.user].csrf);
    dbg('使用缓存会话');
  }
  const ry = new Rainyun(acc, jar);
  let me = await ry.me();
  if (!me) {
    if (!(await ry.login())) return { label, status: 'fail', reason: '登录失败' };
    me = await ry.me();
    if (!me) return { label, status: 'fail', reason: '获取用户信息失败' };
  }
  const ck = jar.dump();
  cache[acc.user] = { session: ck['rain-session'], csrf: ck['X-CSRF-Token'], at: Date.now() };
  saveSessionCache(cache);
  const before = Number(me.Points || 0);
  info('用户 ' + (me.Name || '') + ' · ID ' + (me.ID || '') + ' · 积分 ' + before);

  const tasks = await ry.tasks();
  if (!tasks) return { label, status: 'fail', reason: '任务列表获取失败' };
  const task = tasks.filter(function (t) {
    const n = t.TaskName || t.Name || t.task_name || '';
    return n === TASK_NAME;
  })[0] || tasks.filter(function (t) {
    return String(t.TaskName || t.Name || '').indexOf('签到') >= 0;
  })[0];
  if (!task) return { label, status: 'fail', reason: '未找到每日签到任务' };
  const status = Number(task.Status);
  const force = String(env('rainyun_debug', '')) === 'force';
  if (status === 2 && !force) { ok('今日已签到（Status=2），直接跳过'); return { label, status: 'done', points: before, before }; }

  let res = await ry.submitTask(TASK_NAME);
  let j = res.json || {};
  if (j.code === 200) {
    const after = await ry.me();
    const gained = Number((after && after.Points) || 0) - before;
    ok('签到成功（免票通道） +' + gained + ' 分');
    return { label, status: 'ok', before, points: Number((after && after.Points) || 0), gained };
  }
  dbg('免票提交返回 ' + res.status + ' ' + String(res.raw).slice(0, 160));
  if (Number(j.code) !== 10004 && res.status !== 400 && res.status !== 403) {
    return { label, status: 'fail', reason: '提交异常 ' + (j.message || res.status), before };
  }
  warn('服务端要求验证码（' + (j.message || 'code=' + j.code) + '），转浏览器取票');

  let claimed = false, lastMsg = '';
  for (let round = 1; round <= 2 && !claimed; round++) {
    const t = await getTicket();
    if (!t) { lastMsg = '取票失败'; break; }
    const r2 = await ry.submitTask(TASK_NAME, t);
    const j2 = r2.json || {};
    if (Number(j2.code) === 200) { claimed = true; break; }
    lastMsg = 'code=' + j2.code + ' ' + (j2.message || r2.status);
    warn('第 ' + round + ' 次提交未通过：' + lastMsg);
    await sleep(2000);
  }
  if (!claimed) return { label, status: 'fail', reason: '签到失败：' + lastMsg, before };
  const after = await ry.me();
  const gained = Number((after && after.Points) || 0) - before;
  ok('签到成功 +' + gained + ' 分 · 当前 ' + Number((after && after.Points) || 0));
  return { label, status: 'ok', before, points: Number((after && after.Points) || 0), gained };
}

async function main() {
  log(C.b + '════════════════════════════════════════' + C.x);
  log(C.b + '   🌈  雨云 · 每日签到（积分任务） v1.0' + C.x);
  log(C.b + '════════════════════════════════════════' + C.x);
  const accounts = parseAccounts();
  if (!accounts.length) { err('未配置 rainyun_account，格式：手机号#密码'); process.exit(1); }
  info('账号 ' + accounts.length + ' 个 · 推送 ' + (PUSH ? '开' : '关') + ' · 验证码 ' + CAP_MODE);
  const results = [];
  for (let i = 0; i < accounts.length; i++) {
    try { results.push(await runAccount(accounts[i], i + 1)); }
    catch (e) {
      err('账号异常：' + (e && e.message));
      results.push({ label: '账号' + (i + 1), status: 'fail', reason: e && e.message });
    }
    if (i < accounts.length - 1) await sleep(5000 + Math.random() * 8000);
  }
  await closeBrowser();
  const okN = results.filter(function (r) { return r.status === 'ok'; }).length;
  const doneN = results.filter(function (r) { return r.status === 'done'; }).length;
  const failN = results.filter(function (r) { return r.status === 'fail'; }).length;
  log(C.b + '────────────────────────────────────────' + C.x);
  log('📊 成功 ' + okN + ' · 已签 ' + doneN + ' · 失败 ' + failN);
  for (const r of results) {
    const icon = r.status === 'ok' ? '✅' : (r.status === 'done' ? '💤' : '❌');
    log('   ' + icon + ' ' + r.label + (r.gained !== undefined ? ' +' + r.gained + '分' : '') +
      (r.points !== undefined ? ' → ' + r.points : '') + (r.reason ? ' (' + r.reason + ')' : ''));
  }
  if (PUSH) {
    const title = '雨云签到 ' + (failN ? '部分失败' : '全部完成') + ' · ' + new Date().toLocaleDateString('zh-CN');
    const lines = results.map(function (r) {
      const icon = r.status === 'ok' ? '✅' : (r.status === 'done' ? '💤' : '❌');
      return icon + ' ' + r.label + (r.gained !== undefined ? ' +' + r.gained + '分' : '') +
        (r.points !== undefined ? '（余额 ' + r.points + '）' : '') + (r.reason ? ' — ' + r.reason : '');
    });
    const content = lines.join('\n') + '\n\n📊 成功 ' + okN + ' · 已签 ' + doneN + ' · 失败 ' + failN;
    try {
      const notify = require(resolveFile(['sendNotify.js']));
      await notify.sendNotify(title, content);
      log('📮 推送完成');
    } catch (e) { warn('推送失败：' + (e && e.message)); }
  }
  process.exit(failN > 0 && okN === 0 && doneN === 0 ? 1 : 0);
}

main().catch(function (e) { err('脚本异常：' + ((e && e.stack) || e)); process.exit(1); });
