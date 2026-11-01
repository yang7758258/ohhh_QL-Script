#!/usr/bin/env node
/**
 * ============================================================================
 *  中国南方航空（CSAIR）· 天天签到 · 里程奖励
 *  青龙面板版 · 纯 HTTP 零依赖（只用 Node 内置 https / zlib / crypto）
 * ============================================================================
 *
 *  作    者：Mist
 *  版    本：v1.1
 *  运行环境：青龙面板 / 任意 Node.js >= 14（无任何 npm 依赖）
 *  抓包样本：2026-11-01 432 条请求（Windows 微信 4.x 小程序 wx729238547ac7a14c v472）
 *  适配活动：天天签到 activityId=310（2026-11-01 ~ 2026-11-30，每月换一期）
 *
 * ----------------------------------------------------------------------------
 * 环境变量
 * ----------------------------------------------------------------------------
 *    CSAIR_CK        ★通道A   cs1246643sso 的值（多账号换行；也接受 "cs1246643sso=xxx" 整段）
 *    CSAIR_ACCOUNT   ★通道B   手机号#密码#openId#unionId[#sessionid]
 *    CSAIR_SID       可选      全局 sessionid（账号行里没写第 5 段时用）
 *    CSAIR_DELAY     可选      多账号间隔秒，默认 6-15
 *    CSAIR_NOTIFY    可选      0 关闭推送
 *    CSAIR_TAG       可选      推送标题后缀
 *    CSAIR_DEBUG     可选      1 打印原始报文
 *    CSAIR_MODE      可选      all（默认）/ sign（只签到）/ probe（只体检不写数据）
 *    CSAIR_FORCE     可选      1 无视 08:00 时间窗强行签到（一般别开）
 *    CSAIR_TIMEOUT   可选      单请求超时毫秒，默认 20000
 *
 *    CK 与 ACCOUNT 同时配置时：CK 优先；CK 失效且账号资料齐全 → 自动重登兜底。
 *    命令行：task csair_signin.js probe
 *
 * ----------------------------------------------------------------------------
 * 免责
 * ----------------------------------------------------------------------------
 *    1. 本脚本只把「每天点一次签到按钮」自动化，不刷量、不并发、不改设备指纹。
 *    2. 请合理设置频率：一天一次，排在 08:10 之后（活动 08:00 才开门）。
 *   
 * ============================================================================
 * new Env('南方航空签到');
 * cron: 22 8 * * *
 * tag: 南方航空签到
 * ============================================================================
 */

'use strict';

const https = require('https');
const http = require('http');
const zlib = require('zlib');
const crypto = require('crypto');

// ============================================================================
// 一、环境变量
// ============================================================================

const ENV_CK      = 'CSAIR_CK';
const ENV_ACCOUNT = 'CSAIR_ACCOUNT';
const ENV_SID     = 'CSAIR_SID';
const ENV_DELAY   = 'CSAIR_DELAY';
const ENV_NOTIFY  = 'CSAIR_NOTIFY';
const ENV_TAG     = 'CSAIR_TAG';
const ENV_DEBUG   = 'CSAIR_DEBUG';
const ENV_MODE    = 'CSAIR_MODE';
const ENV_FORCE   = 'CSAIR_FORCE';
const ENV_TIMEOUT = 'CSAIR_TIMEOUT';

// ============================================================================
// 二、常量（全部来自抓包 / H5 包，原样照抄）
// ============================================================================

const HOST      = 'wxapi.csair.com';
const APPID     = 'wx729238547ac7a14c';
const PLATFORM  = 'wxopen';
const API_QUERY = '?appid=' + APPID + '&wxchannel=' + PLATFORM + '&envVersion=release';
const MKT_QUERY = '?type=APPTYPE&chanel=ss&lang=zh';

const UA_MINI =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/144.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) ' +
  'NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) ' +
  'UnifiedPCWindowsWechat(0xf2541f38) XWEB/25819';
const UA_H5 = UA_MINI;

const REFERER_MINI = 'https://servicewechat.com/' + APPID + '/472/page-frame.html';
const REFERER_H5   = 'https://wxapi.csair.com/h5/sign/';

const API = {
  LOGIN:      '/mini/api/login/memberLogin',
  ACTIVITY:   '/marketing-tools/activity/load',
  JOIN:       '/marketing-tools/activity/join',
  CALENDAR:   '/marketing-tools/sign/getSignCalendarNew',
  AWARD_LIST: '/marketing-tools/award/awardList',
  RIGHTS:     '/marketing-tools/sign/rightsModule',
  PROGRESS:   '/marketing-tools/sign/getSignProgress',
  AWARD_CT:   '/marketing-tools/sign/getUserAwardContent',
};

const CODE = {
  OK: '0000',
  NEED_LOGIN: 'S0001',
  ALREADY: 'S2001',
  PARAM_EMPTY: '22306',
  LOGIN_FAIL: '22314',
  BAD_PASSWORD: '10053',   // 你输入的用户名,密码不匹配哟
  BAD_PARAM: '10400',
};

// ============================================================================
// 三、通用工具
// ============================================================================

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function envStr(name, def) {
  const v = process.env[name];
  if (v === undefined || v === null) return def;
  const s = String(v).trim();
  return s === '' ? def : s;
}
function envNum(name, def) {
  const s = envStr(name, '');
  if (s === '') return def;
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
}
function envFlag(name, def) {
  const s = envStr(name, '').toLowerCase();
  if (s === '') return def;
  return !['0', 'off', 'false', 'no', 'n'].includes(s);
}

const DEBUG   = envFlag(ENV_DEBUG, false);
const TIMEOUT = envNum(ENV_TIMEOUT, 20000);

function bj(ms) {
  const d = new Date((ms === undefined ? Date.now() : ms) + 8 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    h: d.getUTCHours(),
    mi: d.getUTCMinutes(),
    s: d.getUTCSeconds(),
    ymd: d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()),
    ym:  d.getUTCFullYear() + p(d.getUTCMonth() + 1),
    hms: p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()),
  };
}

function monthRange() {
  const t = bj();
  const last = new Date(Date.UTC(t.y, t.m, 0)).getUTCDate();
  const p = (n) => String(n).padStart(2, '0');
  return { start: t.ym + '01', end: t.ym + p(last) };
}

function mask(s, keep) {
  const t = String(s || '');
  const k = keep || 3;
  if (t.length <= k * 2) return t;
  return t.slice(0, k) + '*'.repeat(Math.min(6, t.length - k * 2)) + t.slice(-k);
}

/** 兜底脱敏：万一把响应原文带进日志/异常，先把姓名与证件抹掉 */
function scrub(s) {
  return String(s || '')
    .replace(/("cnFullName"\s*:\s*)"[^"]*"/g, '$1"***"')
    .replace(/("enFullName"\s*:\s*)"[^"]*"/g, '$1"***"')
    .replace(/("certNo"\s*:\s*)"[^"]*"/g, '$1"***"')
    .replace(/("mobile"\s*:\s*)"[^"]*"/g, '$1"***"');
}

// ============================================================================
// 四、HTTP
// ============================================================================

function rawRequest(o) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(o.url);
    } catch (e) {
      reject(new Error('URL 解析失败: ' + o.url));
      return;
    }
    const isHttp = u.protocol === 'http:';
    const mod = isHttp ? http : https;
    const headers = Object.assign({}, o.headers);
    const payload = o.body === undefined || o.body === null ? null : Buffer.from(o.body, 'utf8');
    if (payload) headers['Content-Length'] = payload.length;

    const req = mod.request(
      {
        hostname: u.hostname,
        port: u.port || (isHttp ? 80 : 443),
        path: u.pathname + (u.search || ''),
        method: o.method || 'GET',
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          let buf = Buffer.concat(chunks);
          const enc = String(res.headers['content-encoding'] || '').toLowerCase();
          try {
            if (enc.indexOf('gzip') >= 0) buf = zlib.gunzipSync(buf);
            else if (enc.indexOf('br') >= 0) buf = zlib.brotliDecompressSync(buf);
            else if (enc.indexOf('deflate') >= 0) buf = zlib.inflateSync(buf);
          } catch (e) { /* 解压失败用原文 */ }
          resolve({ status: res.statusCode, headers: res.headers, body: buf.toString('utf8') });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(o.timeoutMs || TIMEOUT, () => req.destroy(new Error('请求超时')));
    if (payload) req.write(payload);
    req.end();
  });
}

class AuthError extends Error {
  constructor(msg) {
    super(msg || '认证失败：登录凭证无效');
    this.auth = true;
  }
}

// ============================================================================
// 五、账号上下文 / 双通道鉴权
// ============================================================================

/** 解析 CSAIR_CK：允许整段 "cs1246643sso=xxx; TOKEN=yyy" */
function parseCk(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (s.indexOf('=') >= 0) {
    const m = s.match(/cs1246643sso=([^;\s]+)/i) || s.match(/TOKEN=([^;\s]+)/i);
    if (m) return m[1].trim();
    s = s.split(/[;\s]+/).filter(Boolean)[0] || '';
    if (s.indexOf('=') >= 0) s = s.split('=')[1] || '';
  }
  return s.trim();
}

/** 解析一条 CSAIR_ACCOUNT：手机号#密码#openId#unionId[#sessionid] */
function parseAccount(line) {
  const p = String(line).split('#').map((s) => s.trim());
  return {
    mobile: p[0] || '',
    password: p[1] || '',
    openId: p[2] || '',
    unionId: p[3] || '',
    sid: p[4] || '',
  };
}

function buildLoginBody(acc) {
  return JSON.stringify({
    userId: acc.mobile,
    password: acc.password,
    openId: acc.openId,
    unionId: acc.unionId,
    appId: APPID,
    channel: PLATFORM,
    entrance: 'WXMPG',
    activity: 'WXMPG',
    unitChannel: 'MAAAB4',
    activityChannel: 'XCX1',
    formId: 'requestFormId:fail deprecated',
    loginType: 0,
    onRiskControl: '0',
    clientType: 'microsoft microsoft',
  });
}

/**
 * 通道 B：会员号密码登录 → token
 * 需要 sessionid（网关会话，只能从抓包 headers 里取，见文件头第二节）
 */
async function login(acc, sid, log) {
  const url = 'https://' + HOST + API.LOGIN + API_QUERY;
  log('① 登录 ' + mask(acc.mobile, 3) + ' …（sessionid ' + (sid ? mask(sid, 12) : '缺失') + '）');

  const res = await rawRequest({
    url,
    method: 'POST',
    headers: {
      'User-Agent': UA_MINI,
      'content-type': 'application/json',
      accept: '*/*',
      channel: 'ecsair',
      xweb_xhr: '1',
      sessionid: sid || '',
      unnecessaryparam: acc.openId,
      referer: REFERER_MINI,
    },
    body: buildLoginBody(acc),
  });

  // 登录响应里带真名/证件，DEBUG 也不打印正文，只报状态与长度
  if (DEBUG) log('   HTTP ' + res.status + '（响应 ' + res.body.length + ' 字节，含个人隐私，不打印正文）');

  let data = null;
  try {
    data = JSON.parse(res.body);
  } catch (e) {
    throw new Error('登录响应不是 JSON（HTTP ' + res.status + '）：' + scrub(res.body.slice(0, 120)));
  }

  if (Array.isArray(data.memberList) && data.memberList.length) {
    const m = data.memberList[0];
    if (!m.token) throw new Error('登录返回无 token');
    return { token: m.token, member: m };
  }

  const code = String(data.code || '');
  const msg = String(data.message || data.errorMsg || '登录失败').replace(/\s+/g, ' ');
  if (/invalid session/i.test(res.body)) {
    throw new Error(
      '网关会话失效（invalid session）：sessionid 缺失或已过期。' +
      '请从抓包请求头里取 sessionid 填到 CSAIR_ACCOUNT 第 5 段，或改用 CSAIR_CK 通道'
    );
  }
  if (code === CODE.PARAM_EMPTY) throw new Error('登录参数缺失（' + msg + '）：openId / unionId 未填全');
  if (code === CODE.LOGIN_FAIL) throw new Error('登录失败（22314）：账号密码错误，或 openId/unionId 与该账号不匹配');
  if (code === CODE.BAD_PASSWORD) throw new Error('登录失败（10053）：' + msg + ' —— 手机号位数不对或密码错，请核对');
  if (code === CODE.BAD_PARAM) throw new Error('请求参数有误（10400）：包体不是明文 JSON 或头部异常');
  throw new Error('登录失败：' + code + ' ' + msg);
}

// ============================================================================
// 六、签到域请求层
// ============================================================================

function mktHeaders(token, method) {
  const h = {
    'User-Agent': UA_H5,
    accept: 'application/json, text/plain, */*',
    referer: REFERER_H5,
    origin: 'https://wxapi.csair.com',
    // ★ 鉴权只需这一个 cookie（见文件头第三节）
    cookie: 'cs1246643sso=' + token + '; TOKEN=' + token + '; channel=csair; csmbplogintype=5',
  };
  if (method !== 'GET') h['content-type'] = 'application/json';
  return h;
}

async function mkt(ctx, method, path, body, opts) {
  const o = opts || {};
  const url = /^https?:/.test(path) ? path : 'https://' + HOST + path;
  const headers = mktHeaders(ctx.token, method);
  const payload = method === 'GET' || body === undefined || body === null ? null : JSON.stringify(body);
  const retry = o.retry === undefined ? 2 : o.retry;

  let lastErr = null;
  for (let attempt = 0; attempt <= retry; attempt++) {
    let res;
    try {
      res = await rawRequest({ url, method, headers: Object.assign({}, headers), body: payload, timeoutMs: o.timeoutMs });
    } catch (e) {
      lastErr = e;
      if (attempt < retry) await sleep(800 + attempt * 900);
      continue;
    }
    if (DEBUG) ctx.log('   · ' + method + ' ' + path.split('?')[0] + ' → ' + res.status + ' ' + res.body.slice(0, 220));

    let data = null;
    try {
      data = JSON.parse(res.body);
    } catch (e) {
      lastErr = new Error('响应非 JSON（HTTP ' + res.status + '）：' + scrub(res.body.slice(0, 100)));
      if (attempt < retry) { await sleep(700); continue; }
      throw lastErr;
    }
    if (res.status === 401 || res.status === 403) throw new AuthError();
    const rc = String(data.respCode || '');
    if (rc === CODE.NEED_LOGIN) throw new AuthError('登录凭证为空（S0001）：CK 未携带或已失效');
    // 无效 CK 的真实返回是 S00011（5 位），别只认 S0001
    if (/^S0001\d/.test(rc)) throw new AuthError('获取用户登录信息失败（' + rc + '）：CK 已失效');
    // 畸形/失效票在日历接口上会直接 500，同样按「票有问题」处理
    if (res.status >= 500 || String(data.code || '') === '500') {
      const err = new Error('服务端 500（' + (data.message || 'Internal Server Error') + '）：多为 CK 畸形或已失效');
      err.retryLogin = true;
      throw err;
    }
    return data;
  }
  throw lastErr || new Error('请求失败：' + path);
}

// ============================================================================
// 七、业务
// ============================================================================

async function loadActivity(ctx) {
  const d = await mkt(ctx, 'POST', API.ACTIVITY + MKT_QUERY, { activityType: 'sign', channel: 'mini' });
  if (String(d.respCode) !== CODE.OK) throw new Error('活动装载失败：' + (d.respMsg || d.respCode));
  const list = (d.data && d.data.activityDtoList) || [];
  const item = list.find((x) => x.signActivity) || list[0];
  if (!item || !item.signActivity) throw new Error('活动装载成功但无 signActivity');
  const sa = item.signActivity;
  ctx.meta = {
    aid: d.data.aid || item.aid || '',
    uid: d.data.uid || item.uid || '',
    oneid: d.data.oneid || item.oneid || '',
    ffpTier: d.data.ffpTier || item.ffpTier || '',
    identifyStatus: d.data.identifyStatus || item.identifyStatus || '',
  };
  return sa;
}

async function loadCalendar(ctx) {
  const r = monthRange();
  const d = await mkt(ctx, 'GET', API.CALENDAR + MKT_QUERY + '&startQueryDate=' + r.start + '&endQueryDate=' + r.end);
  if (String(d.respCode) !== CODE.OK) throw new Error('日历查询失败：' + (d.respMsg || d.respCode));
  const data = d.data || {};
  let awards = [];
  try {
    awards = JSON.parse(data.awardDisplay || '[]');
  } catch (e) {
    awards = [];
  }
  return {
    signed: Array.isArray(data.dateList) ? data.dateList : [],
    firstSignDate: data.firstSignDate || null,
    awards,
  };
}

function todayAward(cal, today) {
  return (cal.awards || []).find((a) => a && a.dateOfAward === today) || null;
}

function awardText(a) {
  if (!a) return '';
  const map = { mileageAward: '里程', lotteryAward: '抽奖机会', otherAward: '实物/券' };
  const kind = map[a.prizeType] || a.prizeType || '';
  const num = Number(a.num || 0);
  return kind + (num > 0 ? ' +' + num : '');
}

function inSignWindow(range, force) {
  if (force) return { ok: true, why: '已忽略时间窗（CSAIR_FORCE）' };
  if (!range || typeof range !== 'string' || range.indexOf('-') < 0) return { ok: true, why: '' };
  const parts = range.split('-');
  const start = parts[0].trim();
  const end = parts[1].trim();
  const now = bj().hms;
  return {
    ok: now >= start && now <= end,
    why: '活动签到时间 ' + start + ' ~ ' + end + '，当前 ' + now,
  };
}

async function todayAwardRecord(ctx, today) {
  try {
    const d = await mkt(ctx, 'POST', API.AWARD_LIST + MKT_QUERY, {
      activityType: 'sign',
      awardStatus: 'all',
      pageNum: 1,
    });
    if (String(d.respCode) !== CODE.OK) return null;
    const list = (d.data && d.data.list) || [];
    return list.find((x) => x.rewardTime && bj(x.rewardTime).ymd === today) || null;
  } catch (e) {
    return null;
  }
}

// ============================================================================
// 七点五、token 本地缓存
// ============================================================================
//  账号密码通道每次都要 sessionid，而 sessionid 是抓包产物、会过期。
//  所以：登录成功一次就把 token 存本地，之后优先用缓存 token。
//  sessionid 死了、CK 没配，只要缓存里还有活 token，脚本照样能签到。

const fs = require('fs');
const path = require('path');

function cacheFile() {
  const custom = envStr('CSAIR_CACHE', '');
  if (custom) return custom;
  const dir = process.argv[1] ? path.dirname(process.argv[1]) : '.';
  return path.join(dir, '.csair_token.json');
}

function cacheLoad() {
  try {
    const f = cacheFile();
    if (!fs.existsSync(f)) return {};
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    return j && typeof j === 'object' ? j : {};
  } catch (e) {
    return {};
  }
}

function cacheGet(key) {
  const all = cacheLoad();
  const rec = all[key];
  if (!rec || !rec.token) return '';
  return rec.token;
}

function cacheSet(key, token, extra) {
  if (!token) return;
  try {
    const f = cacheFile();
    const all = cacheLoad();
    all[key] = Object.assign({ token, ts: Date.now() }, extra || {});
    fs.writeFileSync(f, JSON.stringify(all, null, 1), 'utf8');
  } catch (e) {
    if (DEBUG) console.log('[南航] 缓存写入失败: ' + (e && e.message));
  }
}

// ============================================================================
// 八、单账号执行
// ============================================================================

async function runAccount(item, cfg, idx) {
  const tag = '[南航#' + (idx + 1) + ']';
  const lines = [];
  const ctx = {
    token: '',
    log: (s) => console.log(tag + ' ' + s),
    out: (s) => { lines.push(s); console.log(tag + ' ' + s); },
    meta: {},
  };
  const today = bj().ymd;
  const res = { ok: false, lines, nick: '', mobileMask: '', tier: '', ckOut: '' };

  try {
    // ---- 0. 鉴权：缓存 token → CSAIR_CK → 账号密码登录 ----
    let member = null;
    const acc0 = item.account;
    const cacheKey = (acc0 && acc0.mobile) || ('ck' + idx);
    const doLogin = async () => {
      const acc = item.account;
      if (!acc || !acc.mobile || !acc.password) throw new Error('账号格式错误：至少需要 手机号#密码');
      if (!acc.openId || !acc.unionId) {
        throw new Error('缺少小程序身份：请按 手机号#密码#openId#unionId[#sessionid] 配置（openId/unionId 不可编造）');
      }
      const r = await login(acc, acc.sid || cfg.sid, ctx.log);
      ctx.token = r.token;
      member = r.member;
      cacheSet(cacheKey, r.token, { mobile: acc.mobile });
      ctx.log('   token ✓ ' + mask(r.token, 6) + '（已写入本地缓存）');
      // ★ 不打印完整 CK：缓存已自动落盘，日志里不留活凭据
      ctx.log('   ⇒ CK 已缓存（' + mask(r.token, 6) + '），无需手工保存');
      return r;
    };

    if (item.ck) {
      ctx.token = item.ck;
      ctx.log('① 使用 CSAIR_CK 直接鉴权（跳过登录）');
    } else {
      const cached = cacheGet(cacheKey);
      if (cached) {
        ctx.token = cached;
        ctx.log('① 使用本地缓存 token（' + (acc0 ? mask(acc0.mobile, 3) : 'ck' + idx) + '）');
      } else {
        await doLogin();
      }
    }

    // ---- 1. 活动装载 + 签到前日历（★ 日历才是 CK 存活探针，activity/load 是公开配置）----
    let sa = null;
    let calBefore = null;
    const prepare = async () => {
      sa = await loadActivity(ctx);
      calBefore = await loadCalendar(ctx);
    };
    try {
      await prepare();
    } catch (e) {
      const acc = item.account;
      const canLogin = !!(acc && acc.mobile && acc.password && acc.openId && acc.unionId);
      if ((e.auth || e.retryLogin) && canLogin) {
        ctx.log('   ⚠️ ' + e.message);
        ctx.log('   改用账号密码重新登录…');
        await doLogin();
        await prepare();
      } else {
        throw e;
      }
    }

    if (member) {
      // ★ 姓名一律不外显：日志与推送都不出现真名，只留脱敏手机号 + 卡号 + 等级
      const mobileMask = member['mobile-sensitive'] || mask(item.account.mobile, 3);
      const cardMask = member['cardNo-sensitive'] || '';
      ctx.log('   账号 ✓ ' + mobileMask +
        (cardMask ? ' / 明珠卡 ' + cardMask : '') + ' / 等级 ' + (member.loyaltyType || '?'));
      res.nick = '';
      res.mobileMask = mobileMask;
      res.cardMask = cardMask;
      res.tier = member.loyaltyType || '';
      res.mileageBefore = member.usefulMileage !== undefined ? Number(member.usefulMileage) : null;
    } else {
      res.mileageBefore = null;
    }

    const activityId = sa.activityId;
    const actName = sa.activityName || '天天签到';
    const period = (sa.startDate || '?') + ' ~ ' + (sa.endDate || '?');
    ctx.log('② 活动 ✓ ' + actName + '（id=' + activityId + '，' + period + '，' + (sa.status || '?') + '）');
    if (ctx.meta.ffpTier) ctx.log('   会员等级 ' + ctx.meta.ffpTier + '｜实名 ' + (ctx.meta.identifyStatus || '?'));

    if (String(sa.status) !== 'enable') throw new Error('活动未开启（status=' + sa.status + '），本期可能已结束');
    if (sa.startDate && today < sa.startDate) throw new Error('本期活动未开始（' + sa.startDate + ' 起）');
    if (sa.endDate && today > sa.endDate) throw new Error('本期活动已结束（' + sa.endDate + ' 止）');
    // 注意：activity/load 的 identifyStatus 是布尔 true/false，member 接口里是 'Y'/'N'，两种都要认
    const identRaw = ctx.meta.identifyStatus;
    const identified = identRaw === true || identRaw === 'true' || identRaw === 'Y' ||
      identRaw === 1 || identRaw === '1';
    if (sa.needIdentify === true && identRaw !== '' && identRaw !== null && identRaw !== undefined && !identified) {
      throw new Error('账号未实名（identifyStatus=' + identRaw + '），活动要求实名后才能签');
    }

    // ---- 2. 签到前状态 ----
    const alreadySigned = calBefore.signed.indexOf(today) >= 0;
    ctx.log('③ 今日 ' + today + '：' + (alreadySigned ? '已签到' : '未签到') +
      '｜本月已签 ' + calBefore.signed.length + ' 天');
    const ta = todayAward(calBefore, today);
    if (ta) ctx.log('   今日奖励：' + awardText(ta) + (ta.isGain ? '（已获得）' : '（未发放）'));

    // ---- 3. 签到 ----
    let joinMsg = '';
    let joinCode = '';
    let joinedNow = false;

    if (cfg.mode === 'probe') {
      ctx.log('④ 体检模式：不执行签到');
    } else if (alreadySigned) {
      ctx.log('④ 今天已经签过，跳过 join');
      joinCode = CODE.ALREADY;
      joinMsg = '今天已经签到';
    } else {
      const w = inSignWindow(sa.signTimeRange, cfg.force);
      if (!w.ok) throw new Error('不在签到时间窗内（' + w.why + '），请把定时任务排在 08:00 之后');
      if (w.why) ctx.log('   ' + w.why);

      let lastErr = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const d = await mkt(ctx, 'POST', API.JOIN + MKT_QUERY, {
            activityType: 'sign',
            channel: 'mini',
            entrance: 1,
          });
          joinCode = String(d.respCode || '');
          if (joinCode === CODE.OK) {
            joinMsg = (d.data && d.data.result) || '签到成功';
            joinedNow = true;
            break;
          }
          if (joinCode === CODE.ALREADY) {
            joinMsg = d.respMsg || '今天已经签到';
            break;
          }
          lastErr = new Error(d.respMsg || ('签到失败：' + joinCode));
        } catch (e) {
          if (e.auth) throw e;
          lastErr = e;
        }
        if (attempt === 0) await sleep(1500 + randInt(0, 1200));
      }
      if (!joinedNow && joinCode !== CODE.ALREADY) throw lastErr || new Error('签到失败');
      if (joinedNow) ctx.log('④ join → ' + joinMsg);
    }

    // ---- 4. 对账 ----
    const calAfter = await loadCalendar(ctx);
    const signedNow = calAfter.signed.indexOf(today) >= 0;
    const gainAward = todayAward(calAfter, today);

    if (cfg.mode === 'probe') {
      ctx.out('   [体检] ' + (signedNow ? '今日已签' : '今日未签') +
        '｜本月 ' + calAfter.signed.length + ' 天');
    } else if (signedNow) {
      const rec = await todayAwardRecord(ctx, today);
      const statusText = rec && rec.awardStatus
        ? (rec.awardStatus === 'waitReceive' ? '待发放（72h 内自动到账）'
          : rec.awardStatus === 'received' ? '已到账'
            : rec.awardStatus)
        : '';
      ctx.out(joinedNow ? '✅ 签到成功：' + joinMsg : '✅ 今日已签到（无需重复）');
      if (gainAward && Number(gainAward.num) > 0) {
        ctx.out('   奖励：' + awardText(gainAward) + (statusText ? '｜' + statusText : ''));
      } else if (statusText) {
        ctx.out('   奖励状态：' + statusText);
      }
      try {
        const pg = await mkt(ctx, 'GET', API.PROGRESS + MKT_QUERY);
        if (String(pg.respCode) === CODE.OK && pg.data && pg.data.signSerial) {
          ctx.out('   连续签到：' + pg.data.signSerial + ' 天');
        }
      } catch (e) { /* ignore */ }
      ctx.out('   本月已签 ' + calAfter.signed.length + ' 天');
    } else {
      throw new Error('签到接口返回成功，但日历里仍没有今日记录，请手动核对');
    }

    // ---- 5. 连签奖励提示 ----
    try {
      const ac = await mkt(ctx, 'GET', API.AWARD_CT + MKT_QUERY);
      if (String(ac.respCode) === CODE.OK && Array.isArray(ac.data)) {
        const pend = ac.data.filter((x) => x && x.awardStatus === 'notComplete');
        if (pend.length) {
          ctx.log('   连签奖励（未达成）：' +
            pend.map((x) => '第' + (x.signDay || '?') + '天 ' + (x.awardName || '')).join('，'));
        }
      }
    } catch (e) { /* 锦上添花 */ }

    res.ok = (joinCode === CODE.OK || joinCode === CODE.ALREADY || cfg.mode === 'probe');
  } catch (e) {
    if (e && e.auth) {
      ctx.out('⛔ 登录凭证失效：' + e.message);
      ctx.out('   请重新抓包更新 CSAIR_CK（或补 sessionid 走账号密码通道）');
    } else {
      ctx.out('⛔ ' + (e && e.message ? e.message : e));
    }
    res.ok = false;
  }

  return res;
}

// ============================================================================
// 九、青龙适配 / 入口
// ============================================================================

function loadConfig() {
  const cks = String(envStr(ENV_CK, ''))
    .split(/[\n]+/).map((s) => s.trim()).filter(Boolean).map(parseCk);

  const accs = String(envStr(ENV_ACCOUNT, ''))
    .split(/[\n]+/).map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#'))
    .map(parseAccount);

  const n = Math.max(cks.length, accs.length);
  const items = [];
  for (let i = 0; i < n; i++) {
    items.push({ ck: cks[i] || '', account: accs[i] || null });
  }

  let mode = envStr(ENV_MODE, 'all').toLowerCase();
  if (['all', 'sign', 'probe'].indexOf(mode) < 0) mode = 'all';

  return {
    items,
    mode,
    sid: envStr(ENV_SID, ''),
    delay: envStr(ENV_DELAY, '6-15'),
    tag: envStr(ENV_TAG, ''),
    notify: envFlag(ENV_NOTIFY, true),
    force: envFlag(ENV_FORCE, false),
  };
}

function delayRange(s) {
  const m = String(s || '').match(/^(\d+)\s*-\s*(\d+)$/);
  if (m) return [Number(m[1]), Number(m[2])];
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? [n, n] : [6, 15];
}

function argMode() {
  const allow = ['all', 'sign', 'probe'];
  for (const a of process.argv.slice(2)) {
    const m = String(a).toLowerCase().replace(/^--?/, '').replace(/^mode=/, '');
    if (allow.indexOf(m) >= 0) return m;
  }
  return '';
}

async function sendNotify(title, body) {
  const cands = [];
  if (process.env.QL_DIR) cands.push(process.env.QL_DIR + '/scripts/sendNotify.js');
  cands.push(
    '/ql/scripts/sendNotify.js',
    '/ql/data/scripts/sendNotify.js',
    '/ql/data/scripts/sendNotify/index.js',
    './sendNotify.js',
    '../sendNotify.js'
  );
  for (const c of cands) {
    let mod = null;
    try {
      mod = require(c);
    } catch (e) {
      continue;
    }
    const fn = typeof mod === 'function' ? mod : mod && (mod.sendNotify || mod.default);
    if (typeof fn !== 'function') continue;
    try {
      const r = fn(title, body);
      if (r && typeof r.then === 'function') await r;
      console.log('[南航] 🔔 通知已发送（sendNotify）');
      return true;
    } catch (e) {
      console.log('[南航] ⚠️ sendNotify 失败: ' + (e && e.message));
    }
  }
  console.log('[南航] ⚠️ 未找到 sendNotify.js，跳过推送');
  return false;
}

async function main() {
  const cfg = loadConfig();
  const am = argMode();
  if (am) cfg.mode = am;

  console.log('============ 南方航空 · 天天签到 ============');
  console.log('时间 ' + bj().ymd + ' ' + bj().hms + '（UTC+8）｜模式 ' + cfg.mode);

  if (!cfg.items.length) {
    console.log('[南航] ❌ 缺少环境变量 CSAIR_CK 或 CSAIR_ACCOUNT');
    console.log('[南航]    A 通道：CSAIR_CK = cs1246643sso 的值');
    console.log('[南航]    B 通道：CSAIR_ACCOUNT = 手机号#密码#openId#unionId[#sessionid]');
    return;
  }
  console.log('[南航] 共 ' + cfg.items.length + ' 个账号\n');

  const all = [];
  const [dmin, dmax] = delayRange(cfg.delay);

  for (let i = 0; i < cfg.items.length; i++) {
    all.push(await runAccount(cfg.items[i], cfg, i));
    console.log('');
    if (i < cfg.items.length - 1) {
      const wait = randInt(dmin, dmax);
      console.log('[南航] ⏳ ' + wait + 's 后处理下一个账号…\n');
      await sleep(wait * 1000);
    }
  }

  const okCount = all.filter((r) => r.ok).length;
  const title = (okCount === all.length ? '✅ 南航签到 ' : '⚠️ 南航签到 ') +
    okCount + '/' + all.length + (cfg.tag ? '（' + cfg.tag + '）' : '');

  const body = [];
  all.forEach((r, i) => {
    body.push('【账号' + (i + 1) + '】' + (r.ok ? '成功' : '失败'));
    if (r.mobileMask || r.tier) {
      body.push('　' + [r.mobileMask, r.tier ? '等级' + r.tier : ''].filter(Boolean).join(' '));
    }
    r.lines.forEach((l) => body.push('　' + l.replace(/^\s*/, '')));
    body.push('');
  });

  if (cfg.notify) {
    console.log('========== 推送正文 ==========\n' + body.join('\n'));
    await sendNotify(title, body.join('\n'));
  } else {
    console.log('\n[南航] 汇总: ' + title);
  }
}

main().catch((e) => {
  console.log('[南航] ⛔ 未捕获异常: ' + (e && e.stack ? e.stack : e));
});
