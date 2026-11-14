#!/usr/bin/env node
/* -------------------------------------------------------------------------
 *  项目名称：活力伊利（每日签到 + 0 元抽奖）
 *  脚本文件：yili_daily.js
 *  更新说明：
 *    2026-11-14  Mist  仓库首发：签到 + 抽奖 + 积分回显，推送版式对齐 iPhone 气泡宽度
 * -------------------------------------------------------------------------
 */
/**
 * ============================================================================
 *  活力伊利（伊利数字化会员小程序 · 活力伊利）每日签到 + 0 元抽奖
 *  目标：微信小程序 wx06af0ef532292cd3 / 线上包 928
 *  网关：https://msmarket.msx.digitalyili.com/gateway/api
 *  版本：v2.0（青龙面板 / 本地 Node 直跑通用，推送版式对齐龙湖天街）
 * ============================================================================
 *
 *  【青龙怎么配】
 *    必需：yili_ck        access-token（抓包一次，数小时～数天有效，过期重抓）
 *                        多账号换行或 & 分隔，支持「备注#token」
 *    可选：yili_activity  抽奖活动 ID，默认 2115990186556080130
 *          yili_draw      单号最多抽几次，默认 5（真实上限看活动剩余次数）
 *          yili_push      on / off / dry，默认 on
 *          yili_push_style simple（默认，一条看完）/ full（每号一段，排错用）
 *          TYpush         on / off，推送总开关
 *          yili_delay     多账号间隔秒数，默认 3-8
 *          yili_debug     on / off，打印真实请求路径
 *
 *    定时： 20 11 * * *   任务名：活力伊利签到     命令：task yili_daily.js
 *
 *  【链路要点】（详见 REPORT-伊利逆向.md）
 *    1. 鉴权只有一个头 access-token，没有 sign / nonce / 时间戳签名，
 *       固定配套头 tenant-id / scene / referer / user-agent / xweb_xhr。
 *    2. 响应信封是 base64(JSON)：{"contextId","status","data","error"}，
 *       判定看 status===true 且 error===null，别只看 HTTP 200。
 *    3. member/* 与 upgrade/lottery/luckDraw 在小程序里被 override 成
 *       微信云托管 callContainer；公网直连会被腾讯云 WAF 403。
 *       脚本用「末段双斜杠 → 首段双斜杠」两档降级绕过 WAF 路径规则。
 *    4. 签到 POST 返回 status:true + 奖励明细，但 sign/status、sign/list、
 *       point/info 都不变（写操作依赖云托管注入的 openid/unionid）。
 *       所以签到判定是三级复核：状态 → 签到日历 → 积分增长，
 *       全都对不上就如实报「已提交·未落库」，绝不谎报成功。
 *    5. 抽奖走 GET luckDraw，官方前端会先取网易易盾 token；
 *       实测不校验（传空串也能走到业务判断），所以不接易盾 SDK。
 * ============================================================================
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const crypto = require('crypto');

// ============================================================================
// 一、配置
// ============================================================================

const ENV = {
    ck: 'yili_ck', ckAlt: 'YILI_CK',
    act: 'yili_activity', draw: 'yili_draw',
    push: 'yili_push', style: 'yili_push_style',
    ty: 'TYpush', delay: 'yili_delay', debug: 'yili_debug', check: 'yili_check',
};

const HOST = 'msmarket.msx.digitalyili.com';
const BASE = '/gateway/api';
const TENANT = '1559474730809618433';
const APPID = 'wx06af0ef532292cd3';
const APP_VER = '928';
const SCENE = '1256';
const DEFAULT_ACT = '2115990186556080130';

const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/144.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI ' +
    'MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) ' +
    'UnifiedPCWindowsWechat(0xf2541f38) XWEB/25819';

const DEBUG = /^(1|on|true|yes|y)$/i.test(String(process.env[ENV.debug] || '').trim());
const on = (name, dft) => !/^(0|off|false|no|n)$/i.test(
    String(process.env[name] === undefined ? (dft === undefined ? 'on' : dft) : process.env[name]).trim()
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// ============================================================================
// 二、排版小件（中文按 2 列宽算）
// ============================================================================

function strWidth(s) {
    let w = 0;
    for (const ch of String(s)) {
        const c = ch.codePointAt(0);
        if ((c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0x303e) ||
            (c >= 0x3041 && c <= 0x33ff) || (c >= 0x3400 && c <= 0x4dbf) ||
            (c >= 0x4e00 && c <= 0x9fff) || (c >= 0xa000 && c <= 0xa4cf) ||
            (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) ||
            (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) ||
            (c >= 0xffe0 && c <= 0xffe6) || (c >= 0x1f300 && c <= 0x1f9ff) ||
            (c >= 0x2600 && c <= 0x27bf)) { w += 2; } else { w += 1; }
    }
    return w;
}

const padR = (s, n) => { s = String(s); const d = n - strWidth(s); return s + ' '.repeat(d > 0 ? d : 0); };

/** 按显示宽度截断 */
function ellip(s, width) {
    const t = String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim();
    if (strWidth(t) <= width) return t;
    let out = ''; let w = 0;
    for (const ch of t) {
        const cw = strWidth(ch);
        if (w + cw > width - 2) break;
        out += ch; w += cw;
    }
    return out.replace(/[\s·,，、:：+\-]+$/, '') + '…';
}

const NUM_CIRCLE = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
const PUSH_W = 34;   // iPhone 微信气泡 ≈17 个汉字，34 半角最稳
const PUSH_W_SUM = 32;
const BADGE = { ok: '✅', already: '💤', pending: '⏳', fail: '❌', dead: '🔑' };

const pad2 = (n) => (String(n).length < 2 ? '0' + n : String(n));
const stampOf = (d) => pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());

/** 按段折行：段之间用 " · " 连，只在段边界断，绝不切字 */
function wrapSegs(segs, width, indent) {
    const pad = new Array((indent || 0) + 1).join(' ');
    const limit = (width || PUSH_W) - (indent || 0);
    const list = segs.filter((x) => x !== '' && x !== null && x !== undefined);
    const out = [];
    let cur = '';
    for (const seg of list) {
        const join = cur ? ' · ' + seg : seg;
        if (cur && strWidth(cur + join) > limit) { out.push(cur); cur = seg; }
        else { cur += join; }
    }
    if (cur) out.push(cur);
    return out.map((ln) => pad + ln);
}

/** 手机号打码兜底 */
const scrubPhones = (s) => String(s).replace(/(^|[^\d])(1[3-9]\d)\d{4}(\d{4})(?!\d)/g, '$1$2****$3');
const maskToken = (t) => { const s = String(t || ''); return s.length <= 10 ? (s ? s.slice(0, 2) + '****' : '(空)') : s.slice(0, 6) + '****' + s.slice(-4); };

// ============================================================================
// 三、文件定位（本地分层目录 / 青龙扁平上传都能命中）
// ============================================================================

function resolveFile(names) {
    const dirs = [__dirname, path.join(__dirname, '..'), path.join(__dirname, '..', '..')];
    if (process.env.QL_DIR) dirs.push(path.join(process.env.QL_DIR, 'scripts'));
    dirs.push('/ql/data/scripts', '/ql/scripts');
    for (const d of dirs) {
        for (const n of names) {
            try {
                const p = path.resolve(d, n);
                if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
            } catch (e) { /* ignore */ }
        }
    }
    return '';
}

// ============================================================================
// 四、HTTP + WAF 归一化绕过
// ============================================================================

function httpRaw(method, apiPath, opt) {
    opt = opt || {};
    const body = opt.body === undefined || opt.body === null ? null : JSON.stringify(opt.body);
    const headers = {
        'access-token': opt.token || '',
        'tenant-id': TENANT,
        scene: SCENE,
        'content-type': 'application/json',
        accept: '*/*',
        'user-agent': UA,
        'atv-page': '',
        'forward-appid': '',
        'source-type': '',
        'register-source': '',
        xweb_xhr: '1',
        referer: 'https://servicewechat.com/' + APPID + '/' + APP_VER + '/page-frame.html',
        'accept-language': 'zh-CN,zh;q=0.9',
    };
    if (body !== null) headers['content-length'] = Buffer.byteLength(body);

    return new Promise((resolve) => {
        const req = https.request({ host: HOST, path: BASE + apiPath, method, headers }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                let buf = Buffer.concat(chunks);
                try {
                    const enc = String(res.headers['content-encoding'] || '');
                    if (enc.indexOf('gzip') >= 0) buf = zlib.gunzipSync(buf);
                    else if (enc.indexOf('br') >= 0) buf = zlib.brotliDecompressSync(buf);
                    else if (enc.indexOf('deflate') >= 0) buf = zlib.inflateSync(buf);
                } catch (e) { /* raw */ }
                resolve({ status: res.statusCode, text: buf.toString('utf8') });
            });
        });
        req.on('error', (e) => resolve({ status: 0, text: 'ERR ' + e.message }));
        req.setTimeout(15000, () => { req.destroy(); resolve({ status: 0, text: 'TIMEOUT' }); });
        if (body !== null) req.write(body);
        req.end();
    });
}

/** /member/sign/status → /member/sign//status */
function bypassLast(apiPath) {
    const q = apiPath.indexOf('?');
    const p = q === -1 ? apiPath : apiPath.slice(0, q);
    const qs = q === -1 ? '' : apiPath.slice(q);
    const segs = p.split('/');
    if (segs.length < 2) return apiPath;
    const last = segs.pop();
    return segs.join('/') + '//' + last + qs;
}

/** /member/sign/status → /member//sign/status */
function bypassFirst(apiPath) {
    const q = apiPath.indexOf('?');
    const p = q === -1 ? apiPath : apiPath.slice(0, q);
    const qs = q === -1 ? '' : apiPath.slice(q);
    const segs = p.split('/').filter(Boolean);
    if (!segs.length) return apiPath;
    return '/' + segs[0] + '//' + segs.slice(1).join('/') + qs;
}

/** 解响应信封：优先 base64(JSON)，兜底裸 JSON */
function parseEnvelope(text) {
    let t = String(text || '').trim();
    if (!t) return null;
    if (t.charAt(0) !== '{') {
        try {
            const dec = Buffer.from(t, 'base64').toString('utf8');
            if (dec.trim().charAt(0) === '{') t = dec.trim();
        } catch (e) { /* ignore */ }
    }
    try { return JSON.parse(t); } catch (e) { return null; }
}

/**
 * 统一请求：原路径 → 末段双斜杠 → 首段双斜杠，WAF 403 自动降级
 * 返回 { http, ok, data, err, path, bypass }
 */
async function api(token, apiPath, opt) {
    opt = opt || {};
    const method = opt.method || 'GET';
    const candidates = [apiPath];
    const b1 = bypassLast(apiPath);
    const b2 = bypassFirst(apiPath);
    if (b1 !== apiPath) candidates.push(b1);
    if (b2 !== apiPath && b2 !== b1) candidates.push(b2);

    for (let i = 0; i < candidates.length; i++) {
        const p = candidates[i];
        const r = await httpRaw(method, p, { token: token, body: opt.body });
        const waf = r.status === 403 || /WAF拦截页面|waf\.qq\.com/.test(r.text || '');
        if (DEBUG) console.log('      › ' + method + ' ' + p + ' → ' + r.status + (waf ? ' WAF' : ''));
        if (waf) {
            if (i < candidates.length - 1) continue;
            return { http: 403, ok: false, data: null, err: { code: 403, msg: 'WAF 拦截（两档写法均未通过）' }, path: p, bypass: i > 0 };
        }
        if (r.status === 0) return { http: 0, ok: false, data: null, err: { code: 0, msg: r.text }, path: p, bypass: i > 0 };
        const j = parseEnvelope(r.text);
        if (!j) return { http: r.status, ok: false, data: null, err: { code: r.status, msg: String(r.text || '').slice(0, 60) }, path: p, bypass: i > 0 };
        const ok = !!(j.status === true || j.success === true);
        const err = j.error ? { code: j.error.code, msg: j.error.msg } : null;
        return { http: r.status, ok: ok, data: j.data, err: err, path: p, bypass: i > 0 };
    }
    return { http: 0, ok: false, data: null, err: { code: -1, msg: '未知' }, path: apiPath, bypass: false };
}

// ============================================================================
// 五、接口表
// ============================================================================

const API = {
    userInfo: '/auth/account/user/info',
    signConfig: '/member/sign/config',
    signStatus: '/member/sign/status',
    signList: '/member/sign/list',
    sign: '/member/daily/sign?isUseNewLogic=1',
    point: '/member/point/info',
    level: '/member/level/info',
    lotteryDetail: (id) => '/upgrade/lottery/detail?activityId=' + encodeURIComponent(id),
    luckDraw: (id) => '/upgrade/lottery/luckDraw?activityId=' + encodeURIComponent(id) + '&yidunSdkToken=',
};

const doUserInfo = (t) => api(t, API.userInfo, { method: 'GET' });
const doSignStatus = (t) => api(t, API.signStatus, { method: 'GET' });
const doSign = (t) => api(t, API.sign, { method: 'POST', body: {} });
const doSignList = (t, dates) => api(t, API.signList, { method: 'POST', body: { signDates: dates, useNewLogic: true } });
const doPoint = (t) => api(t, API.point, { method: 'GET' });
const doLevel = (t) => api(t, API.level, { method: 'GET' });
const doLottery = (t, id) => api(t, API.lotteryDetail(id), { method: 'GET' });
const doDraw = (t, id) => api(t, API.luckDraw(id), { method: 'GET' });

// ============================================================================
// 六、单账号流程
// ============================================================================

const maskMobile = (m) => (m ? String(m).replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '未绑定');

/** 本周 7 天 yyyyMMdd 整数，sign/list 只认这种格式 */
function weekDates() {
    const out = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        out.push(+(String(d.getFullYear()) + pad2(d.getMonth() + 1) + pad2(d.getDate())));
    }
    return out;
}

/** 签到三级复核：sign/status → sign/list 日历 → 积分增长 */
async function verifySign(ck, pointBefore) {
    await sleep(1200);
    const st = await doSignStatus(ck.token);
    if (st.ok && st.data && st.data.signed === true) {
        return { state: 'ok', note: '连签 ' + (st.data.signedDays || 0) + ' 天' };
    }
    const cal = await doSignList(ck.token, weekDates());
    if (cal.ok && Array.isArray(cal.data) && cal.data.some((x) => x && x.signed === true)) {
        return { state: 'ok', note: '日历已落记录' };
    }
    const pt = await doPoint(ck.token);
    const now = pt.ok && pt.data ? pt.data.totalPoint : null;
    if (pointBefore !== null && now !== null && now > pointBefore) {
        return { state: 'ok', note: '积分 +' + (now - pointBefore) + ' 已到账', point: now };
    }
    return { state: 'pending', note: '回报已收，服务端未落库', point: now };
}

async function runAccount(ck, idx, total, opt) {
    const tag = '[' + (idx + 1) + '/' + total + ']';
    const r = {
        name: ck.remark || '', nick: '', mobile: '', token: ck.token,
        status: 'fail', msg: '', signNote: '', reward: '',
        pointBefore: null, pointAfter: null, draws: 0, prizes: [], drawNote: '',
    };

    // 1. 会员资料（顺带验 token）
    const u = await doUserInfo(ck.token);
    if (!u.ok) {
        r.status = (u.err && u.err.code === 401) || u.http === 401 ? 'dead' : 'fail';
        r.msg = u.err ? (u.err.code + ' ' + u.err.msg) : '资料读取失败';
        console.log('  ' + tag + ' ✗ ' + r.msg + (r.status === 'dead' ? '（token 失效，重抓）' : ''));
        return r;
    }
    r.nick = (u.data && u.data.nickName) || '(无昵称)';
    r.mobile = maskMobile(u.data && u.data.mobile);
    if (!r.name) r.name = r.nick;
    console.log('  ' + tag + ' ' + r.nick + '  ' + r.mobile);

    // 2. 基线
    const pt0 = await doPoint(ck.token);
    if (pt0.ok && pt0.data) r.pointBefore = pt0.data.totalPoint;
    const st0 = await doSignStatus(ck.token);

    // 3. 签到
    if (st0.ok && st0.data && st0.data.signed === true) {
        r.status = 'already';
        r.signNote = '连签 ' + (st0.data.signedDays || 0) + ' 天';
        console.log('    签到 💤 今日已签（' + r.signNote + '）');
    } else {
        const sg = await doSign(ck.token);
        if (!sg.ok) {
            r.status = 'fail';
            r.msg = '签到失败 ' + (sg.err ? (sg.err.code + ' ' + sg.err.msg) : '未知');
            console.log('    签到 ❌ ' + r.msg);
        } else {
            const d = sg.data || {};
            const daily = d.dailySign || {};
            const cont = d.continuationSign || {};
            const rw = [];
            if (daily.bonusPoint) rw.push('+' + daily.bonusPoint + '积分');
            if (daily.bonusGrowth) rw.push('+' + daily.bonusGrowth + '成长');
            if (cont.bonusPoint) rw.push('连签+' + cont.bonusPoint + '积分');
            r.reward = rw.join('');
            const v = await verifySign(ck, r.pointBefore);
            r.status = v.state;
            r.signNote = (v.note || '');
            if (v.state === 'ok') {
                console.log('    签到 ✅ ' + (r.reward ? r.reward + '，' : '') + r.signNote);
            } else {
                console.log('    签到 ⏳ ' + (r.reward ? '回报' + r.reward + '，' : '') + r.signNote);
            }
        }
    }

    // 4. 抽奖
    const act = await doLottery(ck.token, opt.activity);
    if (!act.ok) {
        r.drawNote = '活动读取失败';
        console.log('    抽奖 ❌ ' + r.drawNote);
    } else {
        const d = act.data || {};
        const left = Number(d.luckyDrawNumber || 0);
        const awardMap = {};
        (d.awardsVo || []).forEach((a) => { awardMap[String(a.id)] = a.name; });
        const limit = Math.min(left, opt.drawMax);
        console.log('    活动 ' + ellip(d.title || '', 30) + '  剩余 ' + left + ' 次');
        if (d.memberTagVerifyFail) console.log('         · 未过活动会员标签校验，抽奖可能被拒');
        if (limit <= 0) {
            r.drawNote = left > 0 ? '已到抽奖上限' : '今日无次数';
        } else {
            for (let i = 0; i < limit; i++) {
                if (i > 0) await sleep(randInt(1200, 2400));
                const dr = await doDraw(ck.token, opt.activity);
                if (dr.ok) {
                    const pz = dr.data || {};
                    const name = pz.name || pz.prizeName || awardMap[String(pz.id || '')] || ('奖品' + (pz.id || '?'));
                    r.draws += 1;
                    r.prizes.push(name);
                    console.log('    第' + (i + 1) + '抽 🎁 ' + name);
                } else {
                    const e = dr.err || {};
                    if (e.code === 409 || e.code === 410) r.drawNote = '次数已用完';
                    else if (e.code === 429) r.drawNote = '风控限流';
                    else r.drawNote = ellip((e.code || '-') + ' ' + (e.msg || '抽奖失败'), 18);
                    console.log('    第' + (i + 1) + '抽 · ' + r.drawNote);
                    break;
                }
            }
            if (!r.drawNote && r.draws > 0) r.drawNote = '';
        }
    }

    // 5. 收尾
    const pt2 = await doPoint(ck.token);
    if (pt2.ok && pt2.data) r.pointAfter = pt2.data.totalPoint;
    if (r.status === 'fail' && r.msg) r.signNote = r.signNote || r.msg;
    return r;
}

// ============================================================================
// 七、token 解析
// ============================================================================

const TOKEN_FILES = ['yili_token.json', '.yili_token.json'];

// 青龙侧 token 只有值、没有抓包时间：首次运行记一笔，之后就能算"已存活多久"
const SEEN_FILE = path.join(__dirname, '.yili_ck_seen.json');
function readSeen() { try { return JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8')); } catch (e) { return {}; } }
function writeSeen(o) { try { fs.writeFileSync(SEEN_FILE, JSON.stringify(o, null, 1), 'utf8'); } catch (e) { /* 只读环境就算了 */ } }
function seenKey(t) { return crypto.createHash('sha256').update(String(t)).digest('hex').slice(0, 12); }
/** 给没有 at 的 token 补一个首次看见时间 */
function stampFirstSeen(list) {
    const seen = readSeen();
    let dirty = false;
    for (const a of list) {
        if (a.at) continue;
        const k = seenKey(a.token);
        if (!seen[k]) { seen[k] = new Date().toISOString(); dirty = true; }
        a.at = seen[k];
        a.firstSeen = seen[k];
    }
    if (dirty) writeSeen(seen);
    return list;
}

function loadTokens() {
    const raw = String(process.env[ENV.ck] || process.env[ENV.ckAlt] || '').trim();
    if (!raw) {
        const f = resolveFile(TOKEN_FILES);
        if (f) {
            try {
                const j = JSON.parse(fs.readFileSync(f, 'utf8'));
                const list = Array.isArray(j) ? j : (j.accounts || [j]);
                return stampFirstSeen(list.map((x) => ({
                    token: String(x.token || x.accessToken || '').trim(),
                    remark: x.remark || x.nick || '',
                    at: x.at || '',
                })).filter((x) => x.token));
            } catch (e) { /* ignore */ }
        }
        return [];
    }
    const out = [];
    raw.split(/[\r\n&]+/).map((s) => s.trim()).filter(Boolean).forEach((line) => {
        let remark = '';
        let token = line;
        const m = line.match(/^([^#]{1,24})#(.+)$/);
        if (m && !/^[A-Za-z0-9+/=]{20,}$/.test(m[1])) { remark = m[1].trim(); token = m[2].trim(); }
        out.push({ token: token, remark: remark, at: '' });
    });
    return stampFirstSeen(out);
}

// ============================================================================
// 八、推送（版式对齐龙湖天街：一条消息看完，手机不乱折）
// ============================================================================

function countBy(results) {
    const c = { ok: 0, already: 0, pending: 0, dead: 0, fail: 0 };
    for (const r of results) if (c[r.status] !== undefined) c[r.status] += 1;
    return c;
}

function statusWord(r) {
    if (r.status === 'ok') return '签到成功';
    if (r.status === 'already') return '今日已签';
    if (r.status === 'pending') return '已提交待落库';
    if (r.status === 'dead') return '登录失效';
    return '执行异常';
}

/** 抽奖段的短句 */
function drawBit(r) {
    if (r.draws > 0) return '抽奖' + r.draws + '次:' + r.prizes.join('/');
    return '抽奖·' + (r.drawNote || '无次数');
}

/**
 * 简洁版（默认，按 iPhone 微信气泡折算 34 列）
 *   标题 / 摘要 / 每号两行 / 积分余额 / 需要处理时才有的提示
 * 设计取舍：不用长分隔线（iOS 必折行）、不在每号重复积分（单号时只出现在余额行）、
 *          耗时不进推送（只在终端显示）、手机号一律打码。
 */
function buildPushTextSimple(results, meta) {
    meta = meta || {};
    const c = countBy(results);
    const good = c.ok + c.already;
    const draws = results.reduce((s2, r) => s2 + (r.draws || 0), 0);
    const ptSum = results.reduce((s2, r) => s2 + (r.pointAfter !== null ? r.pointAfter : (r.pointBefore === null ? 0 : r.pointBefore)), 0);
    const dPt = results.reduce((s2, r) => s2 + ((r.pointBefore !== null && r.pointAfter !== null) ? (r.pointAfter - r.pointBefore) : 0), 0);
    const L = [];
    const now = new Date();

    // ① 标题
    L.push('🥛 活力伊利 ' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate()));

    // ② 摘要：正常数 + 有抽奖才提
    const sum = ['✅ ' + good + '/' + results.length + ' 正常'];
    if (draws > 0) sum.push('🎁 抽 ' + draws + ' 次');
    wrapSegs(sum, PUSH_W_SUM, 0).forEach(function (ln) { L.push(ln); });

    // ③ 每个号两行：名字+徽标 / 明细
    L.push('');
    results.forEach(function (r, i) {
        const num = NUM_CIRCLE[i] || (i + 1) + '.';
        L.push(num + ' ' + (r.name || maskToken(r.token)) + ' ' + (BADGE[r.status] || ''));

        const segs = [];
        if (r.status === 'ok') segs.push('签到 ' + (r.reward || '成功'));
        else if (r.status === 'already') segs.push('签到 已签');
        else if (r.status === 'pending') segs.push('签到 待落库' + (r.reward ? ' ' + r.reward : ''));
        else if (r.status === 'dead') segs.push('登录失效');
        else segs.push('签到失败');

        if (r.draws > 0) segs.push(r.prizes.join(' / '));
        else if (r.drawNote) segs.push('抽奖 ' + r.drawNote);

        if (results.length > 1 && r.pointAfter !== null) segs.push('积分 ' + r.pointAfter);
        wrapSegs(segs, PUSH_W, 3).forEach(function (ln) { L.push(ln); });
    });

    // ④ 积分余额
    L.push('');
    L.push('💰 积分余额 ' + ptSum + (dPt ? '（' + (dPt > 0 ? '+' : '') + dPt + '）' : ''));

    // ⑤ 只在真需要动手时给提示
    const tips = [];
    if (c.dead) tips.push('🔑 ' + c.dead + ' 个号 token 失效，需重抓');
    if (c.fail) tips.push('❌ ' + c.fail + ' 个号异常，加 yili_debug=on 看路径');
    if (c.pending) tips.push('⏳ ' + c.pending + ' 个号待落库，明日复查积分');
    if (meta.ckAge !== null && meta.ckAge !== undefined && meta.ckAge > 96) tips.push('🔑 ck 已 ' + fmtAge(meta.ckAge) + '，建议重抓一次');
    if (tips.length) {
        L.push('');
        tips.forEach(function (t) { wrapSegs([t], PUSH_W, 0).forEach(function (ln) { L.push(ln); }); });
    }
    return L.join('\n');
}

function buildPushTextFull(results, meta) {
    meta = meta || {};
    const sep = '────────────────────';
    const L = [];
    L.push('🥛 活力伊利签到 · ' + stampOf(new Date()));
    L.push(sep);
    results.forEach((r, i) => {
        L.push((i + 1) + '. ' + (r.name || maskToken(r.token)) + ' ' + (BADGE[r.status] || ''));
        L.push('   状态 ' + statusWord(r));
        if (r.mobile) L.push('   账号 ' + r.mobile);
        L.push('   签到 ' + (r.status === 'ok' ? '✅' : r.status === 'already' ? '💤' : r.status === 'pending' ? '⏳' : '❌') + ' ' + (r.reward ? r.reward + ' ' : '') + (r.signNote || r.msg || ''));
        L.push('   抽奖 ' + (r.draws > 0 ? '✅ ' + r.prizes.join(' / ') : '· ' + (r.drawNote || '无')));
        if (r.pointBefore !== null) L.push('   积分 ' + r.pointBefore + (r.pointAfter !== null && r.pointAfter !== r.pointBefore ? ' → ' + r.pointAfter : ''));
    });
    L.push(sep);
    const c = countBy(results);
    const ptSum2 = results.reduce((s2, r) => s2 + (r.pointAfter !== null ? r.pointAfter : (r.pointBefore === null ? 0 : r.pointBefore)), 0);
    L.push('💰 积分余额 ' + ptSum2);
    L.push('✅' + c.ok + ' · 💤' + c.already + ' · ⏳' + c.pending + ' · 🔑' + c.dead + ' · ❌' + c.fail);
    if (meta.secs) L.push('耗时 ' + Math.round(meta.secs) + 's');
    return L.join('\n');
}

function buildPushText(results, meta) {
    const style = String(process.env[ENV.style] || 'simple').trim().toLowerCase();
    if (style === 'full' || style === 'verbose' || style === 'detail') return buildPushTextFull(results, meta);
    return buildPushTextSimple(results, meta);
}

/** sendNotify.js 不可用时的内置兜底渠道（只认环境变量，不写死任何 key） */
async function fallbackChannels(title, text) {
    const done = [];
    const post = (url, body, headers) => new Promise((resolve) => {
        try {
            const u = new URL(url);
            const data = JSON.stringify(body || {});
            const req = https.request({
                host: u.hostname, path: u.pathname + (u.search || ''), method: 'POST',
                headers: Object.assign({ 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) }, headers || {}),
            }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode < 400)); });
            req.on('error', () => resolve(false));
            req.setTimeout(10000, () => { req.destroy(); resolve(false); });
            req.write(data); req.end();
        } catch (e) { resolve(false); }
    });
    const e = process.env;

    if (e.QYWX_KEY) {
        if (await post('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=' + e.QYWX_KEY,
            { msgtype: 'text', text: { content: title + '\n\n' + text } })) done.push('企业微信机器人');
    }
    if (e.QYWX_AM) {
        const p = e.QYWX_AM.split(',');
        if (p.length >= 3) {
            const token = await new Promise((resolve) => {
                const u = new URL('https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=' + p[0] + '&corpsecret=' + p[1]);
                https.get({ host: u.hostname, path: u.pathname + u.search }, (res) => {
                    let s = ''; res.on('data', (d) => (s += d)); res.on('end', () => { try { resolve(JSON.parse(s).access_token || ''); } catch (_) { resolve(''); } });
                }).on('error', () => resolve(''));
            });
            if (token) {
                if (await post('https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=' + token,
                    { touser: p[2], msgtype: 'text', agentid: p[3] || 0, text: { content: title + '\n\n' + text } })) done.push('企业微信应用');
            }
        }
    }
    if (e.PUSH_PLUS_TOKEN) {
        if (await post('https://www.pushplus.plus/send', { token: e.PUSH_PLUS_TOKEN, title: title, content: text, template: 'txt' })) done.push('PushPlus');
    }
    if (e.TG_BOT_TOKEN && e.TG_CHAT_ID) {
        const url = 'https://api.telegram.org/bot' + e.TG_BOT_TOKEN + '/sendMessage';
        if (await post(url, { chat_id: e.TG_CHAT_ID, text: title + '\n\n' + text, disable_web_page_preview: true })) done.push('Telegram');
    }
    if (e.DD_BOT_TOKEN) {
        if (await post('https://oapi.dingtalk.com/robot/send?access_token=' + e.DD_BOT_TOKEN,
            { msgtype: 'text', text: { content: title + '\n\n' + text } })) done.push('钉钉机器人');
    }
    if (e.SERVERCHAN_KEY) {
        if (await post('https://sctapi.ftqq.com/' + e.SERVERCHAN_KEY + '.send',
            { title: title, desp: text })) done.push('Server酱');
    }
    return done;
}

async function push(title, content) {
    const mode = String(process.env[ENV.push] === undefined ? 'on' : process.env[ENV.push]).trim().toLowerCase();
    if (mode === 'off' || !on(ENV.ty, 'on')) {
        console.log('\n  · 推送已关闭');
        return;
    }
    console.log('\n  ── 推送预览 ' + '─'.repeat(24));
    String(content).split('\n').forEach((l) => console.log('  ' + l));
    console.log('  ' + '─'.repeat(36));
    if (mode === 'dry') { console.log('  · dry 模式：只打印不发送'); return; }

    let sent = [];
    const f = resolveFile(['sendNotify.js', path.join('..', 'sendNotify.js'), path.join('_公共', 'sendNotify.js')]);
    if (f) {
        try {
            delete require.cache[require.resolve(f)];
            const mod = require(f);
            const fn = typeof mod === 'function' ? mod : (mod.sendNotify || mod.default);
            if (typeof fn === 'function') { await fn(title, content); sent.push('sendNotify.js'); }
        } catch (e) { if (DEBUG) console.log('  · sendNotify.js 不可用：' + e.message); }
    }
    if (!sent.length) {
        sent = await fallbackChannels(title, content);
    }
    console.log('  · ' + (sent.length ? '推送完成：' + sent.join('、') : '未配置推送渠道，跳过'));
}

// ============================================================================
// 八点五、ck 有效性体检
// ============================================================================

const CHECK_ONLY = process.argv.indexOf('--check') >= 0 || /^(1|on|true|yes|y)$/i.test(String(process.env[ENV.check] || '').trim());

/** token 是 80 字节密文，服务端不返回 exp；只能按"抓包时间 → 现在"算存活时长 */
function ageHours(at) {
    if (!at) return null;
    const t = Date.parse(at);
    if (isNaN(t)) return null;
    return (Date.now() - t) / 3600000;
}

const fmtAge = (h) => (h === null ? '未知' : h < 1 ? Math.round(h * 60) + '分钟' : h < 48 ? h.toFixed(1) + '小时' : (h / 24).toFixed(1) + '天');

/** 只读体检：一次 user/info 就能判生死，再补签到/积分/等级三个读接口 */
async function checkAccount(ck, idx, total) {
    const tag = '[' + (idx + 1) + '/' + total + ']';
    const t1 = Date.now();
    const u = await doUserInfo(ck.token);
    const ms = Date.now() - t1;
    const age = ageHours(ck.at);

    if (!u.ok) {
        const code = u.err ? u.err.code : u.http;
        const msg = u.err ? u.err.msg : (u.http === 403 ? '被 WAF 拦（换网络或稍后再试）' : '请求失败');
        console.log('  ' + tag + ' 🔑 凭证失效   ' + code + ' ' + msg);
        console.log('         ' + (code === 401 || code === 403 ? 'access-token 过期或登录态被顶，重抓一次即可' : '先确认网络，再重试 --check'));
        console.log('         已存活 ' + fmtAge(age) + (age !== null ? '（抓包于 ' + ck.at + '）' : ''));
        return { alive: false };
    }

    const nick = (u.data && u.data.nickName) || '(无昵称)';
    const mob = maskMobile(u.data && u.data.mobile);
    const openId = (u.data && u.data.openId) || '';
    console.log('  ' + tag + ' ✅ 凭证有效   ' + nick + '  ' + mob + '   响应 ' + ms + 'ms');
    console.log('         已存活 ' + fmtAge(age) + '   小程序按 5 天窗口判定重登，建议 ≤4 天（96h）换一次 token');
    if (DEBUG && openId) console.log('         [debug] openId ' + openId.slice(0, 6) + '****');

    const st = await doSignStatus(ck.token);
    if (st.ok && st.data) {
        console.log('         签到 ' + (st.data.signed ? '今日已签' : '今日未签') +
            '   连签 ' + (st.data.signedDays || 0) + ' 天   本月 ' + (st.data.monthSignDays || 0) + '/' + (st.data.monthDays || 30) + ' 天');
    } else {
        console.log('         签到 状态读取失败 ' + (st.err ? st.err.code + ' ' + st.err.msg : ''));
    }
    const pt = await doPoint(ck.token);
    const lv = await doLevel(ck.token);
    const parts = [];
    if (pt.ok && pt.data) parts.push('积分 ' + pt.data.totalPoint);
    if (lv.ok && lv.data) parts.push('等级 ' + lv.data.currentLevel + '（成长 ' + lv.data.totalGrowth + '）');
    if (parts.length) console.log('         ' + parts.join('   '));

    return { alive: true, age: age };
}

// ============================================================================
// 九、主流程
// ============================================================================

(async () => {
    const t0 = Date.now();
    console.log('');
    console.log('  🥛 活力伊利 · 签到 + 抽奖');

    const accounts = loadTokens();
    if (!accounts.length) {
        console.log('\n  ✗ 未配置 ' + ENV.ck + '（access-token）');
        console.log('    抓包：PC 微信打开「活力伊利」→ 任意 /gateway/api 请求 →');
        console.log('    复制请求头 access-token 整串（base64 约 108 字符）');
        console.log('    或用 附带脚本/grab_yili_ck.js 从 HAR 一键提取\n');
        process.exit(1);
    }

    const opt = {
        activity: String(process.env[ENV.act] || DEFAULT_ACT).trim(),
        drawMax: Math.max(0, parseInt(String(process.env[ENV.draw] || '5'), 10) || 0),
        style: String(process.env[ENV.style] || 'simple').toLowerCase(),
    };

    if (CHECK_ONLY) {
        console.log('  ck 体检（只读，不签到、不抽奖）\n');
        let alive = 0;
        for (let i = 0; i < accounts.length; i++) {
            const r = await checkAccount(accounts[i], i, accounts.length);
            if (r.alive) alive += 1;
            console.log('');
        }
        console.log('  结论：' + alive + '/' + accounts.length + ' 个凭证可用');
        process.exit(alive === accounts.length ? 0 : 2);
    }

    const ages = accounts.map((a) => ageHours(a.at)).filter((x) => x !== null);
    const ageTxt = ages.length ? ' · ck 已存活 ' + fmtAge(Math.min.apply(null, ages)) : '';
    console.log('  账号 ' + accounts.length + ' · 活动 ' + opt.activity + ' · 抽奖上限 ' + opt.drawMax + ' · 版式 ' + opt.style + ageTxt + '\n');

    const results = [];
    for (let i = 0; i < accounts.length; i++) {
        if (i > 0) {
            const dd = String(process.env[ENV.delay] || '3-8').split('-').map((x) => parseInt(x, 10) || 0);
            const wait = randInt(dd[0] || 3, dd[1] || dd[0] || 8);
            console.log('  … 间隔 ' + wait + 's');
            await sleep(wait * 1000);
        }
        try {
            results.push(await runAccount(accounts[i], i, accounts.length, opt));
        } catch (e) {
            results.push({ name: accounts[i].remark, token: accounts[i].token, nick: '', status: 'fail', msg: e.message, draws: 0, prizes: [], pointBefore: null, pointAfter: null });
            console.log('  [' + (i + 1) + '/' + accounts.length + '] ❌ 异常 ' + e.message);
        }
        console.log('');
    }

    const c = countBy(results);
    const secs = (Date.now() - t0) / 1000;
    const ckAge = ages.length ? Math.max.apply(null, ages) : null;
    if (ckAge !== null && ckAge > 96) console.log('  ⚠️ ck 已存活 ' + fmtAge(ckAge) + '，接近小程序 5 天重登窗口，建议现在重抓');
    console.log('  汇总：✅' + c.ok + ' 成功 · 💤' + c.already + ' 已签 · ⏳' + c.pending + ' 待落库 · 🔑' + c.dead + ' 失效 · ❌' + c.fail + ' 异常 · ' + secs.toFixed(1) + 's');

    const title = '活力伊利签到 ' + (new Date().getMonth() + 1) + '/' + new Date().getDate();
    await push(title, scrubPhones(buildPushText(results, { secs: secs, ckAge: ckAge })));
    console.log('');
})().catch((e) => {
    console.error('  异常退出：' + (e && e.stack ? e.stack : e));
    process.exit(1);
});
