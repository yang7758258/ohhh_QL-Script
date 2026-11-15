#!/usr/bin/env node
/* -------------------------------------------------------------------------
 *  项目名称：小天鹅（鹅仔养成 / 数字头像 每日任务）
 *  脚本文件：xiaotiane_daily.js
 *  更新说明：
 *    2026-11-15  Mist  仓库首发：签到 + 鹅仔任务 + 喂青草 + 数字头像
 * -------------------------------------------------------------------------
 *  Author : Mist
 *  声明   : 仅供个人学习与技术研究，仅用于自己有权操作的账号，风险自负
 * -------------------------------------------------------------------------
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

/* ─────────────────────────── 常量 ─────────────────────────── */

const HOST = {
  uc:  'https://sec.midea.com',
  bff: 'https://mcsp.midea.com/api/cms_bff/mcsp-uc-mvip-bff',
  api: 'https://littleswanmp.midea.com',
};

const SYSTEM       = 'LITTLESWANMINI';
const SYSTEM_LOWER = 'littleswanmini';
const CHANNEL_CODE = '3.1.3.6.2.168.959.2';
const APP_ID       = 'wx33856a6b31431c6e';
const AGREE_VERSIONS = [
  { type: 'register', version: '1634103487705' },
  { type: 'privacy',  version: '1657158525980' },
];

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_2 like Mac OS X) AppleWebKit/605.1.15 '
         + '(KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.71(0x18004730) '
         + 'NetType/WIFI Language/zh_CN';

const REFERER = 'https://servicewechat.com/' + APP_ID + '/209/page-frame.html';

const STATE_FILE = path.join(__dirname, 'xte_state.json');

/* ─────────────────────────── 终端渲染 ─────────────────────────── */

const NO_COLOR = !!process.env.NO_COLOR || process.env.TERM === 'dumb';
const C = (code) => (s) => (NO_COLOR ? String(s) : '\u001b[' + code + 'm' + s + '\u001b[0m');
const dim    = C('2');
const bold   = C('1');
const cyan   = C('36');
const green  = C('32');
const yellow = C('33');
const red    = C('31');
const gray   = C('90');

const OK   = green('✓');
const FAIL = red('✗');
const SKIP = gray('·');
const WARN = yellow('!');
const TREE = gray('├─');
const LAST = gray('└─');

const W = 60;

function line(ch = '─') { console.log(gray(ch.repeat(W))); }

function banner() {
  console.log('');
  console.log('  ' + bold(cyan('小 天 鹅')) + gray('  ·  ') + bold('鹅仔养成 / 数字头像'));
  console.log('  ' + gray('daily runner — signin · tasks · feed'));
  line();
}

function section(name, note) {
  console.log('');
  console.log(bold(cyan('◆ ' + name)) + (note ? gray('  ' + note) : ''));
}

function pad(s, n) {
  // 中文按 2 列宽计算
  let w = 0;
  for (const ch of String(s)) w += /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(ch) ? 2 : 1;
  return String(s) + ' '.repeat(Math.max(0, n - w));
}

function row(icon, label, detail) {
  console.log('  ' + TREE + ' ' + icon + ' ' + pad(label, 26) + gray(detail || ''));
}

function summary(lines) {
  console.log('');
  line('═');
  for (const l of lines) console.log('  ' + l);
  line('═');
  console.log('');
}

/* ─────────────────────────── HTTP ─────────────────────────── */

function request(url, { method = 'GET', headers = {}, body = null, timeout = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method, headers, timeout },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode, headers: res.headers, text });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('请求超时')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function parseJSON(text) {
  try { return JSON.parse(text); } catch { return null; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (base) => base + Math.floor(Math.random() * 900) + 300;

/* ─────────────────────────── 配置 & 状态 ─────────────────────────── */

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}

function saveState(patch) {
  const next = Object.assign(loadState(), patch, { updatedAt: new Date().toISOString() });
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2), 'utf8'); } catch { /* ignore */ }
  return next;
}

function config() {
  const st = loadState();
  return {
    phone:    process.env.XTE_PHONE      || st.phone    || '',
    password: process.env.XTE_PASSWORD   || '',
    ucToken:  process.env.XTE_UC_TOKEN   || st.ucToken  || '',
    wxJsCode: process.env.XTE_WX_JSCODE  || '',
    modules:  (process.env.XTE_MODULES   || 'swan,avatar,feed').split(',').map((s) => s.trim()).filter(Boolean),
    push:     (process.env.XTE_PUSH      || 'on').toLowerCase() !== 'off',
  };
}

/* ─────────────────────────── 认证层 ─────────────────────────── */

const UC_HEADERS = {
  'Content-Type': 'application/json',
  'system': SYSTEM,
  'Authorization': 'Bearer null',
  'Accept': 'application/json, text/plain, */*',
  'c4a_self': '1',
  'User-Agent': UA,
  'Origin': HOST.uc,
};

/** UC「同意协议」→ 换取本次登录的 checkId（服务端一次性票据） */
async function agreeAgreement() {
  const res = await request(HOST.uc + '/security/wap/user/agree_agreement', {
    method: 'POST',
    headers: UC_HEADERS,
    body: JSON.stringify({ checkStatus: '1', agreeVersions: AGREE_VERSIONS }),
  });
  const j = parseJSON(res.text);
  if (!j || j.code !== '0' || !j.data) {
    throw new Error('协议签署失败: ' + (j && j.msg ? j.msg : res.status));
  }
  return j.data;
}

/** 账号密码登录 —— 返回 c4a JWT（8 小时，携带 userId） */
async function passwordLogin(phone, password) {
  const checkId = await agreeAgreement();
  const payload = {
    system: SYSTEM_LOWER,
    nationalPrefix: '',
    user: phone,
    openId: '',
    password: Buffer.from(String(password), 'utf8').toString('base64'),
    channelCode: CHANNEL_CODE,
    unionId: '',
    shopCode: null,
    type: null,
    checkId,
    imgCode: '',
    sliderCode: '',
  };
  const res = await request(HOST.uc + '/security/wap/user/pwd_user_auth_bind', {
    method: 'POST',
    headers: Object.assign({}, UC_HEADERS, { 'X-IAMService-Language': 'zh-CN' }),
    body: JSON.stringify(payload),
  });
  const j = parseJSON(res.text);
  if (!j || j.code !== '0' || !j.data || !j.data.token) {
    throw new Error('密码登录失败: ' + (j && j.msg ? j.msg : res.status));
  }
  return j.data.token;
}

/** c4a JWT + wx.login code → 小程序 ucAccessToken（64 hex，30 天） */
async function mintUcToken(c4aToken, jsCode) {
  const res = await request(HOST.bff + '/app/login/wx/mini/getLoginInfo.do', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA, 'ucAccessToken': '' },
    body: JSON.stringify({ jsCode, platformType: 'WX_LS_MINI', loginMode: 3, token: c4aToken }),
  });
  const j = parseJSON(res.text);
  if (!j || j.code !== '000000' || !j.data || !j.data.ucAccessToken) {
    throw new Error('会话换取失败: ' + (j && j.msg ? j.msg : res.status));
  }
  return j.data;
}

/** ucAccessToken → Bearer access_token（oauth2 交换，10 天） */
async function refreshBearer(ucToken) {
  const res = await request(HOST.api + '/api/auth/login/uc_token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'ucAccessToken': ucToken,
      'User-Agent': UA,
      'Referer': REFERER,
    },
    body: 'uc_token=' + encodeURIComponent(ucToken),
  });
  const j = parseJSON(res.text);
  if (!j || j.code !== 200 || !j.content || !j.content.access_token) {
    const msg = j && j.detail ? j.detail : (j && j.error ? j.error : res.status);
    throw new Error('Bearer 续期失败: ' + msg);
  }
  return {
    accessToken: j.content.access_token,
    expiresIn: Number(j.content.expires_in) || 86400,
  };
}

/* ─────────────────────────── 业务层 ─────────────────────────── */

class Session {
  constructor(ucToken, accessToken) {
    this.ucToken = ucToken;
    this.accessToken = accessToken;
  }

  headers() {
    return {
      'content-type': 'application/json',
      'ucAccessToken': this.ucToken,
      'authorization': 'Bearer ' + this.accessToken,
      'User-Agent': UA,
      'Referer': REFERER,
    };
  }

  async call(pathname, body) {
    const res = await request(HOST.api + pathname, {
      method: body === undefined ? 'GET' : 'POST',
      headers: this.headers(),
      body: body === undefined ? null : JSON.stringify(body),
    });
    const j = parseJSON(res.text);
    if (!j) throw new Error('响应非 JSON (' + res.status + ')');
    return j;
  }
}

class SessionExpired extends Error {}

function ensureOk(j, label) {
  if (j.code === 200) return j;
  if (j.code === 401) throw new SessionExpired('会话失效');
  throw new Error((j.chnDesc || j.engDesc || '未知错误') + ' [' + j.code + ']');
}

const API = {
  swan:          ()            => ['/api/web/mobile/swan/getSwanByToken', undefined],
  swanTasks:     ()            => ['/api/web/mobile/swanPrize/queryPrizeRuleUserComplete', { ruleType: '1', ruleClass: '3' }],
  swanWorks:     ()            => ['/api/web/mobile/swanPrize/pagePrizeRule', { pageIndex: 1, pageSize: 50, param: { ruleClass: '4', ruleType: '1' } }],
  swanBegin:     (ruleId)      => ['/api/web/mobile/swanPrize/beginTask', { ruleId }],
  swanComplete:  (ruleId)      => ['/api/web/mobile/swanPrize/completeTask', { ruleId }],
  swanFeed:      ()            => ['/api/web/mobile/swan/feedGrass', {}],
  swanClaim:     ()            => ['/api/web/mobile/swan/userGainPrizeByRule', {}],
  avatarTasks:   ()            => ['/api/web/mobile/avatarRule/queryPrizeRuleUserComplete', { ruleTypeId: '1', ruleClassId: '2', seq: 0 }],
  avatarBegin:   (ruleId)      => ['/api/web/mobile/avatarRule/beginTask', { ruleId }],
  avatarComplete:(ruleId)      => ['/api/web/mobile/avatarRule/completeTask', { ruleId }],
  avatarClaim:   ()            => ['/api/web/mobile/avatarRule/userGainPrizeByRule', {}],
  avatarPoints:  ()            => ['/api/web/mobile/avatar/getUserPoints', {}],
  avatarBalance: ()            => ['/api/web/mobile/avatar/getPointsBalance', { ruleType: 1 }],
};

async function invoke(sess, key, arg) {
  const [p, body] = API[key](arg);
  return sess.call(p, body);
}

/** 执行单个任务：beginTask → 等待 → completeTask */
async function runTask(sess, kind, task, { wait = 2600 } = {}) {
  const beginKey    = kind === 'swan' ? 'swanBegin'    : 'avatarBegin';
  const completeKey = kind === 'swan' ? 'swanComplete' : 'avatarComplete';

  try {
    ensureOk(await invoke(sess, beginKey, task.id), 'beginTask');
  } catch (e) {
    return { ok: false, reason: e.message };
  }

  await sleep(jitter(wait));

  try {
    const j = ensureOk(await invoke(sess, completeKey, task.id), 'completeTask');
    const c = j.content || {};
    const gain = c.changeValue != null
      ? (Number(c.changeValue) > 0 ? '+' + Number(c.changeValue) : String(c.changeValue))
      : '';
    return {
      ok: true,
      gain,
      prize: c.prizeName || task.prizeName || '',
      value: c.newValue,
    };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

/* ─────────────────────────── 业务编排 ─────────────────────────── */

async function profile(sess) {
  const swan = ensureOk(await invoke(sess, 'swan')).content || {};
  let points = null;
  let balance = null;
  try { points = (await invoke(sess, 'avatarPoints')).content; } catch { /* optional */ }
  try { balance = (await invoke(sess, 'avatarBalance')).content; } catch { /* optional */ }
  return { swan, points, balance };
}

async function moduleSwan(sess, report) {
  section('鹅仔养成', 'swan');

  const swan = ensureOk(await invoke(sess, 'swan')).content || {};
  row('◎', '鹅仔 ' + (swan.swanNick || '-'),
      (swan.growthStageName || '-') + '  青草 ' + Number(swan.grassAmount || 0)
      + '  蛋壳 ' + Number(swan.shellAmount || 0));

  // ── 日常任务（含每日签到）──
  const taskRes = ensureOk(await invoke(sess, 'swanTasks'));
  const tasks = taskRes.content || [];
  const pending = tasks.filter((t) => !t.isUserCompleted);

  row('◎', '日常任务 ' + tasks.length + ' 项',
      pending.length ? pending.length + ' 项待完成' : '全部已完成');

  for (const t of pending) {
    const r = await runTask(sess, 'swan', t);
    if (r.ok) {
      row(OK, t.ruleName, [r.gain, r.prize].filter(Boolean).join(' '));
      report.task.ok.push(t.ruleName);
    } else if (/间隔|时间未到/.test(r.reason)) {
      row(WARN, t.ruleName, '时间间隔未到');
      report.task.skip.push(t.ruleName);
    } else {
      row(FAIL, t.ruleName, r.reason);
      report.task.fail.push(t.ruleName + '：' + r.reason);
    }
  }

  // ── 工作（8 小时冷却）──
  const workRes = ensureOk(await invoke(sess, 'swanWorks'));
  const works = (workRes.recordList || []).filter((w) => w.state === '2');
  for (const w of works) {
    const r = await runTask(sess, 'swan', { id: w.id, prizeName: w.prizeName });
    if (r.ok) {
      row(OK, '工作·' + w.ruleName, [r.gain, r.prize].filter(Boolean).join(' '));
      report.task.ok.push('工作·' + w.ruleName);
    } else if (/间隔|时间未到/.test(r.reason)) {
      const hours = Math.round((w.timeInterval || 0) / 3600);
      row(WARN, '工作·' + w.ruleName, hours ? '需间隔 ' + hours + ' 小时' : '冷却中');
      report.task.skip.push('工作·' + w.ruleName);
    } else {
      row(FAIL, '工作·' + w.ruleName, r.reason);
      report.task.fail.push('工作·' + w.ruleName + '：' + r.reason);
    }
  }

  // ── 领取待发放奖励 ──
  try {
    const claim = await invoke(sess, 'swanClaim');
    const got = (claim.content || []).length;
    if (got) row(OK, '奖励入账', got + ' 笔');
  } catch { /* 可忽略 */ }

  return swan;
}

async function moduleAvatar(sess, report) {
  section('数字头像', 'avatar');

  let points = null;
  try { points = (await invoke(sess, 'avatarPoints')).content; } catch { /* optional */ }
  let balance = null;
  try { balance = (await invoke(sess, 'avatarBalance')).content; } catch { /* optional */ }
  if (points != null) row('◎', '头像积分', String(points));
  if (balance != null) row('◎', '头像券余额', String(balance));

  const res = ensureOk(await invoke(sess, 'avatarTasks'));
  const tasks = res.content || [];
  const pending = tasks.filter((t) => !t.isUserCompleted);

  row('◎', '日常任务 ' + tasks.length + ' 项',
      pending.length ? pending.length + ' 项待完成' : '全部已完成');

  for (const t of pending) {
    const r = await runTask(sess, 'avatar', t);
    if (r.ok) {
      row(OK, t.ruleName, [r.gain, t.prize].filter(Boolean).join(' '));
      report.task.ok.push('头像·' + t.ruleName);
    } else if (/间隔|时间未到/.test(r.reason)) {
      row(WARN, t.ruleName, '时间间隔未到');
      report.task.skip.push('头像·' + t.ruleName);
    } else {
      row(FAIL, t.ruleName, r.reason);
      report.task.fail.push('头像·' + t.ruleName + '：' + r.reason);
    }
  }

  try {
    const claim = await invoke(sess, 'avatarClaim');
    const got = (claim.content || []).length;
    if (got) row(OK, '奖励入账', got + ' 笔');
  } catch { /* 可忽略 */ }
}

async function moduleFeed(sess, report) {
  section('喂养', 'feedGrass');

  let fed = 0;
  for (let i = 0; i < 20; i += 1) {
    let j;
    try {
      j = await invoke(sess, 'swanFeed');
    } catch (e) {
      row(FAIL, '喂养', e.message);
      break;
    }
    if (j.code !== 200) {
      const msg = j.chnDesc || j.engDesc || '无法喂养';
      row(i === 0 ? SKIP : OK, '喂养', i === 0 ? msg : '共喂养 ' + fed + ' 次');
      if (i === 0) report.task.skip.push('喂养：' + msg);
      break;
    }
    fed += 1;
    const c = j.content || {};
    if (fed === 1) {
      row('◎', '喂养开始', '青草 ' + Number(c.grassAmount || 0)
        + '  阶段 ' + (c.growthStageName || '-'));
    }
    await sleep(jitter(1200));
  }
  report.feed = fed;
  return fed;
}

/* ─────────────────────────── 推送 ─────────────────────────── */

async function push(title, content) {
  try {
    const mod = require(path.join(__dirname, 'sendNotify.js'));
    if (typeof mod === 'function') await mod(title, content);
    else if (mod && typeof mod.sendNotify === 'function') await mod.sendNotify(title, content);
    return true;
  } catch (e) {
    console.log('  ' + WARN + ' 推送跳过 ' + gray(e.message));
    return false;
  }
}

/* ─────────────────────────── 主流程 ─────────────────────────── */

async function buildSession(cfg) {
  let ucToken = cfg.ucToken;
  let note = '沿用本地会话';

  // 1) 若有 wx.login code 且配置了账号密码 —— 换取全新 30 天会话
  if (cfg.wxJsCode && cfg.phone && cfg.password) {
    try {
      const c4a = await passwordLogin(cfg.phone, cfg.password);
      const info = await mintUcToken(c4a, cfg.wxJsCode);
      ucToken = info.ucAccessToken;
      note = '账号密码 + wxCode 换取新会话';
      saveState({
        phone: cfg.phone,
        ucToken,
        ucTokenExpire: Number(info.ucAccessTokenExpireTime) || null,
        openId: info.openId,
        unionId: info.unionId,
        uid: info.c4aUid,
      });
    } catch (e) {
      console.log('  ' + WARN + ' 会话换取失败，回退本地 ' + gray(e.message));
    }
  }

  // 2) 仅账号密码 —— 校验账号并记录 uid（不足以换取小程序会话）
  if (!ucToken && cfg.phone && cfg.password) {
    const c4a = await passwordLogin(cfg.phone, cfg.password);
    const payload = JSON.parse(Buffer.from(c4a.split('.')[1], 'base64').toString('utf8'));
    const uid = JSON.parse(payload.aud || '{}').userId || '';
    saveState({ phone: cfg.phone, uid });
    throw new Error(
      '账号密码校验通过（uid ' + uid.slice(0, 8) + '…），但小程序会话需 wx.login code，'
      + '请提供 XTE_UC_TOKEN 或 XTE_WX_JSCODE'
    );
  }

  if (!ucToken) {
    throw new Error('缺少凭证：请设置 XTE_UC_TOKEN（或 XTE_PHONE + XTE_PASSWORD + XTE_WX_JSCODE）');
  }

  // 3) Bearer 续期（每次运行都换新，10 天滚动）
  const b = await refreshBearer(ucToken);
  const st = loadState();
  saveState({
    ucToken,
    accessToken: b.accessToken,
    bearerExpireAt: Date.now() + b.expiresIn * 1000,
  });

  return { session: new Session(ucToken, b.accessToken), note, state: st };
}

async function main() {
  banner();

  const cfg = config();
  const report = { task: { ok: [], skip: [], fail: [] }, feed: 0 };

  let session;
  let note;
  let before;
  try {
    const built = await buildSession(cfg);
    session = built.session;
    note = built.note;
  } catch (e) {
    console.log('');
    console.log('  ' + FAIL + ' ' + red(e.message));
    console.log('');
    process.exit(1);
    return;
  }

  row('◎', '登录态', note);

  try {
    before = await profile(session);
  } catch (e) {
    console.log('  ' + FAIL + ' 账号信息读取失败 ' + gray(e.message));
  }

  let swanAfter = null;
  try {
    if (cfg.modules.includes('swan')) swanAfter = await moduleSwan(session, report);
    if (cfg.modules.includes('avatar')) await moduleAvatar(session, report);
    if (cfg.modules.includes('feed')) await moduleFeed(session, report);
  } catch (e) {
    if (e instanceof SessionExpired) {
      section('异常');
      row(FAIL, '会话失效', '请更新 XTE_UC_TOKEN');
      process.exit(2);
      return;
    }
    console.log('  ' + FAIL + ' ' + red(e.message));
  }

  // ── 收尾快照 ──
  let after = null;
  try { after = await profile(session); } catch { /* optional */ }

  const s0 = (before && before.swan) || {};
  const s1 = (after && after.swan) || swanAfter || {};
  const grass0 = Number(s0.grassAmount || 0);
  const grass1 = Number(s1.grassAmount || 0);
  const shell0 = Number(s0.shellAmount || 0);
  const shell1 = Number(s1.shellAmount || 0);
  const p0 = before && before.points;
  const p1 = after && after.points;

  summary([
    bold('本次结果'),
    '',
    '  ' + pad('任务完成', 16) + green(report.task.ok.length + ' 项'),
    '  ' + pad('跳过 / 冷却', 16) + gray(report.task.skip.length + ' 项'),
    '  ' + pad('失败', 16) + (report.task.fail.length ? red(report.task.fail.length + ' 项') : gray('0 项')),
    '',
    '  ' + pad('青草', 16) + grass0 + ' → ' + bold(grass1) + (grass1 > grass0 ? green('  (+' + (grass1 - grass0) + ')') : ''),
    '  ' + pad('蛋壳', 16) + shell0 + ' → ' + bold(shell1) + (shell1 > shell0 ? green('  (+' + (shell1 - shell0) + ')') : ''),
    '  ' + pad('头像积分', 16) + (p0 != null ? p0 : '-') + ' → ' + bold(p1 != null ? p1 : '-'),
    '  ' + pad('成长阶段', 16) + bold(s1.growthStageName || '-'),
  ]);

  // ── 推送 ──
  if (cfg.push) {
    const lines = [
      '账号：' + (cfg.phone ? cfg.phone.slice(0, 3) + '****' + cfg.phone.slice(-4) : '未知'),
      '鹅仔：' + (s1.swanNick || '-') + ' / ' + (s1.growthStageName || '-'),
      '青草：' + grass0 + ' → ' + grass1,
      '蛋壳：' + shell0 + ' → ' + shell1,
      '头像积分：' + (p0 != null ? p0 : '-') + ' → ' + (p1 != null ? p1 : '-'),
      '完成 ' + report.task.ok.length + ' 项 / 跳过 ' + report.task.skip.length + ' 项 / 失败 ' + report.task.fail.length + ' 项',
    ];
    if (report.task.fail.length) lines.push('', '失败明细：', ...report.task.fail.map((f) => '· ' + f));
    await push('小天鹅鹅仔', lines.join('\n'));
  }
}

main().catch((e) => {
  console.log('');
  console.log('  ' + FAIL + ' ' + red(e && e.message ? e.message : String(e)));
  process.exit(1);
});
