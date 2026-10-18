#!/usr/bin/env node
// -*- coding: utf-8 -*-
/* eslint-disable */
'use strict';

/**
 * ===========================================================================
 *  顺丰速运+ 青龙一键脚本 · v3（抓包实证版）
 * ---------------------------------------------------------------------------
 *  作者：Mist
 *  仅供学习与个人自动化研究，请勿用于商业用途或批量薅取。
 *  使用本脚本产生的任何后果由使用者自行承担。
 * ===========================================================================
 *
 *
 * ===========================================================================
 *  【环境变量】
 * ===========================================================================
 *  SfsyUrl   必填。凭证，多账号换行。一条里可同时包含两个凭证：
 *              suuid=3634aad3xxxxxx66d4a79c7cac7; sessionId=09A37C49...; _login_mobile_=185...
 *            也接受直接贴 Cookie 串（含 sessionId/_login_mobile_）。
 *            
 *  sfck      可选。单填 suuid 时的补充入口（等价于 SfsyUrl 里只有 suuid）。
 *  sfsess    可选。单填 sessionId 时的补充入口。
 *  sfdevice  可选。deviceid（MCS 任务接口需要），不填用默认值。
 *  sfhost    可选。UCM 域名，默认 https://ucmp.sf-express.com
 *
 *  sfcheck   可选。=1 进入自检：只探测凭证，不签到不做任务。
 *  sfkeep    可选。=1 进入保活：只读探测 + 记录连续存活时长。
 *  sf_tasks  可选。=off 跳过所有任务，只签到。
 *  sf_try_all 可选。=1 连「需真实操作」的任务也尝试 finishTask（默认跳过）
 *
 *  TYpush    可选。text（默认）/ markdown / off
 *
 * ===========================================================================
 *  【青龙】
 * ===========================================================================
 *  1. 传到 /ql/scripts/sf_all_in_one.js
 *  2. 环境变量配 SfsyUrl
 *  3. 定时任务： task sf_all_in_one.js
 *  4. 先验证：加 sfcheck=1 手动跑一次
 */

const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');

// ===========================================================================
// 一、配置
// ===========================================================================

const ENV_ACCOUNT = 'SfsyUrl';
const ENV_CK = 'sfck';
const ENV_SESS = 'sfsess';
const ENV_DEVICE = 'sfdevice';
const ENV_HOST = 'sfhost';
const ENV_CHECK = 'sfcheck';
const ENV_KEEPALIVE = 'sfkeep';
const ENV_PUSH = 'TYpush';

// ---- A 引擎：UCM（真实值，来自小程序 config/sign.js 解密 + 抓包验证）----
const UCM_HOST = (process.env[ENV_HOST] || 'https://ucmp.sf-express.com').replace(/\/+$/, '');
const UCM_APPID = 'wxapp-valid-0328';
const UCM_KEY = '2b08f7f6bf564a1dada1570535fd44ba';
const UCM_VER = 'V17.79';
const UCM_REFERER = 'https://servicewechat.com/wxd4185d00bf7e08ac/738/page-frame.html';
const UCM_ENVVER = 'release';

// ---- B 引擎：MCS（真实值，48/48 签名验证通过）----
const MCS_HOST = 'https://mcs-mimp-web.sf-express.com';
const MCS_TOKEN = 'wwesldfs29aniversaryvdld29';
const MCS_SYS = 'MCS-MIMP-CORE';

const DEVICE_ID = process.env[ENV_DEVICE] || '4fb7848b-4464-b178';

const WX_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 ' +
    'MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI ' +
    'MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) ' +
    'UnifiedPCWindowsWechat(0xf2541f37) XWEB/25799';

const TIMEOUT = 20000;
const CHECK_MODE = isOn(process.env[ENV_CHECK]);
const KEEPALIVE = isOn(process.env[ENV_KEEPALIVE]);
const SKIP_TASKS = String(process.env.sf_tasks || '').toLowerCase() === 'off';
const TRY_ALL = isOn(process.env.sf_try_all);
const VERBOSE = isOn(process.env.SF_VERBOSE) || isOn(process.env.sf_verbose);
const PROBE_ONLY = isOn(process.env.sf_probe);

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
const NO_SIGN = isOn(process.env.sf_nosign);

function isOn(v) {
    return ['1', 'true', 'on', 'yes', 'y'].includes(String(v || '').toLowerCase());
}

// ===========================================================================
// 二、工具
// ===========================================================================

const md5 = (s) => crypto.createHash('md5').update(String(s), 'utf8').digest('hex');
const md5Up = (s) => md5(s).toUpperCase();

function randomStr(n) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let o = '';
    for (let i = 0; i < n; i++) o += chars[Math.floor(Math.random() * chars.length)];
    return o;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function strWidth(s) {
    let w = 0;
    for (const ch of String(s)) {
        const c = ch.codePointAt(0);
        const wide =
            c >= 0x1100 &&
            (c <= 0x115f ||
                c === 0x2329 ||
                c === 0x232a ||
                (c >= 0x2e80 && c <= 0xa4cf && c !== 0x303f) ||
                (c >= 0xac00 && c <= 0xd7a3) ||
                (c >= 0xf900 && c <= 0xfaff) ||
                (c >= 0xfe30 && c <= 0xfe6f) ||
                (c >= 0xff00 && c <= 0xff60) ||
                (c >= 0xffe0 && c <= 0xffe6) ||
                (c >= 0x1f300 && c <= 0x1f64f) ||
                (c >= 0x1f680 && c <= 0x1f6ff) ||
                (c >= 0x1f900 && c <= 0x1f9ff) ||
                (c >= 0x2600 && c <= 0x27bf) ||
                (c >= 0x20000 && c <= 0x3fffd));
        w += wide ? 2 : 1;
    }
    return w;
}

function padR(s, w) {
    const d = w - strWidth(s);
    return d > 0 ? s + ' '.repeat(d) : s;
}

function maskPhone(p) {
    const s = String(p || '');
    return s.length >= 7 ? s.slice(0, 3) + '****' + s.slice(7) : s || '未知';
}

function request(urlStr, { method = 'GET', headers = {}, body = null, timeout = TIMEOUT } = {}) {
    return new Promise((resolve) => {
        let u;
        try {
            u = new URL(urlStr);
        } catch (e) {
            return resolve({ status: 0, text: '', json: null, error: 'URL 非法' });
        }
        const payload = body == null ? null : typeof body === 'string' ? body : JSON.stringify(body);
        const h = Object.assign({}, headers);
        if (payload != null) h['Content-Length'] = Buffer.byteLength(payload);

        const isHttps = u.protocol === 'https:';
        const mod = isHttps ? https : http;
        let done = false;
        const fin = (r) => {
            if (!done) {
                done = true;
                resolve(r);
            }
        };

        const req = mod.request(
            {
                protocol: u.protocol,
                hostname: u.hostname,
                port: u.port || (isHttps ? 443 : 80),
                path: u.pathname + (u.search || ''),
                method,
                headers: h,
                timeout,
            },
            (res) => {
                const chunks = [];
                res.on('data', (c) => chunks.push(c));
                res.on('end', () => {
                    const text = Buffer.concat(chunks).toString('utf8');
                    let json = null;
                    try {
                        json = JSON.parse(text);
                    } catch (e) {}
                    fin({ status: res.statusCode, text, json, headers: res.headers });
                });
            }
        );
        req.on('error', (e) => fin({ status: 0, text: '', json: null, error: e.message }));
        req.on('timeout', () => {
            req.destroy();
            fin({ status: 0, text: '', json: null, error: '超时' });
        });
        if (payload != null) req.write(payload);
        req.end();
    });
}

/** 解析 Cookie 串 / 凭证行，抽出所有可能字段 */
function parseCred(raw) {
    let s = String(raw || '').trim().replace(/^cookie\s*:\s*/i, '');
    try {
        s = decodeURIComponent(s);
    } catch (e) {}
    const map = {};
    for (const part of s.split(/[;\r\n]+/)) {
        const p = part.trim();
        if (!p) continue;
        const i = p.indexOf('=');
        if (i <= 0) continue;
        map[p.slice(0, i).trim()] = p.slice(i + 1).trim();
    }
    return map;
}

// ===========================================================================
// 三、A 引擎：UCM
// ===========================================================================

/**
 */
function ucmSign(bodyStr) {
    const nc = randomStr(32);
    const str = `appId=${UCM_APPID}&nonceStr=${nc}&requestBody=${bodyStr || '{}'}&key=${UCM_KEY}`;
    return { sign: md5Up(str), nonce: nc, string: str };
}

class Ucm {
    constructor(map) {
        this.suuid = map.suuid || '';
        this.device = map.deviceid || map.deviceId || DEVICE_ID;
    }
    get ok() {
        return !!this.suuid;
    }

    headers(bodyStr) {
        const { sign, nonce } = ucmSign(bodyStr);
        return {
            'User-Agent': WX_UA,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            // ↓ 鉴权核心：suuid 是请求头，不是 Cookie（唯一真门槛）
            appid: UCM_APPID,
            // 服务端不校验签名（实测 5 种伪造全放行）。sf_nosign=1 时发空串。
            sign: NO_SIGN ? '' : sign,
            noncestr: nonce,
            'wxapp-version': UCM_VER,
            envversion: UCM_ENVVER,
            xweb_xhr: '1',
            msgid: 'WA' + crypto.randomBytes(16).toString('hex').toUpperCase(),
            deviceid: this.device,
            suuid: this.suuid,
            bno: '',
            'grey-mobile-rem': '3',
            Referer: UCM_REFERER,
        };
    }

    async call(path, { method = 'GET', body = null } = {}) {
        const bodyStr = body == null ? '{}' : JSON.stringify(body);
        return request(`${UCM_HOST}${path}`, {
            method,
            headers: this.headers(bodyStr),
            body: method === 'POST' ? bodyStr : null,
        });
    }

    static expired(res) {
        const j = res && res.json;
        if (!j) return false;
        return j.errorCode === 401 || j.errorCode === '401' || /Unauthorized/i.test(j.errorMessage || '');
    }

    /** 查签到状态（只读） */
    async todaySign() {
        const r = await this.call('/proxy/esgcempcore/memberNonactivity/integralSignV2Service/getTodaySign');
        if (Ucm.expired(r)) return { expired: true };
        const j = r.json || {};
        return { expired: false, ok: j.success === true, obj: j.obj || null, raw: j };
    }

    /** 查积分：字段是 usablePoint */
    async point() {
        const r = await this.call('/cx-wechat-member/member/memGrade/queryPoint?flag=2');
        if (Ucm.expired(r)) return { expired: true };
        const o = r.json && r.json.obj;
        if (!o) return { value: null };
        return {
            value: o.usablePoint != null ? o.usablePoint : o.point != null ? o.point : null,
            expiring: o.expiringPoint || 0,
            expiringDate: o.expiringDate || '',
        };
    }
}

// ===========================================================================
// 四、B 引擎：MCS
// ===========================================================================

/**
 * MCS 签名（真实算法，48/48 真实请求全匹配）
 *
 *   原文 = token={固定}&timestamp={毫秒}&sysCode=MCS-MIMP-CORE
 *   signature = MD5(原文)        小写，不含请求体
 */
function mcsSign(ts) {
    const timestamp = String(ts || Date.now());
    return {
        timestamp,
        signature: md5(`token=${MCS_TOKEN}&timestamp=${timestamp}&sysCode=${MCS_SYS}`),
    };
}

class Mcs {
    constructor(map) {
        this.sessionId = map.sessionId || map.JSESSIONID || '';
        this.mobile = map._login_mobile_ || '';
        this.userId = map._login_user_id_ || '';
        this.channel = map.channel || 'mypoint';
    }
    get ok() {
        return !!this.sessionId;
    }

    headers() {
        const { timestamp, signature } = mcsSign();
        return {
            'User-Agent': WX_UA + ' miniProgram/wxd4185d00bf7e08ac',
            Accept: 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            syscode: MCS_SYS,
            timestamp,
            // 服务端不校验签名（实测 6 种伪造全放行）。sf_nosign=1 时发空串省算力。
            signature: NO_SIGN ? '' : signature,
            channel: this.channel,
            platform: 'MINI_PROGRAM',
            Origin: MCS_HOST,
            Referer: `${MCS_HOST}/up-member/newPoints`,
            // ↓ 鉴权核心（唯一真门槛）
            Cookie: `sessionId=${this.sessionId}; JSESSIONID=${this.sessionId}` +
                (this.userId ? `; _login_user_id_=${this.userId}` : '') +
                (this.mobile ? `; _login_mobile_=${this.mobile}` : ''),
        };
    }

    async call(path, body) {
        return request(`${MCS_HOST}${path}`, {
            method: 'POST',
            headers: this.headers(),
            body: body === undefined ? {} : body,
        });
    }

    /** 业务接口统一走这个前缀 */
    post(service, action, body) {
        return this.call(`/mcs-mimp/commonPost/~${service}~${action}`, body);
    }

    static expired(res) {
        const j = res && res.json;
        if (!j) return false;
        return String(j.errorCode) === '100111';
    }

    static err(res) {
        const j = res && res.json;
        if (!j) return (res && (res.error || '无响应')).toString().slice(0, 100);
        if (j.errorCode || j.errorMessage) {
            return `${j.errorCode || ''} ${j.errorMessage || j.msg || ''}`.trim();
        }
        if (j.success === true && j.obj === false) return '服务端未确认完成';
        return (res && res.error) || `HTTP ${res && res.status}`;
    }

    /**
     * 登录态探测。
     */
    async probe() {
        const r = await this.call('/mcs-mimp/ifLogin');
        const j = r.json || {};
        const o = (j && j.obj) || {};

        if (Mcs.expired(r)) {
            return { expired: true, ok: false, reason: '100111 用户信息失效' };
        }
        if (j.success === true && o.loginStatus === 1) {
            return { expired: false, ok: true, mobile: o.mobile || '', loginStatus: 1 };
        }
        return {
            expired: true,
            ok: false,
            loginStatus: o.loginStatus,
            reason: `loginStatus=${o.loginStatus != null ? o.loginStatus : '?'}（未登录）`,
        };
    }

    async todaySign() {
        const r = await this.post('memberNonactivity~integralSignV2Service', 'getTodaySign', {});
        if (Mcs.expired(r)) return { expired: true };
        const j = r.json || {};
        return { expired: false, ok: j.success === true, obj: j.obj || null };
    }

    /** 签到。返回 {ok, already, award, dayCount} */
    async sign() {
        const r = await this.post('memberNonactivity~integralSignV2Service', 'sign', {});
        const j = r.json || {};
        if (Mcs.expired(r)) return { expired: true };
        // 3400002 = 今日已签到
        if (j.errorCode === '3400002' || /已签到/.test(j.errorMessage || '')) {
            return { ok: true, already: true };
        }
        if (j.success) {
            const o = j.obj || {};
            const award = o.award || {};
            let name = award.giftBagName || '';
            if (!name && (award.productDTOList || []).length) {
                name = award.productDTOList[0].productName || '';
            }
            const num = o.awardNum != null ? o.awardNum : (award.awardNum || 0);
            return { ok: true, already: false, award: name, amount: num, dayCount: o.dayCount || 0 };
        }
        return { ok: false, reason: Mcs.err(r) };
    }

    /**
     * 第二条签到通道：automaticSignFetchPackage
     *
     * 【实测 2026-10-18】这条与 integralSignV2Service~sign 是两条独立的签到链路：
     *   · sign()                    → 返回 dayCount: 3   （双端签到，小程序 + APP 各一次）
     *   · autoSign()  ← 就是这个     → 返回 countDay: 1   （独立计数，实测 +1 分）
     * 两个计数器互不相干，是「两条路」的铁证。v3 只做了前一条，白丢 1 分/天。
     */
    async autoSign() {
        const r = await this.post('memberNonactivity~integralTaskSignPlusService', 'automaticSignFetchPackage', {
            comeFrom: 'vioin',
            channelFrom: 'WEIXIN',
        });
        const j = r.json || {};
        if (Mcs.expired(r)) return { expired: true };
        const o = j.obj || {};
        if (j.success === true) {
            const packets = o.integralTaskSignPackageVOList || [];
            const names = packets.map((p) => p.packetName).filter(Boolean);
            return {
                expired: false,
                ok: true,
                // hasFinishSign=1 表示当天已完成，礼包数 0
                already: o.hasFinishSign === 1 || packets.length === 0,
                award: names.join('、'),
                countDay: o.countDay || 0,
            };
        }
        return { expired: false, ok: false, reason: Mcs.err(r) };
    }

    /**
     * 任务列表：totalPoint + taskTitleLevels
     *
     * 【实测 2026-10-18】channelType 不是单一值，需要全扫去重：
     *   ct=1 → 18 个   ct=2 → 4 个   ct=3 → 12 个   ct=4 → 4 个
     *   ct=01/02/03/04 是 1/2/3/4 的别名，完全重复
     *   去重后 19 个。v3 只扫 ct=3，漏 7 个。
     */
    async taskList() {
        // 2026-10-18 实测：01/02/03/04 与 1/2/3/4 返回完全相同，是别名。
        // 只扫 4 个真实值即可，省 4 次请求。
        // 需要完整复现抓包时设 sf_task_alias=1 把别名也扫一遍。
        const CHANNELS = isOn(process.env.sf_task_alias)
            ? ['1', '2', '3', '4', '01', '02', '03', '04']
            : ['1', '2', '3', '4'];
        const seen = new Set();
        const tasks = [];
        let totalPoint = null;
        let lastErr = '';

        for (const ct of CHANNELS) {
            const r = await this.post('memberNonactivity~integralTaskStrategyService', 'queryPointTaskAndSignFromES', {
                channelType: ct,
                deviceId: DEVICE_ID,
            });
            if (Mcs.expired(r)) return { expired: true, tasks: [] };
            const j = r.json || {};
            if (!(j.success && j.obj)) {
                lastErr = Mcs.err(r);
                continue;
            }
            // totalPoint 只有 ct=1 那份是权威值
            if (ct === '1' && j.obj.totalPoint != null) totalPoint = j.obj.totalPoint;
            if (totalPoint == null && j.obj.totalPoint != null) totalPoint = j.obj.totalPoint;

            for (const t of j.obj.taskTitleLevels || []) {
                const code = t.taskCode;
                if (!code || seen.has(code)) continue;
                seen.add(code);
                tasks.push(t);
            }
        }

        if (!tasks.length) return { ok: false, reason: lastErr || '任务列表为空', tasks: [] };
        return { ok: true, totalPoint, tasks };
    }

    /**
     * 完成任务上报（第①层：回执）
     *
     * 【重要】返回 obj:true/false 只代表「上报被服务端接受」，
     * 既不把状态改成 3，也不发一分。发分的是 fetchIntegral()。
     */
    async finishTask(taskCode) {
        const r = await this.call('/mcs-mimp/commonRoutePost/memberEs/taskRecord/finishTask', { taskCode });
        const j = r.json || {};
        return { ok: j.success === true, done: j.obj === true, reason: Mcs.err(r) };
    }

    /**
     * 领取任务积分（第③层：真发分）★ v4 补上的核心接口
     */
    async fetchIntegral(task) {
        const r = await this.post('memberNonactivity~integralTaskStrategyService', 'fetchIntegral', {
            strategyId: task.strategyId,
            taskId: task.taskId,
            taskCode: task.taskCode,
            deviceId: DEVICE_ID,
        });
        const j = r.json || {};
        if (Mcs.expired(r)) return { expired: true };

        const code = String(j.errorCode || '');
        // 600005「已领取积分」是幂等成功，不是失败
        if (code === '600005' || /已领取/.test(j.errorMessage || '')) {
            return { ok: true, already: true, point: 0 };
        }
        // 600006「任务未完成」= 需要真实业务行为，脚本拿不到
        if (code === '600006' || /任务未完成/.test(j.errorMessage || '')) {
            return { ok: false, needReal: true, reason: '需真实业务行为（寄件/下单/绑卡/兑换）' };
        }
        if (j.success === true) {
            const o = j.obj || {};
            return { ok: true, already: false, point: o.point != null ? o.point : 0, pageStatus: o.pageStatus };
        }
        return { ok: false, reason: Mcs.err(r) };
    }
}

// ===========================================================================
// 五、任务策略
// ===========================================================================

/**
 *
 * TRY_ALL=1 可无视黑名单全部尝试。
 */
const TASK_BLOCKLIST = new Map([
    ['B0C30EA64EFB4828B6CD7BB6F002E6E5', '需真实发起 AI 寄件下单'],
    ['D66A32227E964E959D19E52004A753F3', '需真实领取生活特权'],
    ['D95612AEF0D44FEEBE7157017BDBCB1A', '需真实寄国际件'],
    ['1ED31ACAC5C24A1DAC8660D57701A146', '需真实用模板下单'],
    ['7A9A0EF217074583935DDB3D84C0DF97', '需真实设置顺丰ID'],
    ['5645921EFDAD48DE94950DD5DA6C6231', '需真实新增收件偏好'],
    ['90D8EC03765A422ABC99F01067479485', '需消耗 50 积分参与活动'],
    ['A431239561DC456289C3E7C1F421DA12', '需消耗 260 积分参与活动'],
]);

const PERIOD_CN = { D: '每日', W: '每周', M: '每月', T: '一次性' };
const STATUS_CN = { 0: '未开始', 1: '可完成', 2: '进行中', 3: '已完成' };

// ===========================================================================
// 六、单个账号执行
// ===========================================================================

async function runAccount(credMap, log) {
    const out = {
        mobile: credMap._login_mobile_ || '',
        hasSuuid: !!credMap.suuid,
        hasSession: !!(credMap.sessionId || credMap.JSESSIONID),
        expired: false,
        signed: false,
        already: false,
        award: '',
        dayCount: 0,
        point: null,
        pointBefore: null,
        tasksDone: [],
        taskPoints: 0,
        tasksSkip: 0,
        tasksTried: 0,
        tasksFail: 0,
        tasksNeedReal: 0,
    };

    const ucm = new Ucm(credMap);
    const mcs = new Mcs(credMap);

    if (!mcs.ok && !ucm.ok) {
        out.error = '凭证里既没有 suuid 也没有 sessionId';
        return out;
    }

    // 先记下运行前的积分基数，最后用来算「本次真实收益」
    if (ucm.ok) {
        const p0 = await ucm.point();
        if (!p0.expired && p0.value != null) out.pointBefore = p0.value;
    }

    // ---------- B 引擎：签到（唯一可签到的路径）----------
    if (mcs.ok) {
        const probe = await mcs.probe();
        if (probe.expired) {
            out.expired = true;
            out.error = 'MCS 凭证失效（100111）';
            log.error('MCS 凭证已失效（100111 用户信息失效）');
        } else {
            if (probe.mobile && !out.mobile) out.mobile = probe.mobile;

            const st = await mcs.todaySign();
            if (st.expired) {
                out.expired = true;
                log.error('MCS 凭证已失效（100111）');
            } else {
                const o = st.obj || {};
                out.dayCount = o.dayCount || 0;

                if (o.signed === true) {
                    out.signed = true;
                    out.already = true;
                    log.info(`今日已签到 · 连续 ${out.dayCount} 天`);
                } else {
                    await sleep(800 + Math.random() * 1200);
                    const r = await mcs.sign();
                    if (r.expired) {
                        out.expired = true;
                        log.error('签到过程中凭证失效');
                    } else if (r.already) {
                        out.signed = true;
                        out.already = true;
                        log.info('今日已签到');
                    } else if (r.ok) {
                        out.signed = true;
                        out.award = r.award || '';
                        out.dayCount = r.dayCount || out.dayCount;
                        log.success(`签到成功${r.award ? ' · ' + r.award : ''}`);
                    } else {
                        log.error('签到失败：' + (r.reason || '未知'));
                    }
                }

                // ---------- 第二条签到通道：automaticSignFetchPackage ----------
                //
                // 【2026-10-18 实测】这条与上面 integralSignV2Service~sign 是独立链路：
                //   sign()     → dayCount: 3   （双端签到）
                //   autoSign() → countDay: 1   （独立计数，实测 +1 分）
                // 两个计数器互不相干。v3 漏了这条，白丢 1 分/天。
                if (!out.expired) {
                    await sleep(800 + Math.random() * 900);
                    const as = await mcs.autoSign();
                    if (as.expired) {
                        out.expired = true;
                    } else if (as.ok && !as.already) {
                        out.signed = true;
                        out.autoSignAward = as.award || '';
                        log.success(`签到礼包${as.award ? ' · ' + as.award : ''}`);
                    } else if (VERBOSE && as.ok) {
                        log.detail(`签到礼包已领（countDay=${as.countDay}）`);
                    }
                }
            }
        }

        // ---------- B 引擎：任务 ----------
        //   一个「不行」的结论，必须配一句「那么谁行」。
        if (out.signed && !out.expired && !SKIP_TASKS) {
            const tl = await mcs.taskList();
            if (tl.ok) {
                const pointBefore = out.point;
                const beforeStat = new Map();
                for (const t of tl.tasks) {
                    if (t.taskCode) beforeStat.set(t.taskCode, t.status);
                }

                const todo = (tl.tasks || []).filter((t) => t.taskCode && t.status !== 3);
                if (VERBOSE) {
                    log.detail(`任务 ${tl.tasks.length} 个（全 channelType 去重），未完成 ${todo.length} 个`);
                }

                // 逐个走闭环：finishTask → fetchIntegral
                for (const t of todo) {
                    const code = t.taskCode;
                    const name = t.title || t.description || code;
                    const period = PERIOD_CN[t.taskPeriod] || t.taskPeriod || '';
                    const award = t.point != null ? t.point : t.awardIntegral || 0;

                    // 已知需真实业务行为的，默认跳过（TRY_ALL=1 可强制尝试）
                    if (!TRY_ALL && TASK_BLOCKLIST.has(code)) {
                        out.tasksSkip++;
                        log.detail(`跳过「${name}」(${period} +${award}分) — ${TASK_BLOCKLIST.get(code)}`);
                        continue;
                    }

                    await sleep(700 + Math.random() * 800);
                    out.tasksTried++;

                    // ① 上报
                    const fr = await mcs.finishTask(code);
                    if (fr.reason && /100111/.test(fr.reason)) {
                        out.expired = true;
                        log.error('上报过程中凭证失效');
                        break;
                    }
                    await sleep(900 + Math.random() * 600);

                    // ③ 领奖（真正发分的一步）
                    const fi = await mcs.fetchIntegral(t);
                    if (fi.expired) {
                        out.expired = true;
                        log.error('领奖过程中凭证失效');
                        break;
                    }
                    if (fi.ok && !fi.already && fi.point) {
                        out.tasksDone.push(`${name} +${fi.point}`);
                        out.taskPoints += fi.point;
                        log.success(`「${name}」+${fi.point}分`);
                    } else if (fi.ok && fi.already) {
                        if (VERBOSE) log.detail(`「${name}」已领取过`);
                    } else if (fi.needReal) {
                        out.tasksNeedReal++;
                        if (VERBOSE) log.detail(`「${name}」${fi.reason}`);
                    } else {
                        out.tasksFail++;
                        if (VERBOSE) {
                            log.detail(`「${name}」未获分 — ${fr.done ? 'obj:true' : 'obj:false'} / ${fi.reason || '未知'}`);
                        }
                    }
                    await sleep(900 + Math.random() * 700);
                }

                // 回查核实 + 用余额差交叉验证
                if (out.tasksTried > 0) {
                    await sleep(1200);
                    const after = await mcs.taskList();
                    if (after.ok) {
                        for (const t of after.tasks) {
                            if (!t.taskCode || t.status !== 3) continue;
                            const was = beforeStat.get(t.taskCode);
                            if (was !== 3 && !out.tasksDone.some((d) => d.startsWith(t.title || '\u0000'))) {
                                // 状态变了但 fetchIntegral 没拿到分值 —— 记一笔，别当成功
                                if (VERBOSE) log.detail(`「${t.title}」状态已变 3，但未解析到分值`);
                            }
                        }
                        if (after.totalPoint != null) out.point = after.totalPoint;
                    }
                }

                if (out.tasksDone.length) {
                    log.success(
                        `任务：${out.tasksDone.length} 个共 +${out.taskPoints} 分` +
                            (out.tasksNeedReal ? ` · ${out.tasksNeedReal} 个需真实寄件/下单` : '') +
                            (out.tasksSkip ? ` · 跳过 ${out.tasksSkip} 个` : '')
                    );
                } else if (out.tasksTried === 0) {
                    log.info(`任务：${out.tasksSkip} 个均需真实操作，无可自动完成项`);
                } else {
                    log.info(
                        `任务：${out.tasksTried} 个均需真实寄件/下单，本日无可自动完成项` +
                            (out.tasksSkip ? ` · 跳过 ${out.tasksSkip} 个` : '')
                    );
                }
            } else {
                log.warning('任务列表获取失败：' + (tl.reason || ''));
            }
        }

        // MCS 侧记的总分（这个字段只有任务接口返回）
        if (!out.expired && out.point == null) {
            const tl2 = await mcs.taskList();
            if (tl2.ok && tl2.totalPoint != null) out.point = tl2.totalPoint;
        }
    } else {
        log.warning('没有 sessionId → 无法签到（签到接口只在 MCS 网关，UCM 那个已废弃 500）');
    }

    // ---------- A 引擎：积分 ----------
    if (ucm.ok && !out.expired) {
        const p = await ucm.point();
        if (p.expired) {
            log.warning('UCM 凭证已失效（401），积分查不到');
            out.ucmExpired = true;
        } else if (p.value != null) {
            out.point = p.value;
            if (VERBOSE && p.expiring) log.detail(`积分 ${p.value}（${p.expiring} 分将于 ${p.expiringDate} 过期）`);
        }
    } else if (!ucm.ok) {
        log.detail('没有 suuid → 跳过积分查询');
    }

    return out;
}

// ===========================================================================
// 七、凭证自检
// ===========================================================================

async function checkCred(credMap, idx, log) {
    const ucm = new Ucm(credMap);
    const mcs = new Mcs(credMap);

    console.log('');
    console.log(`   ── 账号 ${idx + 1} ─────────────────────────────`);
    console.log(`   手机号    ${credMap._login_mobile_ ? maskPhone(credMap._login_mobile_) : '（凭证里没有）'}`);
    console.log(`   suuid     ${ucm.suuid ? ucm.suuid.slice(0, 12) + '…' + ucm.suuid.slice(-6) : '❌ 无'}`);
    console.log(`   sessionId ${mcs.sessionId ? mcs.sessionId.slice(0, 12) + '…' + mcs.sessionId.slice(-4) : '❌ 无'}`);
    console.log('');

    const res = { ucm: null, mcs: null, mobile: credMap._login_mobile_ || '' };

    if (ucm.ok) {
        const t = await ucm.todaySign();
        if (t.expired) {
            console.log('   ❌ UCM（suuid）已失效：401 Unauthorized');
            res.ucm = { ok: false, expired: true };
        } else if (t.ok) {
            const o = t.obj || {};
            const p = await ucm.point();
            res.ucm = { ok: true, point: p.value };
            console.log(`   ✅ UCM（suuid）有效`);
            console.log(`      已签到=${o.signed}  连续=${o.dayCount || 0}天  积分=${p.value != null ? p.value : '-'}`);
        } else {
            console.log('   ⚠️  UCM 返回异常：' + JSON.stringify(t.raw).slice(0, 120));
            res.ucm = { ok: false };
        }
    } else {
        console.log('   ⏭️  UCM 跳过（没有 suuid）');
    }

    if (mcs.ok) {
        // 双重验证：ifLogin 看登录态，getTodaySign 看业务授权
        const p = await mcs.probe();
        const t = p.ok ? await mcs.todaySign() : { expired: true, ok: false };
        const o = t.obj || {};

        if (p.expired || t.expired) {
            const why = p.reason || (t.expired ? '100111 用户信息失效' : '');
            console.log('   ❌ MCS（sessionId）已失效：' + why);
            res.mcs = { ok: false, expired: true };
        } else if (p.ok && t.ok) {
            res.mcs = { ok: true };
            if (p.mobile) res.mobile = p.mobile;
            console.log('   ✅ MCS（sessionId）有效');
            console.log(`      已签到=${o.signed === true}  连续=${o.dayCount || 0}天`);
        } else {
            console.log('   ⚠️  MCS 返回异常：' + (p.reason || Mcs.err(t) || ''));
            res.mcs = { ok: false };
        }
    } else {
        console.log('   ⏭️  MCS 跳过（没有 sessionId）→ 无法签到');
    }

    return res;
}

// ===========================================================================
// 全部是只读请求，不改任何业务状态，可以随时跑。

async function probeSignStrength(credMap) {
    const mcs = new Mcs(credMap);
    const ucm = new Ucm(credMap);
    const out = { mcs: [], ucm: [] };

    if (mcs.ok) {
        const path = '/mcs-mimp/commonPost/~memberNonactivity~integralSignV2Service~getTodaySign';
        const good = mcsSign().signature;
        const cases = [
            ['正确签名', good],
            ['空字符串', ''],
            ['垃圾值 x', 'x'],
            ['全 0 md5', '0'.repeat(32)],
            ['正确但大写', good.toUpperCase()],
            ['不发签名头', null],
        ];
        for (const [name, sig] of cases) {
            const h = mcs.headers();
            if (sig === null) delete h.signature;
            else h.signature = sig;
            const r = await request(`${MCS_HOST}${path}`, { method: 'POST', headers: h, body: {} });
            const pass = r.json && r.json.success === true;
            out.mcs.push({ name, pass, http: r.status });
        }
    }

    if (ucm.ok) {
        const path = '/cx-wechat-member/member/memGrade/queryPoint?flag=2';
        const { sign: good } = ucmSign('{}');
        const cases = [
            ['正确签名', good],
            ['空字符串', ''],
            ['垃圾值 x', 'x'],
            ['不发签名头', null],
        ];
        for (const [name, sig] of cases) {
            const h = ucm.headers('{}');
            if (sig === null) { delete h.sign; delete h.appid; delete h.noncestr; }
            else h.sign = sig;
            const r = await request(`${UCM_HOST}${path}`, { method: 'GET', headers: h });
            const pass = r.json && (r.json.success === true || r.json.business != null);
            out.ucm.push({ name, pass, http: r.status });
        }
    }
    return out;
}

async function probeEndpoints(credMap) {
    const mcs = new Mcs(credMap);
    if (!mcs.ok) return [];
    const list = [
        ['签到 getTodaySign', 'memberNonactivity~integralSignV2Service', 'getTodaySign', {}],
        ['签到礼包 automaticSignFetchPackage', 'memberNonactivity~integralTaskSignPlusService', 'automaticSignFetchPackage', { comeFrom: 'vioin', channelFrom: 'WEIXIN' }],
        ['APP签到 getUnFetchPointAndDiscount', 'memberNonactivity~integralTaskSignPlusService', 'getUnFetchPointAndDiscount', {}],
        ['任务列表 queryPointTaskAndSignFromES', 'memberNonactivity~integralTaskStrategyService', 'queryPointTaskAndSignFromES', { channelType: '1', deviceId: DEVICE_ID }],
    ];
    const out = [];
    for (const [name, svc, act, body] of list) {
        const r = await mcs.post(svc, act, body);
        const j = r.json || {};
        let verdict;
        if (j.success === true) verdict = '✅ 可用';
        else if (String(j.errorCode) === '600010') verdict = '⚠️ 恒 600010 渠道错误（App 专属，Web 打不通）';
        else if (String(j.errorCode) === '3400002') verdict = '✅ 可用（今日已签）';
        else if (String(j.errorCode) === '100111') verdict = '❌ 凭证失效';
        else verdict = '❌ ' + (j.errorCode || '?') + ' ' + (j.errorMessage || '');
        out.push({ name, verdict, code: j.errorCode || '', msg: j.errorMessage || '' });
        await sleep(4000 * 0 + 600); // 轻微间隔，别打太快
    }
    return out;
}

async function deepProbe(results) {
    console.log('');
    console.log('   ╔══════════════════════════════════════════════════════╗');
    console.log('   ║   深度探测（只读，不改业务状态）                       ║');
    console.log('   ╚══════════════════════════════════════════════════════╝');

    const map = results._credMap;
    if (!map) return;

    console.log('');
    console.log('   ── 签名校验强度 ─────────────────────────────');
    const ss = await probeSignStrength(map);
    if (ss.mcs.length) {
        const allPass = ss.mcs.every((x) => x.pass);
        console.log(`   MCS 签名：${allPass ? '⚠️ 全部放行 → 服务端不校验' : '✅ 有拦截逻辑'}`);
        for (const x of ss.mcs) console.log(`      ${padR(x.name, 14)} ${x.pass ? '放行' : '拦截'}  HTTP ${x.http}`);
    }
    if (ss.ucm.length) {
        const allPass = ss.ucm.every((x) => x.pass);
        console.log(`   UCM 签名：${allPass ? '⚠️ 全部放行 → 服务端不校验' : '✅ 有拦截逻辑'}`);
        for (const x of ss.ucm) console.log(`      ${padR(x.name, 14)} ${x.pass ? '放行' : '拦截'}  HTTP ${x.http}`);
    }

    console.log('');
    console.log('   ── 关键接口可用性 ───────────────────────────');
    const eps = await probeEndpoints(map);
    for (const e of eps) console.log(`   ${padR(e.name, 38)} ${e.verdict}`);

    console.log('');
    console.log('   ── 结论 ─────────────────────────────────────');
    const mcsSignFree = ss.mcs.length && ss.mcs.every((x) => x.pass);
    const ucmSignFree = ss.ucm.length && ss.ucm.every((x) => x.pass);
    if (mcsSignFree || ucmSignFree) {
        console.log('   签名不是门槛，不要在这上面花时间。');
        console.log('   真门槛只有：suuid（UCM 请求头）/ sessionId（MCS Cookie）。');
    }
    const dead = eps.filter((e) => /600010/.test(e.verdict));
    if (dead.length) {
        console.log(`   有 ${dead.length} 个接口在本环境不可用（App 专属或已下线），脚本会静默跳过。`);
    }
    console.log('');
}

function detectChannels() {
    const o = [];
    if (process.env.QYWX_AM) o.push('企业微信应用');
    if (process.env.QYWX_KEY) o.push('企业微信机器人');
    if (process.env.PUSH_PLUS_TOKEN) o.push('PushPlus');
    if (process.env.BARK) o.push('Bark');
    if (process.env.SCKEY) o.push('Server酱');
    if (process.env.DD_BOT_TOKEN) o.push('钉钉');
    if (process.env.TG_BOT_TOKEN) o.push('Telegram');
    return o;
}

function clip(s, max = 2000) {
    if (Buffer.byteLength(s, 'utf8') <= max) return s;
    let o = '';
    for (const ch of s) {
        if (Buffer.byteLength(o + ch, 'utf8') > max - 40) break;
        o += ch;
    }
    return o + '\n…（内容过长已截断）';
}

async function pushBuiltin(title, text) {
    const done = [];
    const errors = [];

    if (process.env.QYWX_AM) {
        const [corpId, secret, toUser, agentId] = String(process.env.QYWX_AM).split(',');
        if (!corpId || !secret || !agentId) {
            errors.push('企业微信应用 → 格式应为 企业ID,Secret,接收人,应用AgentId');
        } else if (!/^\d+$/.test(String(agentId).trim())) {
            errors.push(`企业微信应用 → AgentId 必须纯数字，现在是「${agentId}」`);
        } else {
            const t = await request(
                `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(secret)}`
            );
            const tk = t.json && t.json.access_token;
            if (!tk) {
                errors.push(`企业微信应用 → gettoken 失败：${(t.json && t.json.errmsg) || t.error || t.status}`);
            } else {
                const r = await request(
                    `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(tk)}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: {
                            touser: toUser || '@all',
                            msgtype: 'text',
                            agentid: Number(agentId),
                            text: { content: clip(text) },
                        },
                    }
                );
                const j = r.json || {};
                if (j.errcode === 0) done.push('企业微信应用');
                else errors.push(`企业微信应用 → errcode=${j.errcode} ${j.errmsg || ''}`);
            }
        }
    }

    if (process.env.QYWX_KEY) {
        const r = await request(
            `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${encodeURIComponent(process.env.QYWX_KEY)}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { msgtype: 'text', text: { content: clip(text) } } }
        );
        const j = r.json || {};
        if (j.errcode === 0) done.push('企业微信机器人');
        else errors.push(`企业微信机器人 → errcode=${j.errcode}`);
    }

    if (process.env.PUSH_PLUS_TOKEN) {
        const r = await request('https://www.pushplus.plus/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { token: process.env.PUSH_PLUS_TOKEN, title, content: clip(text, 18000), template: 'txt' },
        });
        const j = r.json || {};
        if (j.code === 200) done.push('PushPlus');
        else errors.push(`PushPlus → ${j.msg || r.status}`);
    }

    if (process.env.BARK) {
        let base = String(process.env.BARK).trim();
        if (!/^https?:\/\//i.test(base)) base = `https://api.day.app/${base}`;
        const r = await request(
            `${base.replace(/\/+$/, '')}/${encodeURIComponent(title)}/${encodeURIComponent(
                clip(text.split('\n').filter(Boolean).slice(0, 8).join('\n'), 480)
            )}?group=顺丰`,
            { method: 'GET' }
        );
        const j = r.json || {};
        if (j.code === 200) done.push('Bark');
        else errors.push(`Bark → ${j.message || r.status}`);
    }

    if (process.env.SCKEY) {
        const r = await request(`https://sctapi.ftqq.com/${process.env.SCKEY}.send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `title=${encodeURIComponent(title)}&desp=${encodeURIComponent(clip(text, 30000))}`,
        });
        const j = r.json || {};
        if (j.code === 0 || j.data) done.push('Server酱');
        else errors.push(`Server酱 → ${j.message || r.status}`);
    }

    if (process.env.DD_BOT_TOKEN) {
        let u = 'https://oapi.dingtalk.com/robot/send?access_token=' + process.env.DD_BOT_TOKEN;
        if (process.env.DD_BOT_SECRET) {
            const ts = Date.now();
            const sign = crypto
                .createHmac('sha256', process.env.DD_BOT_SECRET)
                .update(`${ts}\n${process.env.DD_BOT_SECRET}`)
                .digest('base64');
            u += `&timestamp=${ts}&sign=${encodeURIComponent(sign)}`;
        }
        const r = await request(u, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { msgtype: 'text', text: { content: clip(`${title}\n\n${text}`, 1800) } },
        });
        const j = r.json || {};
        if (j.errcode === 0) done.push('钉钉');
        else errors.push(`钉钉 → ${j.errcode}`);
    }

    if (process.env.TG_BOT_TOKEN) {
        if (!process.env.TG_CHAT_ID) {
            errors.push('Telegram → 缺 TG_CHAT_ID');
        } else {
            const r = await request(`https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: { chat_id: process.env.TG_CHAT_ID, text: clip(`${title}\n\n${text}`, 3500), disable_web_page_preview: true },
            });
            const j = r.json || {};
            if (j.ok) done.push('Telegram');
            else errors.push('Telegram → ' + String(j.description || r.status).slice(0, 60));
        }
    }

    return { done, errors };
}

function buildText(results) {
    const now = new Date().toLocaleString('zh-CN', { hour12: false });
    const L = [];
    L.push('🚚 顺丰速运+');
    L.push('');
    L.push(`${now} · ${results.length} 个账号`);
    L.push('────────────────');

    for (const r of results) {
        L.push('');
        L.push(`👤 ${r.mobile ? maskPhone(r.mobile) : '账号'}`);

        if (r.error && !r.signed) {
            L.push(`   ❌ ${r.error}`);
            if (r.expired) {
                L.push('   → 重新抓一次 Cookie 替换 SfsyUrl');
            }
            continue;
        }

        L.push(`   签到   ${r.already ? '💤 今日已签' : r.signed ? '✅ 成功' : '❌ 未签到'}` +
            (r.award ? ` · ${r.award}` : ''));
        if (r.autoSignAward) L.push(`   礼包   🎁 ${r.autoSignAward}`);
        L.push(`   连续   🔥${r.dayCount || 0}天`);
        if (r.tasksDone && r.tasksDone.length) {
            const tp = r.taskPoints ? ` · +${r.taskPoints}分` : '';
            L.push(`   任务   ✅ ${r.tasksDone.length} 个${tp}`);
        } else if (r.tasksNeedReal) {
            L.push(`   任务   ⏭️ ${r.tasksNeedReal} 个需真实寄件/下单`);
        }
        if (r.point != null) {
            const delta =
                r.pointBefore != null && r.point !== r.pointBefore
                    ? `（本次 ${r.point > r.pointBefore ? '+' : ''}${r.point - r.pointBefore}）`
                    : '';
            L.push(`   积分   💰${r.point}${delta}`);
        }
        if (!r.hasSession) L.push('   ⚠️ 缺 sessionId，无法签到');
    }

    L.push('');
    L.push('────────────────');
    const okN = results.filter((r) => r.signed).length;
    L.push(`📊 ✅ ${okN} 已签 · ❌ ${results.length - okN} 未签`);
    L.push('');
    L.push('Mist · 仅供学习');
    return L.join('\n');
}

function buildMd(results) {
    const now = new Date().toLocaleString('zh-CN', { hour12: false });
    const L = ['🚚 **顺丰速运+**', '', `${now} · ${results.length} 个账号`, '━━━━━━━━━━━━━━'];
    for (const r of results) {
        L.push('');
        L.push(`👤 **${r.mobile ? maskPhone(r.mobile) : '账号'}**`);
        if (r.error && !r.signed) {
            L.push(`> ❌ <font color="warning">${r.error}</font>`);
            continue;
        }
        L.push(`> 签到：${r.already ? '💤 已签' : r.signed ? '✅ 成功' : '❌ 未签'} · 🔥${r.dayCount || 0}天`);
        if (r.autoSignAward) L.push(`> 礼包：🎁 ${r.autoSignAward}`);
        if (r.tasksDone && r.tasksDone.length) {
            const tp = r.taskPoints ? ` · **+${r.taskPoints}分**` : '';
            L.push(`> 任务：✅ ${r.tasksDone.length} 个${tp}`);
        } else if (r.tasksNeedReal) {
            L.push(`> 任务：⏭️ ${r.tasksNeedReal} 个需真实寄件/下单`);
        }
        if (r.point != null) L.push(`> 积分：**${r.point}**`);
    }
    L.push('');
    L.push('Mist · 仅供学习');
    return L.join('\n');
}

async function push(title, text) {
    const channels = detectChannels();
    if (channels.length) {
        console.log(`   📨 渠道：${channels.join('、')}`);
        console.log('   📨 正在推送（文本）…');
        const { done, errors } = await pushBuiltin(title, text);
        if (done.length) {
            console.log(`   ✅ 推送成功：${done.join('、')}`);
            return;
        }
        if (errors.length) {
            console.log('   ⚠️  内置推送失败：');
            for (const e of errors) console.log(`      · ${e}`);
        }
    }
    try {
        const n = require('./sendNotify');
        const fn = typeof n.sendNotify === 'function' ? n.sendNotify : n;
        if (typeof fn === 'function') {
            await fn(title, text);
            console.log('   ✅ 已交给青龙推送');
            return;
        }
    } catch (e) {}
    if (!channels.length) {
        console.log('   ❌ 没有推送渠道（QYWX_AM / QYWX_KEY / PUSH_PLUS_TOKEN / BARK …）');
    } else {
        console.log('   ❌ 推送失败，请按上面原因检查');
    }
}

// ===========================================================================
// 九、保活模式（量真实存活时长）
// ===========================================================================

/**
 */
function keepaliveStatePath() {
    if (process.env.sf_state) return process.env.sf_state;
    const fs = require('fs');
    for (const d of ['/ql/data', '/ql/config', process.cwd()]) {
        try {
            fs.accessSync(d, fs.constants.W_OK);
            return require('path').join(d, 'sf_keepalive.json');
        } catch (e) {}
    }
    return require('path').join(process.cwd(), 'sf_keepalive.json');
}

function humanDur(ms) {
    if (ms < 0 || !isFinite(ms)) return '—';
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m} 分钟`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h < 24) return `${h} 小时 ${mm} 分`;
    return `${Math.floor(h / 24)} 天 ${h % 24} 小时`;
}

async function runKeepalive(creds) {
    const fs = require('fs');
    const p = keepaliveStatePath();

    let hist = {};
    try {
        hist = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {}

    console.log('');
    console.log('════════ 保活探测（只读，不签到不做任务）════════');
    console.log('');

    for (let i = 0; i < creds.length; i++) {
        const c = creds[i];
        const ucm = new Ucm(c);
        const mcs = new Mcs(c);
        const now = Date.now();

        const key = (ucm.suuid || 'no-suuid') + '|' + (mcs.sessionId || 'no-sess');
        const rec = hist[key] || { mobile: '', first: 0, lastAlive: 0, checks: 0, deadAt: 0 };
        rec.mobile = c._login_mobile_ || rec.mobile || '';
        if (!rec.first) rec.first = now;
        rec.checks++;

        const who = rec.mobile ? maskPhone(rec.mobile) : `账号${i + 1}`;
        console.log(`   👤 ${who}`);

        // A 引擎
        let aAlive = null;
        if (ucm.ok) {
            const t = await ucm.todaySign();
            aAlive = !t.expired && t.ok;
            console.log(`      UCM(suuid)     ${aAlive ? '✅ 存活' : '❌ 已失效'}`);
        } else {
            console.log('      UCM(suuid)     ⏭️ 未提供');
        }

        // B 引擎
        let bAlive = null;
        if (mcs.ok) {
            const pr = await mcs.probe();
            const t = pr.ok ? await mcs.todaySign() : { expired: true };
            bAlive = pr.ok && !t.expired && t.ok;
            if (bAlive) {
                const o = t.obj || {};
                console.log(`      MCS(sessionId) ✅ 存活   已签=${o.signed === true} 连续=${o.dayCount || 0}天`);
            } else {
                console.log(`      MCS(sessionId) ❌ 已失效  ${pr.reason || '100111'}`);
            }
        } else {
            console.log('      MCS(sessionId) ⏭️ 未提供');
        }

        const anyAlive = aAlive === true || bAlive === true;
        if (anyAlive) {
            rec.lastAlive = now;
            if (aAlive === false || bAlive === false) {
                rec.partialAt = rec.partialAt || now;
            }
        } else {
            rec.deadAt = rec.deadAt || now;
        }

        // 已观测时长
        const observed = (rec.deadAt || now) - rec.first;
        console.log(`      ── 已观测 ${humanDur(observed)} · 第 ${rec.checks} 次探测`);
        if (rec.deadAt && rec.lastAlive) {
            console.log(`         最后存活 → 失效间隔：${humanDur(rec.deadAt - rec.lastAlive)}`);
        }

        hist[key] = rec;
        if (i < creds.length - 1) await sleep(1200);
    }

    try {
        fs.writeFileSync(p, JSON.stringify(hist, null, 2), 'utf8');
        console.log('');
        console.log(`   📁 状态已记录：${p}`);
    } catch (e) {
        console.log('   ⚠️  状态写入失败：' + e.message);
    }

    console.log('');
    console.log('   用法：把 sfkeep=1 挂成每小时一次的定时任务，');
    console.log('         跑一天后回来看这个文件，就是你凭证的真实存活时长。');
}

// ===========================================================================
// 十、主程序
// ===========================================================================

function collectCreds() {
    const lines = String(process.env[ENV_ACCOUNT] || '')
        .split(/[\r\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);

    const extra = {};
    if (process.env[ENV_CK]) extra.suuid = String(process.env[ENV_CK]).trim();
    if (process.env[ENV_SESS]) extra.sessionId = String(process.env[ENV_SESS]).trim();

    const out = lines.map((l) => {
        const m = parseCred(l);
        return Object.assign({}, extra, m);
    });
    if (!out.length && Object.keys(extra).length) out.push(extra);
    return out;
}

async function main() {
    console.log('');
    console.log('🚚 顺丰速运+ · Mist');
    console.log('   仅供学习研究，请勿用于商业用途');
    if (CHECK_MODE) console.log('   🔎 自检模式');
    if (KEEPALIVE) console.log('   💓 保活模式');
    if (PROBE_ONLY) console.log('   🔬 深度探测模式');
    if (NO_SIGN) console.log('   ⚡ 不生成签名（服务端不校验）');
    if (VERBOSE) console.log('   📄 详细日志');
    console.log('');

    const creds = collectCreds();
    if (!creds.length) {
        console.log(`❌ 没找到凭证，请配置环境变量 ${ENV_ACCOUNT}`);
        console.log('   示例：');
        console.log('   suuid=3634aad33f6f437ca7566d4a79c7cac7; sessionId=09A37C49...; _login_mobile_=185xxxxxxxx');
        return;
    }
    console.log(`📱 ${creds.length} 个账号`);

    if (CHECK_MODE) {
        console.log('');
        console.log('════════ 凭证自检（只探测，不消耗）════════');
        const rs = [];
        for (let i = 0; i < creds.length; i++) rs.push(await checkCred(creds[i], i));
        console.log('');
        console.log('════════ 结论 ════════');
        const u = rs.filter((r) => r.ucm && r.ucm.ok).length;
        const m = rs.filter((r) => r.mcs && r.mcs.ok).length;
        console.log(`  UCM(suuid)     ✅ ${u} / ${rs.length}`);
        console.log(`  MCS(sessionId) ✅ ${m} / ${rs.length}`);
        console.log('');
        console.log('  说明：');
        console.log('    · 签到只能走 MCS，必须 sessionId');
        console.log('    · 查总积分走 UCM，必须 suuid');
        console.log('    · 两者完全隔离，互不通用（已实测）');
        console.log('');
        console.log('  CK 存活时间（2026-10-18 实测）：');
        console.log('    suuid     UCM 会话，响应头无任何续期字段；实测抓包后 81 分钟仍有效');
        console.log('    sessionId MCS 会话 Cookie，Set-Cookie 里也没有它 → 不靠 Cookie 续期');
        console.log('    · 两者都不会「越用越久」，但也都不主动踢人');
        console.log('');
        console.log('  想量出你自己的真实存活时长 → 用 sfkeep=1 保活模式');
        console.log('  想知道签名/接口是否还有效 → 用 sf_probe=1 深度探测');
        return;
    }

    // 深度探测模式：只读，回答「签名校不校验」「哪个接口废了」
    if (PROBE_ONLY) {
        const results = [];
        results._credMap = creds[0];
        console.log('');
        console.log('════════ 深度探测（只读，不改任何业务状态）════════');
        for (let i = 0; i < creds.length; i++) {
            const c = creds[i];
            console.log('');
            console.log(`🔐 账号 ${i + 1}${c._login_mobile_ ? ' · ' + maskPhone(c._login_mobile_) : ''}`);
            await checkCred(c, i);
            results._credMap = c;
            await deepProbe(results);
        }
        return;
    }

    if (KEEPALIVE) {
        await runKeepalive(creds);
        return;
    }

    const results = [];
    for (let i = 0; i < creds.length; i++) {
        const c = creds[i];
        console.log('');
        console.log(`🔐 账号 ${i + 1}${c._login_mobile_ ? ' · ' + maskPhone(c._login_mobile_) : ''}`);
        try {
            results.push(await runAccount(c, makeLog()));
        } catch (e) {
            console.log('   ❌ 执行异常：' + e.message);
            results.push({ mobile: c._login_mobile_ || '', error: '执行异常：' + e.message });
        }
        if (i < creds.length - 1) await sleep(1500 + Math.random() * 2000);
    }

    // 汇总
    console.log('');
    console.log('════════════════════════════════════════');
    for (const r of results) {
        const who = r.mobile ? maskPhone(r.mobile) : '账号';
        if (r.error && !r.signed) {
            console.log(`👤 ${who}`);
            console.log(`   ❌ ${r.error}`);
            continue;
        }
        const bits = [];
        bits.push(r.already ? '💤今日已签' : r.signed ? '✅签到成功' : '❌未签到');
        bits.push(`🔥${r.dayCount || 0}天`);
        if (r.tasksDone && r.tasksDone.length) bits.push(`✅任务${r.tasksDone.length}个`);
        if (r.point != null) {
            const d =
                r.pointBefore != null && r.point !== r.pointBefore
                    ? `(${r.point > r.pointBefore ? '+' : ''}${r.point - r.pointBefore})`
                    : '';
            bits.push(`💰${r.point}分${d}`);
        }
        console.log(`👤 ${who}`);
        console.log('   ' + bits.join(' · '));
    }
    console.log('════════════════════════════════════════');

    const okN = results.filter((r) => r.signed).length;
    console.log(`   📊 ✅ ${okN} 已签 · ❌ ${results.length - okN} 未签`);

    const fmt = String(process.env[ENV_PUSH] || 'text').toLowerCase();
    if (['off', '0', 'none'].includes(fmt)) {
        console.log('   ⏭️  已关闭推送');
        return;
    }
    const text = ['md', 'markdown'].includes(fmt) ? buildMd(results) : buildText(results);
    await push('顺丰速运+', text);
}

function makeLog() {
    return {
        info: (m) => console.log('   📝 ' + m),
        success: (m) => console.log('   ✅ ' + m),
        warning: (m) => console.log('   ⚠️  ' + m),
        error: (m) => console.log('   ❌ ' + m),
        detail: (m) => {
            if (VERBOSE) console.log('   📄 ' + m);
        },
    };
}

process.on('unhandledRejection', (e) => {
    console.log('❌ 未捕获异常：' + (e && e.message ? e.message : e));
});

if (require.main === module) {
    main().catch((e) => {
        console.log('❌ 致命错误：' + (e && e.stack ? e.stack : e));
        process.exit(1);
    });
}

module.exports = {
    ucmSign,
    mcsSign,
    parseCred,
    Ucm,
    Mcs,
    checkCred,
    deepProbe,
    probeSignStrength,
    probeEndpoints,
    runAccount,
    buildText,
    buildMd,
    UCM_APPID,
    UCM_KEY,
    MCS_TOKEN,
    MCS_SYS,
};
