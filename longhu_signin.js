/* -------------------------------------------------------------------------
 *  项目名称：龙湖天街（每日签到 + token 续期）
 *  脚本文件：longhu_signin.js
 *  更新说明：
 *    2026-11-09  Mist  仓库首发：双入口签到、token 滑动续期、顶象指纹、紧凑推送
 * -------------------------------------------------------------------------
 */
/**
 * ============================================================================
 *  「龙湖天街」· 每日签到 + token 自动续期（青龙面板版 · 纯 HTTP 零依赖）
 * ============================================================================
 *
 *  作    者：Mist
 *  版    本：v1.0
 *  参考实现：https://github.com/ken861222/longhu-checkin（Python/FastAPI 版，
 *            本项目只取算法与协议结论，代码全部重写成单文件 Node 脚本）
 *  账    号：龙湖会员 token（32 位十六进制，抓一次包，之后靠续期活着）
 *
 * ----------------------------------------------------------------------------
 *  【这条路是怎么走通的】
 * ----------------------------------------------------------------------------
 *  龙湖天街（龙湖集团 / 珑珠会员）的签到接口挂在开放网关上：
 *
 *      网关    https://gw2c-hw-open.longfor.com
 *      业务域  lmarketing-task-api-mvc-prod/openapi/task/v1/signature/*
 *
 *  一、两个签到入口，一天各签一次，成长值叠加
 *
 *      小程序  activity_no = 11111111111686241863606037740000   「日日签 日日赚」
 *      APP     activity_no = 11111111111736501868255956070000   「APP签到 奖励翻倍」
 *
 *      两个活动共用同一个登录态（token / channel=C2 / buCode=C20400 完全一样），
 *      只是活动号不同，所以导入一次就能两边都签。基础各 +5 成长值，
 *      连签进度到点还会额外给（实测一周双签约 118 成长值）。
 *
 *      查状态：POST .../signature/page-info   { activity_no }
 *      签  到：POST .../signature/clock       { activity_no }
 *
 *  二、请求签名 X-LONGZHU-Sign
 *
 *      params_str = 请求体按键名排序，拼成 k=v|k=v|…（跳过空值、null、对象）
 *      sign       = md5( [params_str + "&"] + 毫秒时间戳 + "&" + 客户端密钥 )
 *
 *      密钥是前后端共享的客户端常量（随 App / 小程序公开下发，不是服务端私钥），
 *      按 X-Client-Type 分两套：
 *
 *          microApp  Q74eKtH5LePYfSjIiflUbCL2gxjTa7rF   ← 签到链路用这套
 *          app       20jtGtg5TQ9V1A3Q4RsxBzJqb@^WUS%m   ← 短信登录用这套
 *
 *      ★ 自检方法（已实测）：token2key 故意写错签名 → 500「小湖忙晕了」；
 *        签名正确、token 无效 → 406「token验证出错」。这两个回包能一眼分清
 *        是「密钥过期」还是「token 过期」。
 *
 *  三、token 自动续期（本脚本的核心）
 *
 *      token ==[ token2key ]==> key ==[ key2token ]==> token'（有效期重置 30 天）
 *
 *        POST /supera/mine/v2_6_0/token/token2key                  （带签名头）
 *        POST /lmember-lpns-api-prod/api/lpns/auth/v1/key2token    （走钱包 key）
 *
 *      返回的 token 通常与原 token 完全一样，但服务端把有效期重新起算 30 天，
 *      也就是滑动过期：只要每天跑一次，就永远不会失效。
 *      只有连续停机超过 30 天才需要重新抓一次 token。
 *
 *  四、设备指纹 X-LF-DXRisk-Token（这是唯一的难点）
 *
 *      签到接口要求带顶象（dingxiang-inc）设备指纹，缺了会被风控拦：
 *
 *          8040012 / 8040016  网络故障，请稍后再试        ← 文案骗人，其实是缺人机验证
 *          801810 / 801811    活动太火爆了，明日再来试试~
 *
 *      而且一个账号必须一份指纹：同一指纹挂两个号会被判「同一设备多账号」。
 *      早期只能从 App 的 localStorage 里抠 _dx_app_<appId>，一换号就重装 App。
 *
 *      本脚本换了条路：把顶象 SDK 的签发链路整条搬进 Node（见同目录
 *      longhu_dxrisk.js）。它只需要账号 token 当本地派生盐，就能自己签一份
 *      账号专属指纹上报 https://ly-sta.longhu.net/udid/m1：
 *
 *          seed = protobuf{1:设备消息, 2:1002, 3:map{K451:ms, K452:ms, ...164 项}}
 *          sign = md5(appKey + seed + appKey)
 *          body = XXTEA(zip{entry data -> seed}, key=ea8a55a43621eacd)
 *
 *      同一 token → 同一台「设备」（跨机器、跨容器稳定），不同 token → 不同设备。
 *      签出来的指纹会落盘缓存（longhu_dx_cache.json），之后每天复用同一份，
 *      不会天天换设备 —— 这点很重要，指纹是资产不是消耗品。
 *
 *      ★ 换机 / 被风控要求滑块时的正确姿势：在 App 里手动签一次并把滑块拖到底，
 *        只拖一次。反复拿新指纹去试会把信任分扣光，反而更签不上。
 *
 *  五、三态严格判定（很多同类脚本就死在这里）
 *
 *      只认两种铁证，不看文案：
 *        1) clock 回 code=0000 且 data.is_popup=1 → 真签上了，reward_info 里有奖励明细
 *        2) page-info 的今日格子 sign_status=20   → 服务端日历标了已签
 *
 *      凡是「接口说成功但日历没变」「接口报错但日历已签」，一律以日历为准。
 *      这样既不会把失败报成「今日已签」，也不会因为回包异常白丢一天。
 *
 *  六、错误码表（脚本按这张表判状态）
 *
 *      0000     成功
 *      801001   您的登录已过期，请重新登录        → token 失效
 *      801007   用户未登录                       → token 没带 / 带错
 *      406      10006 token验证出错，请重新登陆    → token 过期，重新抓
 *      500      小湖忙晕了                       → 签名密钥失效（龙湖改版，见下）
 *      801810   活动太火爆了，明日再来试试~        → 风控：需要一次人工滑块
 *      801811   需要滑块验证                     → 同上
 *      801812   风控拦截                         → 同上
 *      8040012  网络故障，请稍后再试              → 风控：缺 X-LF-DXRisk-Captcha-Token
 *      8040016  网络故障，请稍后再试              → 同上
 *      909001   请操作图形验证                   → 发短信要滑块（本脚本不登录，无关）
 *
 * ----------------------------------------------------------------------------
 *  【青龙配置】
 * ----------------------------------------------------------------------------
 *  环境变量（必需）
 *    longhu_token   龙湖 token，多账号换行。三种写法都认：
 *
 *                      a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6         ← 只有 token
 *                      主号#a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6     ← 备注#token
 *                      小号#a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6#xiaomi14  ← 备注#token#机型
 *
 *                  机型可选值：pixel7（默认）/ xiaomi14 / oneplus12 /
 *                  vivo_x100 / samsung_s24。多账号建议错开机型，一批号全来自
 *                  同一套设备画像本身也是特征。
 *
 *  环境变量（可选）
 *    longhu_dx          真机 App 设备指纹，一般不用填（脚本自动签发）。
 *                       只在你已经有 App 里那份值、想强制用它时才填。
 *                       按行与 longhu_token 对应，也可以写 备注#指纹。
 *    longhu_dx_profile  默认机型，默认 pixel7
 *    longhu_dx_fresh    on = 丢掉缓存的指纹重新签一份（换机 / 被风控后偶尔用），默认 off
 *    longhu_app         APP 入口模式：auto（默认，真签）/ manual（只查不签）/ off
 *    longhu_push        on/off/dry，推送开关，默认 on；dry = 只打印不发送
 *    longhu_push_style  推送版式：simple（默认，一条看完）/ full（每号一段，排错用）
 *    TYpush             on/off，推送总开关
 *    longhu_delay       多账号随机间隔（秒），默认 5-15
 *    longhu_debug       on/off，打印原始报文
 *
 *  定时规则（cron）： 10 8 * * *
 *  任务名称        ： 龙湖天街签到
 *  命令            ： task longhu_signin.js
 *
 *  目录约定（青龙扁平上传即可，脚本自己多候选找文件）：
 *      longhu_signin.js      本文件（主入口）
 *      longhu_dxrisk.js      指纹签发模块（必需，跟主脚本放同一目录）
 *      sendNotify.js         推送模块（青龙自带，没有就降级为内置渠道）
 *      longhu_dx_cache.json  指纹缓存（脚本自动生成，删了会重新签一份新设备）
 *
 * ----------------------------------------------------------------------------
 *  【怎么拿到 longhu_token】
 * ----------------------------------------------------------------------------
 *  手机 App 或微信小程序进龙湖会员中心 → 抓一个发往 gw2c-hw-open.longfor.com
 *  的请求，取下列任一处的值（都等价，32 位十六进制）：
 *
 *      请求头  X-LF-UserToken   /   lmToken   /   token
 *      响应体  data.token（登录 / 续期接口）
 *
 *  抓到后填进 longhu_token 即可，之后靠本脚本每天续期，不用再抓。
 *
 * ----------------------------------------------------------------------------
 *  【免责声明】
 * ----------------------------------------------------------------------------
 *  仅供个人学习与自用账号自动化，请勿用于批量、代挂或其他用途。
 *  脚本只调用官方公开接口，不修改任何数据，签到结果以 App 内显示为准。
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const crypto = require('crypto');

// ============================================================================
// 一、环境变量名
// ============================================================================

const ENV_TOKEN = 'longhu_token';
const ENV_DX = 'longhu_dx';
const ENV_DX_PROFILE = 'longhu_dx_profile';
const ENV_DX_FRESH = 'longhu_dx_fresh';
const ENV_APP = 'longhu_app';
const ENV_PUSH = 'longhu_push';
const ENV_PUSH_STYLE = 'longhu_push_style'; // simple(默认紧凑) / full(明细)
const ENV_TY_PUSH = 'TYpush';
const ENV_DELAY = 'longhu_delay';
const ENV_DEBUG = 'longhu_debug';

// ============================================================================
// 二、常量（全部来自逆向，见文件头）
// ============================================================================

const BASE = 'https://gw2c-hw-open.longfor.com';

/** 客户端签名密钥：签到链路用 microApp 这套 */
const SIGN_SECRET_MICRO_APP = 'Q74eKtH5LePYfSjIiflUbCL2gxjTa7rF';
/** App 端短信登录用这套（本脚本不登录，留作备忘） */
const SIGN_SECRET_APP = '20jtGtg5TQ9V1A3Q4RsxBzJqb@^WUS%m';

const API_KEY_MAIN = 'c06753f1-3e68-437d-b592-b94656ea5517';
const API_KEY_MEMBER = '98717e7a-a039-46af-8143-be7558a089c0';
const API_KEY_WALLET = 'f4a2290e-c382-45b7-949c-3253d07e9b5b';

/** 两个签到入口：同一天各签一次，成长值叠加 */
const ACT_MINI = '11111111111686241863606037740000';
const ACT_APP = '11111111111736501868255956070000';

const BU_CODE = 'C20400';
const CHANNEL = 'C2';
const API_VERSION = 'v2_6_0';
const APP_VERSION = '2.6.0';
const THIRTY_DAYS = 30;

/** 小程序 WebView 的默认 UA：UA 突变会被风控，别改 */
const DEFAULT_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/144.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI ' +
    'MiniProgramEnv/Mac MacWechat/WMPF MacWechat/3.8.7(0x13080712) ' +
    'UnifiedPCMacWechat(0xf2641d55) XWEB/25561';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);

const DEBUG = /^(1|on|true|yes|y)$/i.test(String(process.env[ENV_DEBUG] || '').trim());
const flag = (name, dft) =>
    /^(1|on|true|yes|y)$/i.test(String(process.env[name] === undefined ? (dft || 'on') : process.env[name]).trim());

// ============================================================================
// 三、终端排版
// ============================================================================

function strWidth(s) {
    let w = 0;
    for (const ch of String(s)) {
        const c = ch.codePointAt(0);
        if (
            (c >= 0x1100 && c <= 0x115f) ||
            (c >= 0x2e80 && c <= 0xa4cf) ||
            (c >= 0xac00 && c <= 0xd7a3) ||
            (c >= 0xf900 && c <= 0xfaff) ||
            (c >= 0xfe30 && c <= 0xfe6f) ||
            (c >= 0xff00 && c <= 0xff60) ||
            (c >= 0xffe0 && c <= 0xffe6) ||
            (c >= 0x1f300 && c <= 0x1f9ff)
        ) {
            w += 2;
        } else {
            w += 1;
        }
    }
    return w;
}

const padR = (s, n) => {
    const str = String(s);
    const w = strWidth(str);
    return w >= n ? str : str + ' '.repeat(n - w);
};

const line = (w) => '─'.repeat(w || 58);

function section(t, w) {
    console.log('');
    console.log('  ' + line(w || 58));
    console.log('   ' + t);
    console.log('  ' + line(w || 58));
}

// ============================================================================
// 四、签名
// ============================================================================

/** md5 小写十六进制 */
const md5 = (s) => crypto.createHash('md5').update(String(s), 'utf8').digest('hex');

const jsStr = (v) => {
    if (v === null || v === undefined) return 'null';
    if (v === true) return 'true';
    if (v === false) return 'false';
    return String(v);
};

/**
 * 拼签名串：按键名排序，k=v 用 | 连接，跳过空值 / null / 对象
 * 对应前端 getSignHeader 里的归一化函数
 */
function signSource(body) {
    const parts = [];
    const keys = Object.keys(body || {}).sort();
    for (const k of keys) {
        const v = body[k];
        if (v !== null && typeof v === 'object') continue; // 对象 / 数组不参与签名
        const text = jsStr(v);
        if (String(text).trim() && text !== 'null') parts.push(k + '=' + text);
    }
    return parts.join('|');
}

/**
 * 生成 X-LONGZHU-* 签名头
 * @param {object} body    请求体（必须与实际发送的 body 完全一致）
 * @param {string} client  microApp（签到）/ app（短信登录）
 */
function signHeaders(body, client) {
    const secret = client === 'app' ? SIGN_SECRET_APP : SIGN_SECRET_MICRO_APP;
    const joined = signSource(body);
    const ts = String(Date.now());
    const raw = (joined ? joined + '&' : '') + ts + '&' + secret;
    return {
        'X-LONGZHU-TimeStamp': ts,
        'X-Client-Type': client === 'app' ? 'app' : 'microApp',
        'X-LONGZHU-Sign': md5(raw),
    };
}

// ============================================================================
// 五、HTTP
// ============================================================================

function request(opts) {
    return new Promise((resolve, reject) => {
        const u = new URL(opts.url);
        const lib = u.protocol === 'https:' ? https : http;
        const headers = Object.assign({}, opts.headers || {});
        let body = null;
        if (opts.data !== undefined && opts.data !== null) {
            body = Buffer.from(typeof opts.data === 'string' ? opts.data : JSON.stringify(opts.data), 'utf8');
            headers['Content-Length'] = body.length;
        }
        const req = lib.request(
            {
                protocol: u.protocol,
                hostname: u.hostname,
                port: u.port || (u.protocol === 'https:' ? 443 : 80),
                path: u.pathname + u.search,
                method: opts.method || 'POST',
                headers: headers,
                timeout: opts.timeout || 20000,
            },
            (res) => {
                const cs = [];
                res.on('data', (c) => cs.push(c));
                res.on('end', () => {
                    let buf = Buffer.concat(cs);
                    const enc = String(res.headers['content-encoding'] || '').toLowerCase();
                    try {
                        if (enc.indexOf('gzip') >= 0) buf = zlib.gunzipSync(buf);
                        else if (enc.indexOf('br') >= 0) buf = zlib.brotliDecompressSync(buf);
                        else if (enc.indexOf('deflate') >= 0) buf = zlib.inflateSync(buf);
                    } catch (e) {
                        /* 解不开就用原文 */
                    }
                    resolve({ status: res.statusCode, headers: res.headers, text: buf.toString('utf8') });
                });
            }
        );
        req.on('timeout', () => req.destroy(new Error('请求超时')));
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

/** 接口有时回裸 JSON，有时回 base64 包裹的 JSON，两种都吃 */
function decode(text) {
    const s = String(text || '').trim();
    try {
        return JSON.parse(s);
    } catch (e) {
        /* 继续试 base64 */
    }
    try {
        return JSON.parse(Buffer.from(s, 'base64').toString('utf8'));
    } catch (e) {
        return { code: 'BADJSON', message: s.slice(0, 160) };
    }
}

async function post(pathname, headers, body, tries) {
    const n = tries || 3;
    let lastErr = null;
    for (let i = 0; i < n; i++) {
        try {
            const r = await request({
                url: BASE + pathname,
                method: 'POST',
                headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
                data: body === undefined ? {} : body,
            });
            const j = decode(r.text);
            if (DEBUG) console.log('      > POST ' + pathname + ' [' + r.status + '] ' + JSON.stringify(j).slice(0, 300));
            return j;
        } catch (e) {
            lastErr = e;
            if (i < n - 1) await sleep(rand(800, 1800));
        }
    }
    return { code: 'NETERR', message: '网络异常：' + (lastErr ? lastErr.message : '未知') };
}

async function get(pathname, headers, tries) {
    const n = tries || 3;
    let lastErr = null;
    for (let i = 0; i < n; i++) {
        try {
            const r = await request({ url: BASE + pathname, method: 'GET', headers: headers });
            const j = decode(r.text);
            if (DEBUG) console.log('      > GET ' + pathname + ' [' + r.status + '] ' + JSON.stringify(j).slice(0, 300));
            return j;
        } catch (e) {
            lastErr = e;
            if (i < n - 1) await sleep(rand(800, 1800));
        }
    }
    return { code: 'NETERR', message: '网络异常：' + (lastErr ? lastErr.message : '未知') };
}

// ============================================================================
// 六、文件定位与缓存
// ============================================================================

/** 多候选找同目录文件：本地分层（主脚本/）与青龙扁平（/ql/data/scripts/）都能跑 */
function resolveFile(name) {
    const cands = [
        path.join(__dirname, name),
        path.join(__dirname, '主脚本', name),
        process.env.QL_DIR ? path.join(process.env.QL_DIR, 'data', 'scripts', name) : '',
        path.join('/ql/data/scripts', name),
        path.join('/ql/scripts', name),
        path.join(process.cwd(), name),
    ].filter(Boolean);
    for (const p of cands) {
        try {
            if (fs.existsSync(p)) return p;
        } catch (e) {
            /* 忽略 */
        }
    }
    return cands[0];
}

const DX_CACHE_FILE = resolveFile('longhu_dx_cache.json');

function loadDxCache() {
    try {
        const j = JSON.parse(fs.readFileSync(DX_CACHE_FILE, 'utf8'));
        return j && typeof j === 'object' ? j : {};
    } catch (e) {
        return {};
    }
}

function saveDxCache(cache) {
    try {
        fs.writeFileSync(DX_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
    } catch (e) {
        console.log('   ⚠️  指纹缓存写入失败（' + e.message + '），下次会重新签发');
    }
}

// ============================================================================
// 七、业务接口
// ============================================================================

/** token2key / key2token 用的头（含签名） */
function mineHeaders(token) {
    const s = signHeaders({}, 'microApp');
    return {
        lmToken: token,
        'X-LF-Bucode': BU_CODE,
        'X-LF-Api-Version': API_VERSION,
        'X-LF-Channel': CHANNEL,
        'X-LF-App-Version': APP_VERSION,
        'User-Agent': DEFAULT_UA,
        Origin: 'https://longzhu.longfor.com',
        Referer: 'https://longzhu.longfor.com/',
        'X-LONGZHU-TimeStamp': s['X-LONGZHU-TimeStamp'],
        'X-Client-Type': s['X-Client-Type'],
        'X-LONGZHU-Sign': s['X-LONGZHU-Sign'],
    };
}

/**
 * 滚动续期：token2key -> key2token，把有效期重新起算 30 天
 * @returns {Promise<object>} { ok, token, code, msg, changed }
 */
async function refreshToken(account) {
    const token = account.token;
    const j1 = await post('/supera/mine/' + API_VERSION + '/token/token2key', mineHeaders(token), {});
    const key = j1 && j1.data && j1.data.key ? String(j1.data.key) : '';
    if (!key) {
        return {
            ok: false,
            code: String(j1.code),
            msg: j1.message || j1.extraMessage || 'token2key 未返回 key',
        };
    }

    const walletHeaders = {
        'X-Gaia-Api-Key': API_KEY_WALLET,
        systype: 'WALLET',
        'User-Agent': DEFAULT_UA,
        Origin: 'https://longball.longhu.net',
        Referer: 'https://longball.longhu.net/',
    };
    const j2 = await post(
        '/lmember-lpns-api-prod/api/lpns/auth/v1/key2token',
        walletHeaders,
        { key: key, buCode: BU_CODE, channel: CHANNEL }
    );
    const data = (j2 && j2.data) || {};
    const newToken = data.token ? String(data.token) : '';
    if (String(j2.code) === '0000' && newToken) {
        return { ok: true, code: '0000', token: newToken, changed: newToken !== token };
    }
    return {
        ok: false,
        code: String(j2.code),
        msg: j2.message || j2.extraMessage || 'key2token 未返回 token',
    };
}

/** 活动接口（page-info / clock）共用头 */
function taskHeaders(account, dx) {
    const h = {
        'User-Agent': DEFAULT_UA,
        Origin: 'https://longzhu.longfor.com',
        Referer: 'https://longzhu.longfor.com/',
        'X-LF-DXRisk-Source': '5',
        'X-LF-Bu-Code': BU_CODE,
        // 必须用签到专用 key：沿用抓包里的会员接口 key 会 401
        'X-GAIA-API-KEY': API_KEY_MAIN,
        'X-LF-UserToken': account.token,
        'X-LF-Channel': CHANNEL,
        // 未过滑块时前端就是原样发字符串 undefined（抓包可见）
        'X-LF-DXRisk-Captcha-Token': 'undefined',
        token: account.token,
    };
    if (dx) h['X-LF-DXRisk-Token'] = dx;
    return h;
}

/** 用户信息：成长值 / 等级 / 昵称 / 脱敏手机号 */
async function userInfo(account) {
    const h = {
        'User-Agent': DEFAULT_UA,
        lmToken: account.token,
        'X-Gaia-Api-Key': API_KEY_MEMBER,
        'X-LF-Bucode': BU_CODE,
        'X-LF-Channel': CHANNEL,
        'X-LF-Api-Version': API_VERSION,
        'Content-Type': 'application/json',
    };
    const j = await get('/supera/member/api/bff/pages/' + API_VERSION + '/v1/user-info', h);
    if (String(j.code) !== '0000') {
        return { ok: false, code: String(j.code), msg: j.message || j.extraMessage || '用户信息查询失败' };
    }
    const d = j.data || {};
    return {
        ok: true,
        growth: Number(d.growthValue || 0),
        level: d.levelName || '',
        nick: d.nickName || d.nickname || '',
        phone: d.desensitizePhone || '',
    };
}

/** 珑珠余额 */
async function lzBalance(account) {
    const h = {
        'User-Agent': DEFAULT_UA,
        lmToken: account.token,
        'X-Gaia-Api-Key': API_KEY_MEMBER,
        'X-LF-Bucode': BU_CODE,
        'X-LF-Channel': CHANNEL,
        'X-LF-Api-Version': API_VERSION,
        'Content-Type': 'application/json',
    };
    const j = await get('/supera/member/api/bff/pages/' + API_VERSION + '/v2/user-lz-balance', h);
    if (String(j.code) !== '0000') return null;
    const d = j.data || {};
    return { balance: Number(d.balance || 0), expiring: Number(d.expiringLz || 0) };
}

/**
 * 查签到日历：今天签没签
 * @returns {Promise<object>} { state: true/false/null, days, code }
 */
async function signState(account, dx, activityNo) {
    const j = await post(
        '/lmarketing-task-api-mvc-prod/openapi/task/v1/signature/page-info',
        Object.assign({ 'Content-Type': 'application/json;charset=UTF-8' }, taskHeaders(account, dx)),
        { activity_no: activityNo }
    );
    if (String(j.code) !== '0000') {
        return { state: null, msg: j.message || 'code=' + j.code, code: String(j.code) };
    }
    const d = j.data || {};
    // 用服务端时间判断「今天」，避免容器时区与龙湖不一致
    let today = new Date();
    if (d.current_date_time) {
        const t = new Date(Number(d.current_date_time));
        if (!isNaN(t.getTime())) today = t;
    }
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const day = today.getDate();
    const signs = d.seven_days_signs || [];
    for (const item of signs) {
        if (Number(item.sign_year) === y && Number(item.sign_month) === m && Number(item.sign_day) === day) {
            // 20 = 已签到，10 = 未签到
            return { state: Number(item.sign_status) === 20, days: signs.length };
        }
    }
    return { state: null, days: signs.length };
}

const RISK_CODES = ['801810', '801811', '801812', '8040012', '8040016'];
const DEAD_CODES = ['801001', '801007', '900006', '401', '406'];

function isDeadCode(code, message) {
    if (DEAD_CODES.indexOf(String(code)) >= 0) return true;
    return /登录已过期|用户未登录|请重新登录|token验证出错/i.test(String(message || ''));
}

/**
 * 执行签到（严格三态：以日历为准，不轻信回包文案）
 * @returns {Promise<object>} { status: ok/already/risk/fail/dead, msg, reward, code }
 */
async function checkin(account, dx, activityNo, label) {
    const before = await signState(account, dx, activityNo);
    if (before.state === true) return { status: 'already', msg: label + '今日已签到' };

    const j = await post(
        '/lmarketing-task-api-mvc-prod/openapi/task/v1/signature/clock',
        Object.assign({ 'Content-Type': 'application/json;charset=UTF-8' }, taskHeaders(account, dx)),
        { activity_no: activityNo }
    );
    const code = String(j.code);
    const data = j.data || {};
    const message = j.message || j.extraMessage || '';

    if (code === '0000') {
        if (Number(data.is_popup) === 1) {
            let reward = 0;
            for (const it of data.reward_info || []) reward += Number(it.reward_num || 0);
            return {
                status: 'ok',
                msg: label + '签到成功' + (reward > 0 ? '，+' + reward + ' 成长值' : ''),
                reward: reward,
            };
        }
        // is_popup=0：可能本来已签，也可能接口假成功 -> 用日历复核
        const after = await signState(account, dx, activityNo);
        if (after.state === false) {
            return { status: 'fail', msg: label + '接口回成功但日历仍未签，稍后重试', code: code };
        }
        return { status: 'already', msg: label + '今日已签到' };
    }

    // 兜底：接口报错但可能已经签上（历史上出现过报错但状态已更新）
    const verify = await signState(account, dx, activityNo);
    if (verify.state === true) {
        return { status: 'ok', msg: label + '签到成功（接口回 ' + code + '，已按日历确认）', reward: 0 };
    }

    if (isDeadCode(code, message)) return { status: 'dead', msg: explain(code, message), code: code };
    if (RISK_CODES.indexOf(code) >= 0) {
        return { status: 'risk', msg: label + '被风控：' + explain(code, message), code: code };
    }
    return { status: 'fail', msg: label + '签到失败：' + explain(code, message), code: code };
}

// ============================================================================
// 八、脱敏 / 错误码翻译
// ============================================================================

function explain(code, msg) {
    switch (String(code)) {
        case '0000':
            return '成功';
        case '801001':
            return 'token 已失效（801001 您的登录已过期），重新抓一次 longhu_token';
        case '801007':
            return '缺少登录态（801007 用户未登录），检查 longhu_token';
        case '900006':
            return '登录已过期（900006），重新抓一次 longhu_token';
        case '406':
            return 'token 验证出错（406 / 10006），token 已过期，重新抓一次';
        case '500':
            return '签名密钥失效（500 小湖忙晕了），龙湖改版了，需重新提取 sign 密钥';
        case '801810':
        case '801811':
        case '801812':
            return '风控拦截，去 App 里手动签一次并拖一次滑块，之后会自动签';
        case '8040012':
        case '8040016':
            return '缺人机验证凭证（文案写着网络故障，其实是风控），去 App 里手动签一次并拖滑块';
        case '909001':
            return '需要图形验证（发短信场景），本脚本不涉及';
        case 'NETERR':
            return '网络异常，稍后重试即可';
        default:
            return (msg || '未知错误') + (code && String(code) !== 'undefined' ? '（code=' + code + '）' : '');
    }
}

function maskToken(t) {
    const s = String(t || '');
    if (s.length <= 10) return s ? s.slice(0, 2) + '****' : '(空)';
    return s.slice(0, 6) + '****' + s.slice(-4);
}

/** 推送前兜底：11 位手机号打码 */
function scrubPhones(s) {
    return String(s).replace(/(^|[^\d])(1[3-9]\d)\d{4}(\d{4})(?!\d)/g, '$1$2****$3');
}

function accountLabel(r) {
    const parts = [];
    if (r.nick) parts.push(r.nick);
    if (r.name && parts.indexOf(r.name) < 0) parts.push(r.name);
    if (!parts.length) parts.push(maskToken(r.token));
    return parts.join(' ');
}

// ============================================================================
// 九、参数解析
// ============================================================================

/**
 * 解析 longhu_token：多行，每行 备注#token / 备注#token#机型 / token
 */
function parseAccounts() {
    const raw = String(process.env[ENV_TOKEN] || '').trim();
    const out = [];
    if (!raw) return out;
    for (const ln of raw.split(/[\n\r]+/)) {
        const s = ln.trim();
        if (!s || s.charAt(0) === '#') continue;
        for (const seg of s.split(/\|\|/)) {
            const item = seg.trim();
            if (!item) continue;
            const parts = item.split('#').map((x) => x.trim());
            let profile = '';
            if (parts.length > 1 && DX_PROFILE_KEYS.indexOf(parts[parts.length - 1].toLowerCase()) >= 0) {
                profile = parts.pop().toLowerCase();
            }
            let name = '';
            let token = '';
            if (parts.length >= 2) {
                name = parts[0];
                token = parts[1];
            } else {
                token = parts[0] || '';
            }
            if (!token) continue;
            out.push({ name: name || '', token: token, profile: profile });
        }
    }
    return out;
}

/** longhu_dx：按行对齐，或写 备注#指纹 */
function parseDxEnv() {
    const raw = String(process.env[ENV_DX] || '').trim();
    const map = { byName: {}, byIndex: [] };
    if (!raw) return map;
    for (const ln of raw.split(/[\n\r]+/)) {
        const s = ln.trim();
        if (!s || s.charAt(0) === '#') continue;
        const i = s.indexOf('#');
        if (i > 0) map.byName[s.slice(0, i).trim()] = s.slice(i + 1).trim();
        else map.byIndex.push(s);
    }
    return map;
}

// ============================================================================
// 十、设备指纹
// ============================================================================

let DX_PROFILE_KEYS = ['pixel7'];

function loadDxModule() {
    return require(resolveFile('longhu_dxrisk.js'));
}

try {
    const m = loadDxModule();
    DX_PROFILE_KEYS = m.PROFILE_KEYS || DX_PROFILE_KEYS;
} catch (e) {
    if (DEBUG) console.log('      > longhu_dxrisk.js 未加载：' + e.message);
}

/**
 * 取该账号的设备指纹，优先级：环境变量 > 本地缓存 > 现场签发
 * @returns {Promise<object>} { dx, src, msg, fresh }
 */
async function resolveDx(acc, label, dxEnv, dxCache, fresh) {
    if (dxEnv.byName[label]) return { dx: dxEnv.byName[label], src: '环境变量（备注）' };
    if (dxEnv.byIndex[acc._index]) return { dx: dxEnv.byIndex[acc._index], src: '环境变量（按行）' };

    const key = label || maskToken(acc.token);
    const cached = dxCache[key];
    if (cached && cached.dx && !fresh) return { dx: cached.dx, src: '本地缓存 ' + (cached.at || '?') };

    const profile = acc.profile || String(process.env[ENV_DX_PROFILE] || '').trim().toLowerCase() || 'pixel7';
    let mod;
    try {
        mod = loadDxModule();
    } catch (e) {
        return { dx: '', src: '不可用', msg: '找不到 longhu_dxrisk.js（要和主脚本放同一目录）' };
    }
    const r = await mod.issueDxToken({ salt: acc.token, profile: profile });
    if (!r.ok) return { dx: '', src: '签发失败', msg: r.msg || '未知' };

    dxCache[key] = { dx: r.token, profile: r.profile, at: new Date().toISOString().slice(0, 10) };
    return { dx: r.token, src: '现场签发 ' + r.profile, fresh: true };
}

// ============================================================================
// 十一、单账号流程
// ============================================================================

function appMode() {
    const m = String(process.env[ENV_APP] || 'auto').trim().toLowerCase();
    return ['auto', 'manual', 'off'].indexOf(m) >= 0 ? m : 'auto';
}

function statusIcon(s) {
    if (s === 'ok') return '✅';
    if (s === 'already') return '💤';
    if (s === 'risk') return '🛡️';
    if (s === 'dead') return '🔑';
    if (s === 'todo') return '📌';
    if (s === 'skipped') return '⏭';
    return '❌';
}

async function runAccount(acc, i, total, ctx) {
    const label = acc.name || maskToken(acc.token);
    console.log('');
    console.log('  [' + i + '/' + total + '] ' + label + '   token=' + maskToken(acc.token));

    const res = {
        name: acc.name,
        nick: '',
        token: acc.token,
        status: 'fail',
        msg: '',
        refreshed: false,
        expireDays: null,
        growth: null,
        level: '',
        lz: null,
        mini: null,
        app: null,
        dx: '',
        refreshMsg: '',
    };

    // ---- 1. 续期（把有效期滚动重置为 30 天） ----
    const rf = await refreshToken(acc);
    if (rf.ok) {
        res.refreshed = true;
        res.expireDays = THIRTY_DAYS;
        if (rf.changed) {
            console.log('   🔄 续期成功（token 有更新，已换成新值继续跑）');
            console.log('      ⚠️  token 变了，请把 longhu_token 里这一行更新为 ' + rf.token);
            acc.token = rf.token;
            res.token = rf.token;
            res.tokenChanged = true;
        } else {
            console.log('   🔄 续期成功，有效期重置为 ' + THIRTY_DAYS + ' 天（token 未变）');
        }
    } else {
        res.refreshMsg = explain(rf.code, rf.msg);
        console.log('   ⚠️  续期失败：' + res.refreshMsg);
    }

    // ---- 2. 设备指纹 ----
    const dxRes = await resolveDx(acc, label, ctx.dxEnv, ctx.dxCache, ctx.dxFresh);
    res.dx = dxRes.dx;
    if (dxRes.dx) {
        if (dxRes.fresh) ctx.dxDirty = true;
        console.log('   🧩 设备指纹 ' + maskToken(dxRes.dx) + '   来源 ' + dxRes.src);
    } else {
        console.log('   ⚠️  设备指纹缺失：' + (dxRes.msg || '未知原因') + '（签到很可能被风控）');
    }

    // ---- 3. 用户信息（顺便验证 token 是否还活着） ----
    const info = await userInfo(acc);
    if (!info.ok) {
        res.status = 'dead';
        res.msg = explain(info.code, info.msg);
        console.log('   ❌ token 不可用：' + res.msg);
        return res;
    }
    res.nick = info.nick === '珑珠用户' ? '' : info.nick;
    res.growth = info.growth;
    res.level = info.level;
    if (info.phone) res.name = info.phone;
    console.log(
        '   👤 ' + (res.nick || '珑珠用户') + '  ' + (info.phone || '') +
        '   成长值 ' + info.growth + (info.level ? '   等级 ' + info.level : '')
    );

    const bal = await lzBalance(acc);
    if (bal) {
        res.lz = bal.balance;
        console.log('   💰 珑珠 ' + bal.balance + (bal.expiring > 0 ? '（' + bal.expiring + ' 近期过期）' : ''));
    }

    // ---- 4. 小程序入口签到 ----
    const mini = await checkin(acc, res.dx, ACT_MINI, '');
    res.mini = mini;
    res.status = mini.status === 'dead' ? 'dead' : mini.status;
    res.msg = mini.msg;
    console.log('   ' + statusIcon(mini.status) + ' 小程序入口：' + mini.msg);

    // ---- 5. APP 入口签到 ----
    if (ctx.appMode === 'off') {
        res.app = { status: 'skipped', msg: 'APP 入口已关闭（longhu_app=off）' };
        console.log('   ⏭  APP 入口：已关闭');
    } else if (ctx.appMode === 'manual') {
        const st = await signState(acc, res.dx, ACT_APP);
        if (st.state === true) {
            res.app = { status: 'already', msg: 'APP 入口今日已签到' };
            console.log('   💤 APP 入口：今日已签到（manual 模式）');
        } else if (st.state === false) {
            res.app = { status: 'todo', msg: 'APP 入口未签到，需在 App 内手动点一下' };
            console.log('   📌 APP 入口：未签到（manual 模式，需手动）');
        } else {
            res.app = { status: 'todo', msg: 'APP 入口状态未知，需在 App 内确认' };
            console.log('   📌 APP 入口：状态查不到（manual 模式）');
        }
    } else if (!res.dx) {
        res.app = { status: 'todo', msg: 'APP 入口缺设备指纹，已跳过' };
        console.log('   ⏭  APP 入口：缺指纹，跳过');
    } else {
        const app = await checkin(acc, res.dx, ACT_APP, 'APP ');
        res.app = app;
        console.log('   ' + statusIcon(app.status) + ' APP 入口：' + app.msg);
        if (app.status === 'dead' && res.status !== 'dead') res.status = 'dead';
    }

    // 主入口失败但 APP 入口成功时，整体按成功算（成长值确实到账了）
    if (res.status !== 'ok' && res.status !== 'already' && res.app && res.app.status === 'ok') {
        res.status = 'ok';
        res.msg = res.app.msg;
    }

    return res;
}

// ============================================================================
// 十二、推送
// ============================================================================

function detectPushChannels() {
    const e = process.env;
    const found = [];
    if (e.QYWX_AM) found.push('企业微信应用');
    if (e.QYWX_KEY || e.QYWX_BOT_KEY) found.push('企业微信机器人');
    if (e.PUSH_PLUS_TOKEN) found.push('PushPlus');
    if (e.BARK || e.BARK_PUSH) found.push('Bark');
    if (e.SCKEY || e.SERVERCHAN_SENDKEY) found.push('Server酱');
    if (e.DD_BOT_TOKEN) found.push('钉钉机器人');
    if (e.TG_BOT_TOKEN && e.TG_CHAT_ID) found.push('Telegram');
    return found;
}

// ---- 推送排版用的小件（跟联通脚本保持同一套观感）----

const NUM_CIRCLE = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
const PUSH_BADGE = { ok: '✅', already: '💤', risk: '🛡', dead: '🔑', fail: '❌', skipped: '⏭' };
const ENTRY_BADGE = { ok: '✅', already: '💤', risk: '🛡', dead: '🔑', fail: '❌', skipped: '⏭', unknown: '·' };

/** 一行最多这么宽（半角计），超过手机（企业微信/微信）就会自己乱折，所以要主动折 */
const PUSH_W = 42;
/** 汇总那行用更窄的宽度，保证断在语义边界上 */
const PUSH_W_SUM = 40;

const pad2 = (n) => String(n).length < 2 ? '0' + n : String(n);
const stampOf = (d) => pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());

/** 按显示宽度截断（中文算 2），尾部加省略号 */
function ellip(s, width) {
    const t = String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim();
    if (strWidth(t) <= width) return t;
    let out = '';
    let w = 0;
    for (const ch of t) {
        const cw = strWidth(ch);
        if (w + cw > width - 2) break;
        out += ch;
        w += cw;
    }
    return out.replace(/[\s·,，、:：+\-]+$/, '') + '…';
}

/**
 * 按段折行：段与段之间用 " · " 连，一行放不下就在段的边界断，续行缩进。
 * 只按段断，不切字，所以绝不会把「成长值10」劈成两半。
 */
function wrapSegs(segs, width, indent) {
    const pad = new Array((indent || 0) + 1).join(' ');
    const limit = (width || PUSH_W) - (indent || 0); // 缩进占的宽度要算进去
    const list = segs.filter((x) => x);
    const out = [];
    let cur = '';
    for (const seg of list) {
        const join = cur ? ' · ' + seg : seg;
        if (cur && strWidth(cur + join) > limit) {
            out.push(cur);
            cur = seg;
        } else {
            cur += join;
        }
    }
    if (cur) out.push(cur);
    if (!out.length) return [];
    // 续行缩进
    return out.map((ln, i) => (i === 0 ? pad : pad) + ln);
}

/** 账号级状态词（手机上一眼能读懂的那种） */
function statusWord(r) {
    if (r.status === 'ok') return '签到成功';
    if (r.status === 'already') return '今日已签';
    if (r.status === 'risk') return '被风控';
    if (r.status === 'dead') return '登录失效';
    return '执行异常';
}

/** 单入口的短标记：小程序+5 / APP✓ / 小程序💤 / APP🛡 */
function entryBit(name, entry) {
    if (!entry) return '';
    if (entry.status === 'ok') {
        const gain = Number(entry.reward || 0) > 0 ? '+' + entry.reward : '';
        return name + gain + (gain ? '' : '✓');
    }
    return name + (ENTRY_BADGE[entry.status] || ENTRY_BADGE.unknown);
}

/** 失败原因压成一句短的（详细建议交给「要处理的」区块） */
function shortReason(r) {
    if (r.status === 'dead') return 'token 过期，需重新取';
    if (r.status === 'risk') return '被风控（缺人机验证）';
    const t = String(r.msg || '未知原因').replace(/^[^：:]*[：:]/, '');
    const cut = t.split(/[，,。；;]/)[0];
    return ellip(cut || t, 22);
}

/** 本次实际跑到的入口数（一个号两个入口，这是龙湖的特点） */
function entryStats(results) {
    let done = 0;
    let total = 0;
    for (const r of results) {
        for (const e of [r.mini, r.app]) {
            if (!e || e.status === 'skipped') continue;
            total += 1;
            if (e.status === 'ok' || e.status === 'already') done += 1;
        }
    }
    return { done: done, total: total };
}

/** 一个账号的一行摘要（紧凑版用） */
function accountBits(r) {
    const bits = [];
    const mini = entryBit('小程序', r.mini);
    const app = entryBit('APP', r.app);
    if (mini) bits.push(mini);
    if (app) bits.push(app);
    if (r.status === 'ok' || r.status === 'already') {
        if (r.growth !== null && r.growth !== undefined) bits.push('成长值' + r.growth);
        if (r.level) bits.push(r.level);
        if (r.lz !== null && r.lz !== undefined && Number(r.lz) > 0) bits.push('珑珠' + r.lz);
        if (r.refreshed) bits.push('🔄' + (r.expireDays || 30) + '天');
        else if (r.refreshMsg) bits.push('⚠️续期失败');
    } else {
        bits.push(shortReason(r));
    }
    return bits.join(' · ');
}

function countBy(results) {
    const c = { ok: 0, already: 0, risk: 0, dead: 0, fail: 0 };
    for (const r of results) if (c[r.status] !== undefined) c[r.status] += 1;
    return c;
}

function pushTotals(results) {
    let grow = 0;
    let tasks = 0;
    let lz = 0;
    for (const r of results) {
        if (r.mini) grow += Number(r.mini.reward || 0);
        if (r.app) grow += Number(r.app.reward || 0);
        if (r.status === 'ok') tasks += 1;
        if (r.lz !== null && r.lz !== undefined) lz += Number(r.lz) || 0;
    }
    return { grow: grow, tasks: tasks, lz: lz };
}

/** 需要人处理时的建议：一行一个动作，手机上不折行 */
function actionLines(results) {
    const out = [];
    const add = (icon, who, hint) => {
        const one = '   ' + icon + ' ' + who + ' → ' + hint;
        if (strWidth(one) <= PUSH_W) {
            out.push(one);
        } else {
            out.push('   ' + icon + ' ' + who);
            out.push('      → ' + hint);
        }
    };
    for (const r of results) {
        const who = r.name || maskToken(r.token);
        if (r.status === 'dead') add('🔑', who, '重取 token（exe）');
        else if (r.status === 'risk' || (r.mini && r.mini.status === 'risk') || (r.app && r.app.status === 'risk'))
            add('🛡', who, 'App 手动签 + 拖滑块');
        else if (r.status === 'fail') add('❌', who, ellip(r.msg || '未知原因', 20));
    }
    return out;
}

// ---- 紧凑版（默认）：一条消息看完今天的结果 ----

function buildPushTextSimple(results, meta) {
    meta = meta || {};
    const c = countBy(results);
    const t = pushTotals(results);
    const es = entryStats(results);
    const normal = c.ok + c.already;

    const L = [];
    L.push('🏬 龙湖天街签到 · ' + stampOf(new Date()));

    // 汇总：本次收益 / 入口 / 正常数 / 耗时（太长就折成两排）
    const sumSegs = [];
    if (t.grow > 0) sumSegs.push('本次 +' + t.grow + ' 成长值');
    if (es.total) sumSegs.push('入口 ' + es.done + '/' + es.total);
    sumSegs.push('正常 ' + normal + '/' + results.length);
    if (t.lz > 0) sumSegs.push('珑珠 ' + t.lz);
    if (meta.secs) sumSegs.push('耗时 ' + Math.round(meta.secs) + 's');
    wrapSegs(sumSegs, PUSH_W_SUM, 3).forEach((ln, i) => {
        L.push(i === 0 ? '🎁 ' + ln.trim() : ln.trim().length ? '   ' + ln.trim() : '');
    });

    // 每个号两排：第一排「谁 + 什么状态」，第二排「两个入口 + 资产 + 续期」
    if (results.length) {
        L.push('');
        results.forEach((r, i) => {
            const num = NUM_CIRCLE[i] || i + 1 + '.';
            const who = r.name || maskToken(r.token);
            L.push(num + ' ' + who + ' ' + statusWord(r) + ' ' + (PUSH_BADGE[r.status] || ''));

            const segs = [];
            const entries = [];
            if (r.mini) entries.push(entryBit('小程序', r.mini));
            if (r.app) entries.push(entryBit('APP', r.app));
            if (entries.length) segs.push(entries.join(' '));

            if (r.status === 'ok' || r.status === 'already' || r.status === 'risk') {
                const asset = [];
                if (r.growth !== null && r.growth !== undefined) asset.push('成长值' + r.growth);
                if (r.level) asset.push(r.level);
                if (asset.length) segs.push(asset.join(' '));
                if (r.lz !== null && r.lz !== undefined && Number(r.lz) > 0) segs.push('珑珠' + r.lz);
                if (r.refreshed) segs.push('🔄' + (r.expireDays || 30) + '天');
                else if (r.refreshMsg) segs.push('⚠️续期失败');
            } else {
                segs.push(shortReason(r));
            }
            for (const ln of wrapSegs(segs, PUSH_W, 3)) L.push(ln);
        });
    }

    // 要处理的：放在状态数之前，让人先看到动作
    const acts = actionLines(results);
    if (acts.length) {
        L.push('');
        L.push('💡 要处理的：');
        for (const ln of acts) L.push(ln);
    }

    // 状态数固定压在最底下
    L.push('');
    const cntSegs = [
        '✅' + c.ok + ' 成功',
        '💤' + c.already + ' 已签',
        '🛡' + c.risk + ' 风控',
        '🔑' + c.dead + ' 失效',
        '❌' + c.fail + ' 异常',
    ];
    L.push(cntSegs.slice(0, 3).join(' · '));
    L.push(cntSegs.slice(3).join(' · '));
    return L.join('\n');
}

// ---- 明细版（longhu_push_style=full）：每号一段，排错用 ----

function buildPushTextFull(results, meta) {
    meta = meta || {};
    const c = countBy(results);
    const t = pushTotals(results);
    const normal = c.ok + c.already;
    const sep = '────────────────────';
    const d = new Date();

    const L = [];
    L.push('🏬 龙湖天街 · 每日签到 + token 续期');
    L.push(
        d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' +
        pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) +
        (meta.secs ? ' · 耗时 ' + Math.round(meta.secs) + 's' : '')
    );
    L.push(sep);

    results.forEach((r, i) => {
        const stat =
            r.status === 'ok' ? '签到成功' :
            r.status === 'already' ? '今日已签' :
            r.status === 'risk' ? '被风控' :
            r.status === 'dead' ? '登录失效' : '执行异常';
        L.push('【' + (i + 1) + '】' + (r.name || maskToken(r.token)) + '  ' + stat + '  ' + (PUSH_BADGE[r.status] || ''));

        const l1 = [];
        if (r.mini) l1.push(entryBit('小程序', r.mini));
        if (r.app) l1.push(entryBit('APP', r.app));
        if (l1.length) L.push('    入口 ' + l1.join(' · '));

        const l2 = [];
        if (r.growth !== null && r.growth !== undefined) l2.push('成长值 ' + r.growth);
        if (r.level) l2.push(r.level);
        if (r.lz !== null && r.lz !== undefined) l2.push('珑珠 ' + r.lz);
        if (r.refreshed) l2.push('续期 ' + (r.expireDays || 30) + ' 天');
        else if (r.refreshMsg) l2.push('续期失败：' + ellip(r.refreshMsg, 26));
        if (l2.length) L.push('    ' + l2.join(' · '));

        const l3 = [];
        if (r.dx) l3.push('指纹 ' + maskToken(r.dx));
        if (r.nick) l3.push('昵称 ' + r.nick);
        if (l3.length) L.push('    ' + l3.join(' · '));

        if (r.status !== 'ok' && r.status !== 'already' && r.msg) L.push('    原因：' + ellip(r.msg, 60));
        if (i < results.length - 1) L.push('');
    });

    L.push(sep);
    // 明细版也把「状态数」压到最底下，跟紧凑版保持一致
    const tail = [];
    const esFull = entryStats(results);
    if (t.grow > 0) tail.push('合计 +' + t.grow + ' 成长值');
    if (esFull.total) tail.push('入口 ' + esFull.done + '/' + esFull.total);
    if (t.lz > 0) tail.push('珑珠 ' + t.lz);
    tail.push('正常 ' + normal + '/' + results.length);
    wrapSegs(tail, PUSH_W, 0).forEach((ln) => L.push(ln.trim()));

    const acts = actionLines(results);
    if (acts.length) {
        L.push('');
        L.push('💡 要处理的：');
        for (const ln of acts) L.push(ln);
    }

    L.push('');
    const cntFull = [
        '✅' + c.ok + ' 成功',
        '💤' + c.already + ' 已签',
        '🛡' + c.risk + ' 风控',
        '🔑' + c.dead + ' 失效',
        '❌' + c.fail + ' 异常',
    ];
    L.push(cntFull.slice(0, 3).join(' · '));
    L.push(cntFull.slice(3).join(' · '));
    L.push('');
    L.push('— 由 longhu_signin.js 生成');
    return L.join('\n');
}

// ---- 主入口：按 longhu_push_style 选版式 ----

function buildPushText(results, meta) {
    const style = String(process.env[ENV_PUSH_STYLE] || 'simple').trim().toLowerCase();
    if (style === 'full' || style === 'verbose' || style === 'detail') return buildPushTextFull(results, meta);
    return buildPushTextSimple(results, meta);
}

/** 通知标题：一眼看到「几个号正常 / 拿了多少」 */
function buildPushTitle(results, meta) {
    meta = meta || {};
    const c = countBy(results);
    const t = pushTotals(results);
    const normal = c.ok + c.already;
    const style = String(process.env[ENV_PUSH_STYLE] || 'simple').trim().toLowerCase();
    const isFull = style === 'full' || style === 'verbose' || style === 'detail';

    const parts = [normal + '/' + results.length];
    if (t.grow > 0) parts.push('+' + t.grow + '成长值');
    else if (c.already === results.length) parts.push('今日已签');
    if (c.dead + c.fail > 0) parts.push(normal === 0 ? '❌需处理' : '⚠️');
    else if (c.risk > 0) parts.push('🛡风控');
    return '龙湖天街' + (isFull ? '签到 ' : ' ') + parts.join(' · ');
}

async function push(results, meta) {
    meta = meta || {};
    const mode = String(process.env[ENV_PUSH] === undefined ? 'on' : process.env[ENV_PUSH]).trim().toLowerCase();
    const title = buildPushTitle(results, meta);
    const text = scrubPhones(buildPushText(results, meta));

    if (mode === 'dry' || mode === 'print') {
        console.log('');
        console.log('📮 推送内容预览（dry，未发送）：');
        console.log('');
        console.log('【标题】' + scrubPhones(title));
        console.log('【正文】');
        console.log(text);
        console.log('');
        return;
    }
    if (!flag(ENV_PUSH, 'on') || !flag(ENV_TY_PUSH, 'on')) return;

    // 优先用青龙自带 sendNotify.js
    const notifyPath = resolveFile('sendNotify.js');
    if (fs.existsSync(notifyPath)) {
        try {
            const mod = require(notifyPath);
            const sendNotify = mod.sendNotify || mod.default || mod;
            if (typeof sendNotify === 'function') {
                await sendNotify(title, text);
                console.log('');
                console.log('📮 推送完成：sendNotify.js（' + notifyPath + '）');
                return;
            }
        } catch (e) {
            if (DEBUG) console.log('      > sendNotify.js 不可用：' + e.message);
        }
    }

    // 兜底：内置渠道
    const clip = (s, max) => {
        const m = max || 2000;
        if (Buffer.byteLength(s, 'utf8') <= m) return s;
        let out = '';
        for (const ch of s) {
            if (Buffer.byteLength(out + ch, 'utf8') > m - 20) break;
            out += ch;
        }
        return out + '\n…（内容过长已截断）';
    };
    const e = process.env;
    const done = [];
    const errors = [];

    if (e.QYWX_AM) {
        try {
            const seg = String(e.QYWX_AM).split(',');
            const corpId = seg[0];
            const secret = seg[1];
            const touser = seg[2] || '@all';
            const agentId = seg[3];
            const tk = JSON.parse(
                (await request({
                    url: 'https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=' + corpId + '&corpsecret=' + secret,
                })).text
            );
            if (!tk.access_token) throw new Error(tk.errmsg || '取 token 失败');
            const j = JSON.parse(
                (await request({
                    url: 'https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=' + tk.access_token,
                    data: { touser: touser, msgtype: 'text', agentid: agentId, text: { content: clip(text) } },
                })).text
            );
            if (j.errcode === 0) done.push('企业微信应用');
            else throw new Error(j.errmsg || '错误码 ' + j.errcode);
        } catch (err) {
            errors.push('企业微信应用 -> ' + err.message);
        }
    }

    if (e.QYWX_KEY || e.QYWX_BOT_KEY) {
        try {
            const key = e.QYWX_KEY || e.QYWX_BOT_KEY;
            const j = JSON.parse(
                (await request({
                    url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=' + key,
                    data: { msgtype: 'text', text: { content: clip(text) } },
                })).text
            );
            if (j.errcode === 0) done.push('企业微信机器人');
            else throw new Error(j.errmsg || '错误码 ' + j.errcode);
        } catch (err) {
            errors.push('企业微信机器人 -> ' + err.message);
        }
    }

    if (e.PUSH_PLUS_TOKEN) {
        try {
            const j = JSON.parse(
                (await request({
                    url: 'https://www.pushplus.plus/send',
                    data: { token: e.PUSH_PLUS_TOKEN, title: title, content: clip(text), template: 'txt' },
                })).text
            );
            if (j.code === 200) done.push('PushPlus');
            else throw new Error(j.msg || '错误码 ' + j.code);
        } catch (err) {
            errors.push('PushPlus -> ' + err.message);
        }
    }

    if (e.BARK || e.BARK_PUSH) {
        try {
            const bark = String(e.BARK || e.BARK_PUSH).replace(/\/+$/, '');
            const url =
                bark.indexOf('://') >= 0
                    ? bark + '/' + encodeURIComponent(title) + '/' + encodeURIComponent(clip(text, 400))
                    : bark;
            const j = JSON.parse((await request({ url: url })).text);
            if (j.code === 200) done.push('Bark');
            else throw new Error(j.message || '错误码 ' + j.code);
        } catch (err) {
            errors.push('Bark -> ' + err.message);
        }
    }

    if (e.SCKEY || e.SERVERCHAN_SENDKEY) {
        try {
            const key = e.SCKEY || e.SERVERCHAN_SENDKEY;
            const j = JSON.parse(
                (await request({
                    url: 'https://sctapi.ftqq.com/' + key + '.send',
                    data: { title: title, desp: clip(text) },
                })).text
            );
            if (j.code === 0) done.push('Server酱');
            else throw new Error(j.message || '错误码 ' + j.code);
        } catch (err) {
            errors.push('Server酱 -> ' + err.message);
        }
    }

    if (e.DD_BOT_TOKEN) {
        try {
            const url =
                String(e.DD_BOT_TOKEN).indexOf('http') === 0
                    ? e.DD_BOT_TOKEN
                    : 'https://oapi.dingtalk.com/robot/send?access_token=' + e.DD_BOT_TOKEN;
            const j = JSON.parse(
                (await request({ url: url, data: { msgtype: 'text', text: { content: clip(text) } } })).text
            );
            if (j.errcode === 0) done.push('钉钉机器人');
            else throw new Error(j.errmsg || '错误码 ' + j.errcode);
        } catch (err) {
            errors.push('钉钉机器人 -> ' + err.message);
        }
    }

    if (e.TG_BOT_TOKEN && e.TG_CHAT_ID) {
        try {
            const j = JSON.parse(
                (await request({
                    url: 'https://api.telegram.org/bot' + e.TG_BOT_TOKEN + '/sendMessage',
                    data: { chat_id: e.TG_CHAT_ID, text: clip(text), disable_web_page_preview: true },
                })).text
            );
            if (j.ok) done.push('Telegram');
            else throw new Error(j.description || '发送失败');
        } catch (err) {
            errors.push('Telegram -> ' + err.message);
        }
    }

    if (done.length) console.log('\n📮 推送完成：' + done.join('、'));
    if (errors.length) {
        console.log('');
        for (const x of errors) console.log('   ⚠️  ' + x);
    }
    if (!done.length && !errors.length) console.log('\n📮 未配置推送渠道，跳过');
}

// ============================================================================
// 十三、主流程
// ============================================================================

function printConfigGuide() {
    section('❌ 未配置账号');
    console.log('   青龙 → 环境变量 → 新建：');
    console.log('');
    console.log('     名称：' + ENV_TOKEN);
    console.log('     值  ：a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');
    console.log('');
    console.log('   多个账号换行写，可以带备注和机型：');
    console.log('');
    console.log('     主号#a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6#pixel7');
    console.log('     小号#b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6#xiaomi14');
    console.log('');
    console.log('   机型可选：' + DX_PROFILE_KEYS.join(' / '));
    console.log('');
    console.log('   这个 token 怎么拿：');
    console.log('     手机 App / 微信小程序进龙湖会员中心，抓一个发往');
    console.log('     gw2c-hw-open.longfor.com 的请求，取请求头里的');
    console.log('     X-LF-UserToken（或 lmToken / token），32 位十六进制。');
    console.log('');
    console.log('   抓到填一次就行，之后脚本每天自动续期 30 天，不用再抓。');
    console.log('');
}

async function main() {
    const t0 = Date.now();
    const accounts = parseAccounts();
    const dxEnv = parseDxEnv();
    const dxCache = loadDxCache();
    const dxFresh = flag(ENV_DX_FRESH, 'off');
    const mode = appMode();

    console.log('');
    console.log('  ' + line(54));
    console.log('    🏬 龙湖天街 · 每日签到 + token 续期   v1.0');
    console.log('  ' + line(54));

    if (!accounts.length) {
        printConfigGuide();
        return;
    }

    const delayCfg = String(process.env[ENV_DELAY] || '5-15');
    const dp = delayCfg.split('-').map(Number);
    const dMin = isFinite(dp[0]) ? dp[0] : 5;
    const dMax = isFinite(dp[1]) ? dp[1] : dMin + 10;

    const channels = detectPushChannels();
    const dxEnvCount = Object.keys(dxEnv.byName).length + dxEnv.byIndex.length;

    console.log('');
    console.log('   📋 账号 ' + accounts.length + ' 个 · 间隔 ' + dMin + '-' + dMax + ' 秒');
    console.log('   📮 推送 ' + (channels.length ? channels.join('、') : '未配置（静默）'));
    console.log(
        '   🧩 指纹 ' + (dxEnvCount ? '环境变量优先' : '自动签发（缓存 ' + Object.keys(dxCache).length + ' 份）') +
        (dxFresh ? ' · 强制重签' : '')
    );
    console.log('   📱 APP 入口 ' + mode);
    console.log('   📝 推送版式 ' + String(process.env[ENV_PUSH_STYLE] || 'simple') + (String(process.env[ENV_PUSH_STYLE] || '').toLowerCase() === 'full' ? '（明细）' : '（紧凑）'));

    accounts.forEach((a, i) => {
        a._index = i;
    });

    const ctx = { dxEnv: dxEnv, dxCache: dxCache, dxFresh: dxFresh, appMode: mode, dxDirty: false };
    const results = [];
    for (let i = 0; i < accounts.length; i++) {
        try {
            results.push(await runAccount(accounts[i], i + 1, accounts.length, ctx));
        } catch (e) {
            const acc = accounts[i];
            console.log('   ❌ 异常：' + (e && e.message ? e.message : e));
            results.push({
                name: acc.name,
                nick: '',
                token: acc.token,
                status: 'fail',
                msg: '异常：' + (e && e.message ? e.message : e),
                growth: null,
                level: '',
                lz: null,
                mini: null,
                app: null,
            });
        }
        if (i < accounts.length - 1) await sleep(rand(dMin * 1000, dMax * 1000));
    }

    if (ctx.dxDirty) saveDxCache(dxCache);

    const ok = results.filter((r) => r.status === 'ok').length;
    const already = results.filter((r) => r.status === 'already').length;
    const dead = results.filter((r) => r.status === 'dead').length;
    const risk = results.filter((r) => r.status === 'risk').length;
    const fail = results.filter((r) => r.status === 'fail').length;

    console.log('');
    console.log('  ' + line(54));
    console.log('    📊 ✅ ' + ok + ' 成功 · 💤 ' + already + ' 已签 · 🛡️ ' + risk + ' 风控 · 🔑 ' + dead + ' 失效 · ❌ ' + fail + ' 失败');
    console.log('  ' + line(54));

    if (dead) {
        console.log('');
        console.log('   🔑 有账号 token 失效，处理办法：');
        console.log('      1. 手机 App / 小程序重新进一次会员中心，抓 X-LF-UserToken；');
        console.log('      2. 更新青龙变量 ' + ENV_TOKEN + ' 里对应的那一行；');
        console.log('      3. token 有效期 30 天且滑动续期，连续停机超 30 天才会过期。');
    }
    if (risk) {
        console.log('');
        console.log('   🛡️ 有账号被风控（801810 / 8040012 这类文案会骗成「网络故障」）：');
        console.log('      去 App 里手动签一次并把滑块拖到底，只拖一次；');
        console.log('      之后本脚本用同一份指纹就能自动签了。');
        console.log('      千万别反复换指纹试探 —— 那会把信任分越打越低。');
    }

    const changed = results.filter((r) => r.tokenChanged);
    if (changed.length) {
        console.log('');
        console.log('   🔄 以下账号续期后 token 变了，请更新 ' + ENV_TOKEN + '：');
        for (const r of changed) console.log('      ' + accountLabel(r) + ' -> ' + r.token);
    }

    await push(results, { startedAt: t0, secs: (Date.now() - t0) / 1000 });
    console.log('');
}

main().catch((e) => {
    console.log('脚本异常：' + (e && e.stack ? e.stack : e));
    process.exit(1);
});
