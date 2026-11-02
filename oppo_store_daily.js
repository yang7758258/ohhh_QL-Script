/* -------------------------------------------------------------------------
 *  项目名称：OPPO 商城（每日签到 + 日常任务 + 活动任务 + 抽奖）
 *  脚本文件：oppo_store_daily.js
 *  更新说明：
 *    2026-11-02  Mist  仓库整理：统一项目标识、清理隐私信息
 * -------------------------------------------------------------------------
 */
/**
 * ============================================================================
 *  OPPO 商城 · 每日签到 + 日常任务 + 活动任务 + 抽奖（青龙面板版 · 纯 HTTP 零依赖）
 * ============================================================================
 *
 *  作   者：Mist
 *  版   本：v1.1
 *  适配版本：OPPO 商城 iOS 5.3.0（s_version=500300），Android 同一套接口
 *  凭   证：TOKENSID（UC 二级令牌），抓包一次，有效期约 30 天
 *
 * ----------------------------------------------------------------------------
 *  【这条路是怎么走通的】
 * ----------------------------------------------------------------------------
 *  一、鉴权：营销接口不吃签名，只吃 TOKENSID
 *      商城 H5（hd.opposhop.cn）的 /api/cn/oapi/marketing/** 全部是明文 JSON，
 *      没有 constToken / timeStamp / sentry-trace 之类的前端签名校验。
 *      实测「Cookie 里只留一个 TOKENSID」就能把整套流程跑通 —— 也就是说，
 *      sa_distinct_id / app_param / biz_session_id / experiment_id 这些
 *      Cookie 全是埋点用的，抓包时看着吓人，脚本一个都不用带。
 *
 *      TOKENSID 本体是 TOKEN_<b64header>.<b64payload>.<b64sig>，
 *      header 写的是 alg=ECDSA，payload 里有 {exp, id, idc, tid}，
 *      exp 是毫秒时间戳 —— 所以脚本能自己算出还有几天过期，提前提醒你换。
 *      （exp 在 JWT 里是「毫秒」不是「秒」，直接 Date.now() 比，别除以 1000。）
 *
 *  二、签到：一次 GET 判状态，一次 POST 拿分
 *      GET  /marketing/cumulativeSignIn/getSignInDetail?activityId=2116078703745441792
 *           → data.todaySignIn   true = 今天签过了
 *           → data.signInDayNum  累计签到天数
 *           → data.baseAwards[]  这 7 天的档位，signTime 是日期
 *      POST /marketing/cumulativeSignIn/signIn
 *           {"activityId","creditsAddActionId","business":1}
 *           → data.awardType=1 就是积分，data.awardValue 是本次拿几分
 *      注意：这个签到活动的 activityId（2116078703745441792）和
 *      任务活动的 activityId 不是一个，别混用。
 *
 *  三、任务：一次上报就完成，不用真的去浏览
 *      GET /marketing/task/queryTaskList?activityId=xxx&source=c
 *           → data.taskDTOList[]，关键字段：
 *               taskId          任务 ID（后面上报和领奖都要）
 *               taskType        1 浏览页面 / 2 分享页面 / 4 预约商品 / 6 购买 /
 *                               13 添加导购 / 14 学生认证 / 16 填收货地址 /
 *                               17 首单付费 / 22 添加社群 / 30 邀请绑定 / 31 发布内容
 *               taskStatus      1 未完成 / 2 已完成待领取 / 3 已领取
 *               taskCycle       0 每日 / 1 单次 / 2 长期（做一次就没了）
 *               awardAttachConfig
 *                   .pointsNum   奖多少积分
 *                   .raffleId    奖的是「抽奖次数」时的抽奖活动 ID
 *                   .raffleNum   奖几次
 *               attachConfigOne.browseTime   要求浏览几秒（5 秒这种）
 *               attachConfigTwo.link         要求浏览的落地页
 *
 *      GET /marketing/task/checkCrowd?activityId=&taskId=
 *           → data.result  true = 你在目标人群里（不在就别浪费请求）
 *
 *      GET /marketing/taskReport/signInOrShareTask?taskId=&activityId=&taskType=
 *           → data=200 就是完成了。
 *           ★ 服务端**不校验**你是不是真的浏览了 5 秒、是不是真的分享了。
 *             所以 taskType 1 和 2 这两类可以直接上报，脚本默认还是会先去
 *             GET 一下落地页（oppo_browse=on），不想要就关掉。
 *
 *      GET /marketing/task/receiveAward?taskId=&activityId=&creditsAddActionId=&business=1
 *           → data.awardType / data.awardValue / data.receiveStatus
 *           awardType 1 = 积分，3 = 抽奖次数，2 = 优惠券，14 = 充电券 …
 *
 *      只有 taskType 1 / 2 是脚本能自动做的，其余都要真人操作，脚本会打印
 *      「[跳过] … 需手动」，别当成失败。
 *
 *  四、抽奖：任务发的次数，领完直接抽
 *      GET /marketing/raffle/queryRaffleCount?activityId=
 *           → data.count 剩几次
 *      GET /marketing/raffle/clickRaffle?activityId=&creditsAddActionId=
 *                                      &creditsDeductActionId=&business=1
 *           → data.raffleWinnerVO  中了什么（exhibitAwardName 是展示名）
 *           → data.inspectionQualification.code
 *                 204 = 没次数了（这是「正常结束」，不是错误）
 *                 201 = 中奖了，msg 里写去哪看奖品
 *                                             500 = 活动火爆，退避重试
 *
 *      ⚠️ clickRaffle 还接受 jimuId / jimuName 两个参数（活动页内部 ID），
 *         实测**不传也能抽**；但传了错的会直接 500「活动火爆」。
 *         所以脚本一律不传 —— 宁可少两个参数，也别踩这个坑。
 *
 *  五、积分 actionId 是什么、为什么要它
 *      receiveAward / signIn / clickRaffle 都要带 creditsAddActionId
 *      （抽奖还要 creditsDeductActionId）。它不是每次变化的一次性 token，
 *      是商城「积分乐园会场」页面配置里的固定值，写在 window.__APP__.scoreId 里：
 *          "scoreId": {"creditsDeductActionId":"d5e44c…","creditsAddActionId":"178891…"}
 *      脚本启动时会去 hd.opposhop.cn/bp/b371ce270f7509f0 这页把它抓下来，
 *      抓不到才用内置默认值，所以将来换了也不用改代码。
 *
 *  六、账号密码登录：走不通，别浪费时间
 *      App 里「账号密码登录」走的不是商城接口，是 UC 账号中心：
 *          POST uc-client-cn.heytapmobi.com/identity/v1/authn/{check,validate,login}
 *      这三个接口的请求体和响应体都是加密的（application/encrypted-json）——
 *      抓包里看到的是 base64，解开是定长二进制，不是明文 JSON：
 *          请求头 128 字节固定（前缀 54926376a0286ed5… 每次一样，是密钥封装块）
 *          请求体 1692~2785 字节，前缀 6cca017f56c8d346… 也固定
 *      对应的验签头是 X-Sign / X-Sign-Key / X-RequestTime / X-Envelope-Version，
 *      在 APK 的 classes2.dex 里；会话密钥在 SDK 初始化时协商，用完即弃。
 *      更关键的是：就算把加密啃下来，密码登录成功后还要做
 *      /identity/v1/authn/validate 的二次校验（要短信或一键登录），
 *      最后拿 secondaryTokenMap["com.oppo.store"] 换 TOKENSID。
 *      纯 HTTP 复刻这一整条链的收益极低，而 TOKENSID 一次能用一个月。
 *      → 所以脚本用 TOKENSID（CK），30 天换一次，换的时候 30 秒的事。
 *
 * ----------------------------------------------------------------------------
 *  【TOKENSID 怎么抓】（iPhone / Android 都行）
 * ----------------------------------------------------------------------------
 *  1. 打开 OPPO 商城 App，确认已登录（我的 → 能看到积分）
 *  2. 抓包（Stream / Reqable / Charles），过滤 hd.opposhop.cn
 *  3. 随便点进「积分商城」或任一活动页，让它发一个 /api/cn/oapi/... 请求
 *  4. 复制请求头 Cookie 里 TOKENSID= 后面那一整串
 *          TOKEN_xxxxxxxx…（真实 token 省略）
 *      （ENCODE_TOKENSID 是同一个值的 URL 编码版，不用管）
 *  5. 粘进青龙环境变量 oppo_ck
 *
 *  注意：只抓 TOKENSID 就够，不用整条 Cookie。整条粘也行（脚本会自己抠）。
 *
 * ----------------------------------------------------------------------------
 *  【青龙配置】
 * ----------------------------------------------------------------------------
 *  环境变量（必需）：
 *    oppo_ck        TOKENSID 的值 / 整条 Cookie；多个账号换行分隔
 *
 *  环境变量（可选）：
 *    oppo_push      on/off/dry   推送开关，默认 on；dry 只打印不发送
 *    TYpush         on/off       推送总开关（其他脚本共用）
 *    oppo_delay     3-8          多账号之间的随机间隔（秒）
 *    oppo_browse    on/off       任务前是否真去 GET 一次落地页，默认 on
 *    oppo_raffle_max 20          单个抽奖活动最多抽几次，默认 20
 *    oppo_activities             追加任务活动 ID，逗号分隔
 *    oppo_raffles                追加抽奖活动 ID，逗号分隔
 *    oppo_sign_activity          覆盖签到活动 ID（活动换了才要改）
 *    oppo_credits_add            覆盖 creditsAddActionId（一般不用填）
 *    oppo_credits_deduct         覆盖 creditsDeductActionId（一般不用填）
 *    oppo_debug     on/off       打印每个请求的原始响应
 *
 *  定时规则：10 9 * * *     （每天 9:10，避开整点）
 *  任务名称：OPPO商城签到
 *  命令    ：task oppo_store_daily.js
 *
 * ----------------------------------------------------------------------------
 *  【已知活动 ID（2026-11-01 抓包实测）】
 * ----------------------------------------------------------------------------
 *  签到        2116078703745441792   累计签到（7 天一轮，每天 2 分）
 *  任务        1919591795180969984   【积分商城】任务（每日 10+ 个浏览任务）
 *  任务        2109541068549922816   11.11 省心焕新季-福利会场抽奖任务
 *  任务        2115337871702630400   自在出发 尽兴开拍 抽奖任务
 *  任务        2114637499455512576   双11宠粉头条·1积分抽奖
 *  任务        2102679739289575424   秋日限定学生组队·奖励任务
 *  抽奖        2109483209141129216   11.11 省心焕新季-福利会场抽奖
 *  抽奖        2115336828990132224   自在出发 尽兴开拍 抽奖
 *  抽奖        2114563279899725824   双11宠粉头条·1积分抽奖
 *  抽奖        2102655036441104384   秋日限定学生组队抽奖
 *
 *  这些是「当前在跑的活动」。活动一换 ID 就变，脚本的行为是：
 *    ① 写死的任务活动照跑（活动下线了 queryTaskList 返回空，自动跳过）
 *    ② 任务奖励里带 raffleId 的抽奖活动自动发现，不用手工加
 *    ③ 既没写死又没被发现的，用 oppo_activities / oppo_raffles 补
 *
 * ----------------------------------------------------------------------------
 *  【免责声明】
 * ----------------------------------------------------------------------------
 *  1. 本脚本仅供个人学习与技术研究，仅用于自己有权操作的账号。
 *  2. 使用本脚本可能违反平台《用户协议》，由此产生的账号受限、积分清零等
 *     后果，由使用者自行承担。
 *  3. 请勿用于批量注册、代签到、售卖等商业用途；请勿高频调用。
 *  4. 脚本不收集、不上传任何账号信息，所有凭据只在你自己的青龙里。
 * ============================================================================
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const crypto = require('crypto');
const { URL } = require('url');

// 账号密码登录模块（浏览器驱动，同目录）
let loginModule = null;
try {
    loginModule = require(path.join(__dirname, 'oppo_login.js'));
} catch (e) {
    loginModule = null;
}

// ============================================================================
// 一、配置
// ============================================================================

const ENV_CK = 'oppo_ck';
const ENV_CK_ALT = 'OPPO_CK';
const ENV_PUSH = 'oppo_push';
const ENV_TY_PUSH = 'TYpush';
const ENV_DELAY = 'oppo_delay';
const ENV_BROWSE = 'oppo_browse';
const ENV_RAFFLE_MAX = 'oppo_raffle_max';
const ENV_ACTIVITIES = 'oppo_activities';
const ENV_RAFFLES = 'oppo_raffles';
const ENV_SIGN_ACT = 'oppo_sign_activity';
const ENV_CREDITS_ADD = 'oppo_credits_add';
const ENV_CREDITS_DEDUCT = 'oppo_credits_deduct';
const ENV_DEBUG = 'oppo_debug';
const ENV_ACCOUNT = 'oppo_account';
const ENV_LOGIN_OFF = 'oppo_login_off';

const HOST = 'https://hd.opposhop.cn';
const API = '/api/cn/oapi/marketing';

/** 签到活动（累计签到，7 天一轮） */
const SIGN_ACTIVITY = String(process.env[ENV_SIGN_ACT] || '2116078703745441792').trim();

/** 积分增减 actionId：商城「积分乐园会场」页面 window.__APP__.scoreId 里的固定值 */
let CREDITS_ADD = String(process.env[ENV_CREDITS_ADD] || '1788913e6d9e4683b8b9ab0088733560').trim();
let CREDITS_DEDUCT = String(process.env[ENV_CREDITS_DEDUCT] || 'd5e44c73030a4b1287bff7bfa3df0320').trim();

/** 任务活动：[活动 ID, 显示名] */
const TASK_ACTIVITIES = [
    ['1919591795180969984', '【积分商城】任务'],
    ['2109541068549922816', '11.11 省心焕新季-福利会场'],
    ['2115337871702630400', '自在出发 尽兴开拍'],
    ['2114637499455512576', '双11宠粉头条'],
    ['2102679739289575424', '秋日限定学生组队'],
];

/** 抽奖活动兜底清单（任务奖励里带 raffleId 的会自动发现，这里只补漏） */
const KNOWN_RAFFLES = [
    ['2109483209141129216', '11.11 省心焕新季-福利会场抽奖'],
    ['2115336828990132224', '自在出发 尽兴开拍抽奖'],
    ['2114563279899725824', '双11宠粉头条·1积分抽奖'],
    ['2102655036441104384', '秋日限定学生组队抽奖'],
];

const UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko)  oppostore/500300 IOS/27.2 brand/iPhone model/iPhone17,1';

/** Web 端 UA（密码登录拿到的 NEWOPPOSID 走这套） */
const UA_WEB =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const randHex = (n) => crypto.randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n);

const DEBUG = /^(1|on|true|yes|y)$/i.test(String(process.env[ENV_DEBUG] || '').trim());
const flag = (name, dft = 'on') =>
    !/^(0|off|false|no|n)$/i.test(String(process.env[name] === undefined ? dft : process.env[name]).trim());

const BROWSE = flag(ENV_BROWSE, 'on');
const RAFFLE_MAX = Math.max(1, parseInt(process.env[ENV_RAFFLE_MAX] || '20', 10) || 20);

// 追加活动
for (const id of String(process.env[ENV_ACTIVITIES] || '').split(/[,\s]+/).filter(Boolean)) {
    if (!TASK_ACTIVITIES.some((x) => x[0] === id)) TASK_ACTIVITIES.push([id, '自定义活动 ' + id]);
}
const EXTRA_RAFFLES = String(process.env[ENV_RAFFLES] || '').split(/[,\s]+/).filter(Boolean);

// ============================================================================
// 二、终端排版
// ============================================================================

function strWidth(s) {
    let w = 0;
    for (const ch of String(s)) {
        const c = ch.codePointAt(0);
        if (
            (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0x303e) ||
            (c >= 0x3041 && c <= 0x33ff) || (c >= 0x3400 && c <= 0x4dbf) ||
            (c >= 0x4e00 && c <= 0x9fff) || (c >= 0xa000 && c <= 0xa4cf) ||
            (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) ||
            (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) ||
            (c >= 0xffe0 && c <= 0xffe6) || (c >= 0x1f300 && c <= 0x1f9ff) ||
            (c >= 0x2600 && c <= 0x27bf)
        ) {
            w += 2;
        } else {
            w += 1;
        }
    }
    return w;
}

const padR = (s, n) => {
    s = String(s);
    const d = n - strWidth(s);
    return s + ' '.repeat(d > 0 ? d : 0);
};

const line = (w = 58) => '─'.repeat(w);

function section(t, w = 58) {
    console.log('');
    console.log('  ' + t);
    console.log('  ' + line(w));
}

/** 推送前兜底：把文本里任何 11 位中国大陆手机号打码 */
function scrubPhones(s) {
    return String(s).replace(/(^|[^\d])(1[3-9]\d)\d{4}(\d{4})(?!\d)/g, '$1$2****$3');
}

// ============================================================================
// 三、HTTP
// ============================================================================

function request(opts) {
    return new Promise((resolve, reject) => {
        let u;
        try {
            u = new URL(opts.url);
        } catch (e) {
            return reject(new Error('URL 非法：' + opts.url));
        }
        const lib = u.protocol === 'https:' ? https : http;
        const headers = { ...(opts.headers || {}) };
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
                method: opts.method || 'GET',
                headers,
                timeout: opts.timeout || 20000,
            },
            (res) => {
                const cs = [];
                res.on('data', (c) => cs.push(c));
                res.on('end', () => {
                    let buf = Buffer.concat(cs);
                    const enc = String(res.headers['content-encoding'] || '').toLowerCase();
                    try {
                        if (enc.includes('gzip')) buf = zlib.gunzipSync(buf);
                        else if (enc.includes('br')) buf = zlib.brotliDecompressSync(buf);
                        else if (enc.includes('deflate')) buf = zlib.inflateSync(buf);
                    } catch (e) {
                        /* 解不开就用原文 */
                    }
                    const text = buf.toString('utf8');
                    let json = null;
                    try {
                        json = JSON.parse(text);
                    } catch (e) {
                        json = null;
                    }
                    resolve({ status: res.statusCode, headers: res.headers, text, json });
                });
            }
        );
        req.on('timeout', () => req.destroy(new Error('请求超时')));
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

// ============================================================================
// 四、账号解析
// ============================================================================

function tokenExpiry(token) {
    try {
        const parts = String(token).replace(/^TOKEN_/, '').split('.');
        if (parts.length < 2) return 0;
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        return Number(payload.exp) || 0;
    } catch (e) {
        return 0;
    }
}

/**
 * 账号来源（两路，可混用）：
 *   oppo_account  手机号#密码           → 运行时自动登录换 NEWOPPOSID（推荐）
 *   oppo_ck       TOKENSID / 整条 Cookie → 直接当 CK 用（30 天，登录失败时的兜底）
 */
function parsePasswordAccounts() {
    const raw = String(process.env[ENV_ACCOUNT] || '').trim();
    const out = [];
    for (const ln of raw.split(/[\n\r]+/)) {
        const s = ln.trim();
        if (!s || s.startsWith('#')) continue;
        // 手机号#密码   （密码里允许再出现 #，所以只切第一刀）
        const i = s.indexOf('#');
        if (i <= 0) continue;
        const phone = s.slice(0, i).trim();
        const password = s.slice(i + 1).trim();
        if (!/^1[3-9]\d{9}$/.test(phone) || !password) continue;
        out.push({
            name: phone.slice(0, 3) + '****' + phone.slice(-2),
            phone,
            password,
            cookie: null,
            token: null,
            exp: 0,
            guid: crypto.createHash('md5').update(phone).digest('hex')
                .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, '$1-$2-$3-$4-$5').toUpperCase(),
            bizSessionId: crypto.createHash('md5').update(phone + '|biz').digest('hex').toUpperCase().slice(0, 32),
        });
    }
    return out;
}

function parseAccounts() {
    const raw = String(process.env[ENV_CK] || process.env[ENV_CK_ALT] || '').trim();
    const out = [];
    for (const ln of raw.split(/[\n\r]+/)) {
        let s = ln.trim();
        if (!s || s.startsWith('#')) continue;
        // 支持三种写法：整条 Cookie / TOKENSID=xxx / 裸 TOKEN_xxx
        // 注意用 (?:^|;\s*) 锚定，否则会误匹配 ENCODE_TOKENSID=
        // 也支持直接贴 NEWOPPOSID=（密码登录的产物，1 天有效期）
        const nid = s.match(/(?:^|;\s*)NEWOPPOSID=([^;]+)/);
        if (nid) {
            const v = nid[1].trim();
            if (!v) continue;
            out.push({
                cookie: 'NEWOPPOSID=' + v,
                token: v,
                isWeb: true,
                exp: 0,
                guid: crypto.createHash('md5').update(v).digest('hex')
                    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, '$1-$2-$3-$4-$5').toUpperCase(),
                bizSessionId: crypto.createHash('md5').update(v + '|biz').digest('hex').toUpperCase().slice(0, 32),
                name: '账号' + (out.length + 1),
                fallback: true,
            });
            continue;
        }

        let token = '';
        const m = s.match(/(?:^|;\s*)TOKENSID=([^;]+)/);
        if (m) token = m[1].trim();
        else if (/^TOKEN_/.test(s)) token = s;
        else token = s;
        if (!token) continue;
        out.push({
            cookie: 'TOKENSID=' + token,
            token,
            exp: tokenExpiry(token),
            // 设备指纹从 token 派生，保证同一账号每次跑都一致（服务端不校验，只是别每次都变）
            guid: crypto
                .createHash('md5')
                .update(token)
                .digest('hex')
                .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, '$1-$2-$3-$4-$5')
                .toUpperCase(),
            bizSessionId: crypto.createHash('md5').update(token + '|biz').digest('hex').toUpperCase().slice(0, 32),
            name: '账号' + (out.length + 1),
            fallback: true,
        });
    }
    // 密码账号排前面（优先用密码登录），CK 账号作为兜底
    return parsePasswordAccounts().concat(out);
}

function maskToken(t) {
    const s = String(t || '');
    if (s.length <= 24) return s;
    return s.slice(0, 12) + '…' + s.slice(-6);
}

// ============================================================================
// 五、请求头 & API
// ============================================================================

function buildHeaders(acc, extra) {
    // NEWOPPOSID 是 Web 域 cookie，配 Web UA 更自然；TOKENSID 走 App UA
    const isWeb = !!(acc.phone || acc.isWeb);
    const h = {
        'User-Agent': isWeb ? UA_WEB : UA,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        Cookie: acc.cookie,
        Referer: HOST + '/bp/b371ce270f7509f0?nightModelEnable=true&showFloat=1',
        Origin: HOST,
        s_channel: 'ios_oppostore',
        s_version: '500300',
        source_type: '505',
        clientPackage: 'com.oppo.store',
        brand: 'iPhone',
        model: 'iPhone17%2C1',
        modal: 'iPhone17%2C1',
        screen_size: '375x812',
        guid: acc.guid,
        sa_device_id: acc.guid,
        biz_session_id: acc.bizSessionId,
        timeStamp: String(Date.now()),
        'X-Retail-Client-Trace-Id': randHex(32),
    };
    if (extra) Object.assign(h, extra);
    return h;
}

async function apiGet(acc, apiPath, extra) {
    const res = await request({ url: HOST + apiPath, headers: buildHeaders(acc, extra) });
    if (DEBUG) console.log('      ↳ GET ' + apiPath + ' → ' + res.status + ' ' + String(res.text || '').slice(0, 260));
    return res;
}

async function apiPost(acc, apiPath, payload) {
    const res = await request({
        url: HOST + apiPath,
        method: 'POST',
        headers: buildHeaders(acc, { 'Content-Type': 'application/json' }),
        data: payload || {},
    });
    if (DEBUG) {
        console.log('      ↳ POST ' + apiPath + ' ' + JSON.stringify(payload || {}));
        console.log('         → ' + res.status + ' ' + String(res.text || '').slice(0, 260));
    }
    return res;
}

const msgOf = (j) => (j ? j.message || j.errorMessage || (j.error && j.error.message) || '' : '');

/** 登录态失效判定：营销接口统一回 {code:xxx} 或 data.login=false */
function isDead(j) {
    if (!j) return false;
    const code = Number(j.code);
    const msg = String(msgOf(j));
    return code === 401 || code === 403 || /未登录|请登录|登录失效|登录已过期|token.*(过期|失效)/i.test(msg);
}

// ============================================================================
// 六、业务：账号信息 / 积分 actionId
// ============================================================================

async function fetchProfile(acc) {
    const res = await apiGet(acc, API + '/member/queryMemberCreditInfo');
    const j = res.json;
    if (!j || j.code !== 200 || !j.data) {
        return { ok: false, dead: isDead(j), msg: msgOf(j) || ('HTTP ' + res.status + ' ' + String(res.text || '').slice(0, 60)) };
    }
    if (j.data.login !== true) {
        return { ok: false, dead: true, msg: '接口返回未登录（data.login=false）' };
    }
    return { ok: true, nick: j.data.userNickName || '', amount: Number(j.data.amount || 0), level: j.data.userLevel };
}

/** 从「积分乐园会场」页面配置里取 creditsAddActionId / creditsDeductActionId */
async function discoverCredits(acc) {
    try {
        const res = await request({
            url: HOST + '/bp/b371ce270f7509f0?nightModelEnable=true',
            headers: buildHeaders(acc, { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }),
            timeout: 15000,
        });
        const t = String(res.text || '');
        const a = t.match(/"creditsAddActionId":"([0-9a-f]{16,})"/);
        const d = t.match(/"creditsDeductActionId":"([0-9a-f]{16,})"/);
        if (a) CREDITS_ADD = a[1];
        if (d) CREDITS_DEDUCT = d[1];
        if (DEBUG) console.log('      ↳ creditsAdd=' + CREDITS_ADD + ' creditsDeduct=' + CREDITS_DEDUCT);
    } catch (e) {
        if (DEBUG) console.log('      ↳ 取积分 actionId 失败，用内置默认值：' + e.message);
    }
}

// ============================================================================
// 七、业务：签到
// ============================================================================

async function doSignIn(acc) {
    const detail = (await apiGet(acc, API + '/cumulativeSignIn/getSignInDetail?activityId=' + SIGN_ACTIVITY)).json;
    if (!detail || detail.code !== 200 || !detail.data) {
        if (isDead(detail)) return { status: 'dead', msg: msgOf(detail) || '登录失效' };
        return { status: 'fail', msg: '签到详情拉取失败：' + (msgOf(detail) || '空响应') };
    }
    const d = detail.data;
    const days = Number(d.signInDayNum || 0);

    if (d.todaySignIn === true) {
        return { status: 'already', msg: '今日已签到' + (days ? '（累计 ' + days + ' 天）' : ''), days };
    }

    const j = (await apiPost(acc, API + '/cumulativeSignIn/signIn', {
        activityId: SIGN_ACTIVITY,
        creditsAddActionId: CREDITS_ADD,
        business: 1,
    })).json;

    if (j && j.code === 200 && j.data) {
        const v = j.data.awardValue;
        const isPoint = Number(j.data.awardType) === 1;
        return { status: 'ok', gain: isPoint ? Number(v) || 0 : 0, msg: '签到成功 ' + (isPoint ? '+' + v + ' 分' : '得 ' + v), days };
    }
    const m = msgOf(j);
    if (/已签|重复|签到过/.test(m)) return { status: 'already', msg: '今日已签到', days };
    if (isDead(j)) return { status: 'dead', msg: m || '登录失效' };
    return { status: 'fail', msg: '签到失败：' + (m || '未知') };
}

// ============================================================================
// 八、业务：任务
// ============================================================================

/** 任务类型：1 / 2 脚本能自动做，其余都要真人 */
const AUTO_TYPES = new Set([1, 2]);
const TYPE_NAME = {
    1: '浏览页面', 2: '分享页面', 3: '下单', 4: '预约商品', 5: '邀请', 6: '购买',
    7: '签到', 13: '添加导购', 14: '学生认证', 15: '绑定手机', 16: '填写收货地址',
    17: '首单付费', 22: '添加社群', 30: '邀请绑定', 31: '发布内容',
};

async function queryTaskList(acc, activityId) {
    const j = (await apiGet(acc, API + '/task/queryTaskList?activityId=' + activityId + '&source=c')).json;
    if (!j || j.code !== 200 || !j.data) return null;
    return j.data;
}

async function checkCrowd(acc, activityId, taskId) {
    const j = (await apiGet(acc, API + '/task/checkCrowd?activityId=' + activityId + '&taskId=' + taskId)).json;
    return !!(j && j.code === 200 && j.data && j.data.result === true);
}

/** 真去 GET 一次落地页（taskType 1 要求浏览 N 秒，服务端不校验，但做了更像真人） */
async function warmVisit(acc, task) {
    if (!BROWSE) return;
    const link = (task.attachConfigTwo && task.attachConfigTwo.link) || task.actionUrl || '';
    if (!/^https?:\/\//.test(link)) return;
    const wait = parseInt((task.attachConfigOne && task.attachConfigOne.browseTime) || '0', 10) || 0;
    try {
        await request({
            url: link,
            headers: buildHeaders(acc, {
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                Referer: HOST + '/bp/b371ce270f7509f0',
            }),
            timeout: 15000,
        });
        if (wait > 0) await sleep(Math.min(wait, 8) * 1000 + randInt(300, 1200));
    } catch (e) {
        if (DEBUG) console.log('      ↳ 预热落地页失败（忽略）：' + e.message);
    }
}

async function reportTask(acc, activityId, taskId, taskType) {
    const j = (await apiGet(
        acc,
        API + '/taskReport/signInOrShareTask?taskId=' + taskId + '&activityId=' + activityId + '&taskType=' + taskType
    )).json;
    return { ok: !!(j && j.code === 200), msg: msgOf(j) || '未知' };
}

function awardText(d) {
    if (!d) return '奖励';
    const t = Number(d.awardType);
    const v = d.awardValue;
    if (t === 1) return '+' + v + ' 分';
    if (t === 3) return '抽奖次数 +' + v;
    if (t === 2) return '优惠券 ' + (v || '');
    if (t === 14) return '充电券';
    if (t === 13) return '现金红包';
    if (v === null || v === undefined) return '奖励（类型 ' + t + '）';
    return '奖励 ' + v + '（类型 ' + t + '）';
}

async function receiveAward(acc, activityId, taskId) {
    const j = (await apiGet(
        acc,
        API + '/task/receiveAward?taskId=' + taskId + '&activityId=' + activityId +
            '&creditsAddActionId=' + CREDITS_ADD + '&business=1'
    )).json;
    if (j && j.code === 200 && j.data) {
        return { ok: true, award: j.data, msg: awardText(j.data) };
    }
    return { ok: false, msg: msgOf(j) || '未知' };
}

/**
 * 跑一个任务活动。返回 { done: 本次完成数, gain: 本次积分, raffles: Set }
 */
async function runActivityTasks(acc, activityId, activityName) {
    const stat = { done: 0, gain: 0, raffles: new Set(), skipNames: [], total: 0, doneBefore: 0 };
    const data = await queryTaskList(acc, activityId);
    if (!data || !Array.isArray(data.taskDTOList)) {
        console.log('   📋 ' + padR(activityName, 26) + ' 已结束或无任务');
        return stat;
    }
    const now = Date.now();
    const list = data.taskDTOList.filter((t) => {
        const end = Number(t.taskEndTime || 0);
        return !end || end > now;
    });
    if (!list.length) {
        console.log('   📋 ' + padR(activityName, 26) + ' 无可执行任务');
        return stat;
    }

    const todo = list.filter((t) => t.taskStatus === 1);
    const claim = list.filter((t) => t.taskStatus === 2);
    const doneCnt = list.filter((t) => t.taskStatus === 3).length;
    stat.total = list.length;
    stat.doneBefore = doneCnt;
    console.log(
        '   📋 ' + padR(activityName, 26) + ' ' + list.length + ' 个任务' +
        (doneCnt ? '，已完成 ' + doneCnt : '')
    );

    // 先把「已完成待领取」的补领掉
    for (const t of claim) {
        const r = await receiveAward(acc, activityId, t.taskId);
        if (r.ok) {
            console.log('      🎁 补领 ' + t.taskName + ' ' + r.msg);
            if (r.award.raffleId) stat.raffles.add(String(r.award.raffleId));
            if (Number(r.award.awardType) === 1) stat.gain += Number(r.award.awardValue) || 0;
        }
        await sleep(randInt(350, 800));
    }

    for (const t of todo) {
        if (!AUTO_TYPES.has(t.taskType)) {
            console.log('      ⏭️  ' + t.taskName + '（' + (TYPE_NAME[t.taskType] || '类型' + t.taskType) + '，需手动）');
            stat.skipNames.push(t.taskName + '·' + (TYPE_NAME[t.taskType] || '类型' + t.taskType));
            continue;
        }
        if (!(await checkCrowd(acc, activityId, t.taskId))) {
            console.log('      ⏭️  ' + t.taskName + '（不在人群范围）');
            stat.skipNames.push(t.taskName + '·不在人群');
            continue;
        }
        await warmVisit(acc, t);
        const rep = await reportTask(acc, activityId, t.taskId, t.taskType);
        if (!rep.ok) {
            console.log('      ❌ ' + t.taskName + ' 上报失败：' + rep.msg);
            continue;
        }
        await sleep(randInt(450, 1000));
        const rcv = await receiveAward(acc, activityId, t.taskId);
        if (rcv.ok) {
            console.log('      ✅ ' + padR(t.taskName, 22) + ' ' + rcv.msg);
            if (rcv.award.raffleId) stat.raffles.add(String(rcv.award.raffleId));
            if (Number(rcv.award.awardType) === 1) stat.gain += Number(rcv.award.awardValue) || 0;
            stat.done++;
        } else if (/已领|重复|已经/.test(rcv.msg)) {
            console.log('      💤 ' + padR(t.taskName, 22) + ' 已领取');
        } else {
            // 有些任务是上报后直接到账，领奖接口会报错，不当失败
            console.log('      ✅ ' + padR(t.taskName, 22) + ' 已上报（' + rcv.msg + '）');
            stat.done++;
        }
        await sleep(randInt(550, 1300));
    }
    return stat;
}

// ============================================================================
// 九、业务：抽奖
// ============================================================================

async function raffleCount(acc, activityId) {
    const j = (await apiGet(acc, API + '/raffle/queryRaffleCount?activityId=' + activityId)).json;
    if (!j || j.code !== 200 || !j.data) return -1;
    return Number(j.data.count || 0);
}

/**
 * ⚠️ clickRaffle 支持 jimuId / jimuName，但传错了直接 500「活动火爆」。
 *    实测不传照样能抽，所以这里一律不传。
 */
async function runRaffle(acc, activityId, name) {
    const stat = { times: 0, gain: 0, prizes: [] };
    let count = await raffleCount(acc, activityId);
    if (count < 0) {
        console.log('   🎰 ' + padR(name, 26) + ' 查询失败，跳过');
        return stat;
    }
    if (count === 0) {
        console.log('   🎰 ' + padR(name, 26) + ' 0 次机会');
        return stat;
    }
    console.log('   🎰 ' + padR(name, 26) + ' ' + count + ' 次机会');

    let guard = 0;
    while (count > 0 && stat.times < RAFFLE_MAX && guard < RAFFLE_MAX + 5) {
        guard++;
        const j = (await apiGet(
            acc,
            API + '/raffle/clickRaffle?activityId=' + activityId +
                '&creditsAddActionId=' + CREDITS_ADD +
                '&creditsDeductActionId=' + CREDITS_DEDUCT +
                '&business=1'
        )).json;

        if (!j || j.code !== 200) {
            const m = msgOf(j);
            if (/火爆|稍后|繁忙/.test(m)) {
                await sleep(randInt(1500, 3000));
                continue;
            }
            console.log('      ❌ 抽奖失败：' + (m || '未知'));
            break;
        }
        const q = (j.data && j.data.inspectionQualification) || {};
        const win = j.data && j.data.raffleWinnerVO;
        if (Number(q.code) === 204 && !win) {
            console.log('      💤 次数用尽');
            break;
        }
        if (win) {
            const nm =
                win.exhibitAwardName ||
                win.awardName ||
                (Number(win.awardType) === 1 ? win.awardValue + ' 积分' : '奖品类型' + win.awardType);
            console.log('      🎁 ' + nm);
            stat.prizes.push(nm);
            if (Number(win.awardType) === 1) stat.gain += Number(win.awardValue) || 0;
            stat.times++;
        } else {
            console.log('      💤 未中奖' + (q.msg ? '（' + q.msg + '）' : ''));
            stat.times++;
        }
        await sleep(randInt(800, 1800));
        count = await raffleCount(acc, activityId);
        if (count < 0) break;
    }
    return stat;
}

// ============================================================================
// 十、单账号流程
// ============================================================================

async function runAccount(acc, idx, total) {
    const r = {
        name: acc.name,
        status: 'ok',
        level: null,
        signStatus: '',   // ok / already / fail
        signGain: 0,
        signDays: 0,
        taskDone: 0,
        taskGain: 0,
        taskTotal: 0,
        taskDoneBefore: 0,
        taskSkip: [],
        raffleTimes: 0,
        raffleGain: 0,
        prizes: [],
        before: null,
        after: null,
        tokenLeft: null,
        reason: '',
    };

    section('账号 ' + (idx + 1) + '/' + total + '   ' + maskToken(acc.token));

    // 0. 令牌有效期（exp 是毫秒）
    if (acc.exp > 0) {
        const left = Math.floor((acc.exp - Date.now()) / 86400000);
        r.tokenLeft = left;
        if (left < 0) {
            console.log('   🔑 TOKENSID 已过期，请重新抓包更新 oppo_ck');
            r.status = 'dead';
            r.reason = 'TOKENSID 已过期';
            return r;
        }
        if (left <= 3) {
            console.log('   ⚠️  TOKENSID 仅剩 ' + left + ' 天，建议尽快重新抓包');
        } else {
            console.log('   ✅ 令牌有效   剩余约 ' + left + ' 天');
        }
    }

    // 1. 登录态
    const prof = await fetchProfile(acc);
    if (!prof.ok) {
        if (prof.dead) {
            console.log('   🔑 登录态失效：' + prof.msg);
            console.log('      重新抓一次 TOKENSID 覆盖 oppo_ck 即可（有效期约 30 天）');
            r.status = 'dead';
            r.reason = '登录态失效';
        } else {
            console.log('   ❌ 登录态校验失败：' + prof.msg);
            r.status = 'fail';
            r.reason = prof.msg;
        }
        return r;
    }
    acc.name = prof.nick || acc.name;
    r.name = acc.name;
    r.level = prof.level;
    r.before = prof.amount;
    console.log('   ✅ 登录成功   ' + prof.nick + '   Lv.' + prof.level + '   积分 ' + prof.amount);

    // 2. 积分 actionId（活动页配置里取，取不到用内置值）
    await discoverCredits(acc);

    // 3. 签到
    const s = await doSignIn(acc);
    if (s.status === 'dead') {
        console.log('   🔑 签到返回登录失效：' + s.msg);
        r.status = 'dead';
        r.reason = '签到返回登录失效';
        return r;
    }
    r.signStatus = s.status;
    r.signDays = s.days || 0;
    if (s.status === 'ok') {
        console.log('   🎁 ' + s.msg + (s.days ? '（累计 ' + s.days + ' 天）' : ''));
        r.signGain = s.gain || 0;
    } else if (s.status === 'already') {
        console.log('   💤 ' + s.msg);
        r.status = 'already';
    } else {
        console.log('   ❌ ' + s.msg);
        r.reason = s.msg;
    }
    await sleep(randInt(700, 1500));

    // 4. 任务活动
    const raffleIds = new Map();
    for (const [activityId, name] of TASK_ACTIVITIES) {
        const st = await runActivityTasks(acc, activityId, name);
        r.taskDone += st.done;
        r.taskGain += st.gain;
        r.taskTotal += st.total;
        r.taskDoneBefore += st.doneBefore;
        r.taskSkip.push(...st.skipNames);
        for (const rid of st.raffles) raffleIds.set(rid, '活动奖励');
        await sleep(randInt(700, 1500));
    }

    // 5. 抽奖：任务发的次数 + 兜底清单
    for (const [id, nm] of KNOWN_RAFFLES) if (!raffleIds.has(id)) raffleIds.set(id, nm);
    for (const id of EXTRA_RAFFLES) if (!raffleIds.has(id)) raffleIds.set(id, '自定义 ' + id);

    for (const [rid, nm] of raffleIds) {
        const st = await runRaffle(acc, rid, nm);
        r.raffleTimes += st.times;
        r.raffleGain += st.gain;
        r.prizes.push(...st.prizes);
        await sleep(randInt(900, 1800));
    }

    // 6. 收尾
    const after = await fetchProfile(acc);
    if (after.ok) {
        r.after = after.amount;
        const d = after.amount - (r.before === null ? after.amount : r.before);
        console.log('   📈 积分 ' + (r.before === null ? '-' : r.before) + ' → ' + after.amount + '（' + (d >= 0 ? '+' : '') + d + '）');
    }

    if (r.status === 'ok' && r.signGain + r.taskGain + r.raffleGain === 0 && r.raffleTimes === 0) r.status = 'already';
    return r;
}

// ============================================================================
// 十一、汇总 & 推送
// ============================================================================

function fmtTime(d) {
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/**
 * 推送正文。纯文本渠道（企业微信应用 / PushPlus txt / Server酱），
 * 所以靠缩进和分隔线排版，标签宽度用 padR 对齐（CJK 算 2 宽）。
 */
function buildPushText(results) {
    const ok = results.filter((r) => r.status === 'ok').length;
    const already = results.filter((r) => r.status === 'already').length;
    const dead = results.filter((r) => r.status === 'dead').length;
    const fail = results.filter((r) => r.status === 'fail').length;
    const totalGain = results.reduce((s, r) => s + (r.signGain || 0) + (r.taskGain || 0) + (r.raffleGain || 0), 0);
    const totalRaffle = results.reduce((s, r) => s + (r.raffleTimes || 0), 0);

    // 战利品合并计数：同名奖品合成 "×N"
    const prizeCount = (list) => {
        const m = new Map();
        for (const z of list || []) m.set(z, (m.get(z) || 0) + 1);
        return Array.from(m.entries()).map(([k, v]) => (v > 1 ? k + ' ×' + v : k));
    };

    // 按显示宽度补空格，中文/emoji 才不会错位
    const kv = (k, v, w) => '   ' + padR(k, w || 10) + v;

    const out = [];
    out.push('🍊 OPPO 商城 · 每日打卡');
    out.push(fmtTime(new Date()));
    out.push('');

    // ---- 总览一行 ----
    const sum = [];
    if (ok) sum.push('✅ ' + ok + ' 完成');
    if (already) sum.push('💤 ' + already + ' 无变化');
    if (dead) sum.push('🔑 ' + dead + ' 失效');
    if (fail) sum.push('❌ ' + fail + ' 失败');
    const head = [sum.join('  ·  ')];
    if (totalGain > 0) head.push('+' + totalGain + ' 分');
    if (totalRaffle > 0) head.push('抽奖 ' + totalRaffle + ' 次');
    // 单账号不重复报状态（下面账号行已经带了图标）
    if (results.length > 1) out.push(head.filter(Boolean).join('   ·   '));
    else if (totalGain > 0) out.push('+' + totalGain + ' 分');

    results.forEach((r, i) => {
        if (i > 0) out.push('');
        const icon = r.status === 'ok' ? '✅' : r.status === 'already' ? '💤' : r.status === 'dead' ? '🔑' : '❌';
        out.push(icon + ' ' + r.name + (r.level ? '  Lv.' + r.level : ''));

        // 失效 / 失败：只给结论和补救办法
        if (r.status === 'dead' || r.status === 'fail') {
            out.push(kv('原因', r.reason || (r.status === 'dead' ? '凭据失效' : '运行失败'), 6));
            out.push('');
            out.push('   👉 重新登录后覆盖青龙变量 oppo_account');
            out.push('      或抓包更新 oppo_ck');
            return;
        }

        // 签到
        if (r.signStatus === 'ok') {
            out.push(kv('🎁 签到', '+' + r.signGain + ' 分' + (r.signDays ? '   连签 ' + r.signDays + ' 天' : '')));
        } else if (r.signStatus === 'already') {
            out.push(kv('🎁 签到', '今日已签' + (r.signDays ? '   连签 ' + r.signDays + ' 天' : '')));
        } else {
            out.push(kv('🎁 签到', r.reason || '失败'));
        }

        // 任务
        if (r.taskTotal) {
            const done = (r.taskDoneBefore || 0) + (r.taskDone || 0);
            let s = '已完成 ' + done + '/' + r.taskTotal;
            if (r.taskDone > 0) s += '   本轮 +' + r.taskDone;
            if (r.taskGain > 0) s += '   +' + r.taskGain + ' 分';
            out.push(kv('📋 任务', s));
        } else {
            out.push(kv('📋 任务', '本日无活动'));
        }

        // 抽奖
        if (r.raffleTimes > 0) {
            out.push(kv('🎰 抽奖', r.raffleTimes + ' 次' + (r.prizes.length ? '   中 ' + r.prizes.length + ' 件' : '   未中')));
        } else {
            out.push(kv('🎰 抽奖', '无次数'));
        }

        // 积分
        if (r.before !== null && r.before !== undefined && r.after !== null && r.after !== undefined) {
            const d = r.after - r.before;
            const dt = d > 0 ? '+' + d : d === 0 ? '±0' : String(d);
            out.push(kv('💎 积分', r.before + ' → ' + r.after + '   ' + dt));
        }

        // 战利品
        if (r.prizes.length) {
            const ps = prizeCount(r.prizes);
            out.push('   🏆 ' + ps.slice(0, 6).join(' · '));
            if (ps.length > 6) out.push('      等 ' + ps.length + ' 种');
            out.push('');
        }

        // 需手动
        const uniqSkip = [];
        for (const s of r.taskSkip || []) if (!uniqSkip.includes(s)) uniqSkip.push(s);
        if (uniqSkip.length) {
            const names = uniqSkip.map((s) => {
                const k = s.indexOf('·');
                return k < 0 ? s : s.slice(0, k);
            });
            out.push('   ⏭️  需手动 ' + uniqSkip.length + ' 项');
            const show = names.slice(0, 5).join(' / ');
            out.push('      ' + show + (names.length > 5 ? ' 等' : ''));
        }
    });

    out.push('');
    out.push('— 每日 09:10 自动运行 · oppo_store_daily.js');
    if (dead > 0) out.push('  ⚠️ 有账号凭据失效，请尽快更新');

    return scrubPhones(out.join('\n'));
}

async function pushNotify(title, text) {
    const pv = String(process.env[ENV_PUSH] === undefined ? 'on' : process.env[ENV_PUSH]).trim().toLowerCase();
    if (pv === 'off') {
        console.log('\n📴 推送已关闭（oppo_push=off）');
        return;
    }
    if (!flag(ENV_TY_PUSH, 'on')) {
        console.log('\n📴 推送总开关关闭（TYpush=off）');
        return;
    }
    if (pv === 'dry') {
        console.log('\n📮 推送内容预览（dry，未发送）：');
        console.log('');
        console.log(text.split('\n').map((x) => '   ' + x).join('\n'));
        return;
    }

    const notifyPaths = [
        process.env.QL_DIR ? path.join(process.env.QL_DIR, 'data', 'scripts', 'sendNotify.js') : '',
        path.join(__dirname, 'sendNotify.js'),
        '/ql/data/scripts/sendNotify.js',
        '/ql/scripts/sendNotify.js',
        path.join(process.cwd(), 'sendNotify.js'),
    ].filter(Boolean);

    const seen = new Set();
    for (const p of notifyPaths) {
        if (seen.has(p)) continue;
        seen.add(p);
        if (!fs.existsSync(p)) continue;
        try {
            const mod = require(p);
            const sendNotify = mod.sendNotify || mod.default || mod;
            if (typeof sendNotify !== 'function') continue;
            await sendNotify(title, text);
            console.log('\n📮 推送完成：sendNotify.js（' + p + '）');
            return;
        } catch (err) {
            if (DEBUG) console.log('      ↳ 跳过 ' + p + '：' + err.message);
        }
    }
    console.log('\n⚠️  推送未发送：没找到可用的 sendNotify.js');
    console.log('   青龙里确认 /ql/data/scripts/sendNotify.js 存在；本地跑可忽略');
}

// ============================================================================
// 十二、入口
// ============================================================================

async function main() {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════════════════╗');
    console.log('  ║   OPPO 商城 · 签到 + 日常任务 + 活动任务 + 抽奖   v1.1    ║');
    console.log('  ╚══════════════════════════════════════════════════════════╝');

    const accounts = parseAccounts();
    if (!accounts.length) {
        console.log('');
        console.log('  ❌ 未配置任何账号');
        console.log('');
        console.log('     青龙 → 环境变量 → 新建（二选一，也可以都配）：');
        console.log('');
        console.log('       oppo_account = 手机号#密码         ← 推荐，自动登录');
        console.log('       oppo_ck      = TOKEN_eyJhbGci…     ← 兜底，约 30 天');
        console.log('');
        console.log('     多账号换行分隔');
        process.exit(1);
    }

    // 密码账号：先登录换 NEWOPPOSID（靠持久 profile 复用会话，尽量不真登录）
    const useLogin = !/^(0|off|false|no|n)$/i.test(String(process.env[ENV_LOGIN_OFF] || '').trim());
    for (const acc of accounts) {
        if (!acc.phone) continue;
        if (!useLogin) {
            console.log('   ⚠️  ' + acc.name + ' 已关闭密码登录（oppo_login_off），跳过');
            acc.cookie = null;
            continue;
        }
        if (!loginModule) {
            acc.cookie = null;
            acc.loginError = '缺少 oppo_login.js';
            console.log('   ❌ ' + acc.name + ' 登录模块 oppo_login.js 没找到（需与主脚本同目录）');
            continue;
        }
        console.log('');
        console.log('   🔐 ' + acc.name + ' 登录中…');
        try {
            const lr = await loginModule.getOpposhopCookie({
                phone: acc.phone,
                password: acc.password,
                headless: true,
                log: (m) => console.log('      ' + m),
            });
            acc.cookie = lr.cookie;
            acc.via = lr.via;
            acc.exp = lr.expires > 0 ? lr.expires * 1000 : 0;
            console.log('   ✅ ' + acc.name + ' 登录成功（' + (lr.via === 'silent' ? '会话复用' : '账号密码') + '）');
        } catch (e) {
            acc.cookie = null;
            acc.loginError = e && e.message ? e.message : String(e);
            console.log('   ❌ ' + acc.name + ' 登录失败：' + acc.loginError);
        }
    }

    // 密码登录成功 = 兜底 CK 用不上了，丢掉，免得同一个账号跑两遍
    const loginOk = accounts.some((a) => a.phone && a.cookie);
    const usable = accounts.filter((a) => a.cookie && (!loginOk || !a.fallback));
    for (const a of accounts) {
        if (a.cookie) {
            if (loginOk && a.fallback) console.log('   ⏭️  ' + a.name + ' 密码登录已成功，跳过 CK 兜底');
            continue;
        }
        if (a.phone) continue;
        console.log('   ⚠️  ' + a.name + ' 无可用凭据，跳过');
    }
    if (!usable.length) {
        console.log('');
        console.log('  ❌ 没有可用账号');
        console.log('     密码登录失败原因见上方日志；也可用 oppo_ck 兜底');
        process.exit(1);
    }

    section('任务');
    console.log('   🎯 签到活动   ' + SIGN_ACTIVITY);
    for (const [id, nm] of TASK_ACTIVITIES) console.log('   📋 任务活动   ' + id + '  ' + nm);
    for (const [id, nm] of KNOWN_RAFFLES) console.log('   🎰 抽奖活动   ' + id + '  ' + nm);
    console.log('   👥 账号数     ' + usable.length);

    const results = [];
    for (let i = 0; i < usable.length; i++) {
        try {
            results.push(await runAccount(usable[i], i, usable.length));
        } catch (e) {
            console.log('   ❌ 账号异常：' + (e && e.message ? e.message : e));
            if (DEBUG && e && e.stack) console.log(e.stack);
            results.push({
                name: usable[i].name || '账号' + (i + 1), status: 'fail', level: null,
                signStatus: '', signGain: 0, signDays: 0,
                taskDone: 0, taskGain: 0, taskTotal: 0, taskDoneBefore: 0, taskSkip: [],
                raffleTimes: 0, raffleGain: 0, prizes: [],
                before: null, after: null, tokenLeft: null,
                reason: e && e.message ? e.message : String(e),
            });
        }
        if (i < usable.length - 1) {
            const d = String(process.env[ENV_DELAY] || '3-8').split('-').map((x) => parseInt(x, 10));
            let a = Number.isFinite(d[0]) ? d[0] : 3;
            let b = Number.isFinite(d[1]) ? d[1] : Math.max(a, 8);
            if (a > b) [a, b] = [b, a];
            const wait = randInt(a, b);
            console.log('');
            console.log('   ⏳ ' + wait + ' 秒后处理下一个账号…');
            await sleep(wait * 1000);
        }
    }

    const ok = results.filter((r) => r.status === 'ok').length;
    const already = results.filter((r) => r.status === 'already').length;
    const dead = results.filter((r) => r.status === 'dead').length;
    const fail = results.filter((r) => r.status === 'fail').length;
    const totalGain = results.reduce((s, r) => s + (r.signGain || 0) + (r.taskGain || 0) + (r.raffleGain || 0), 0);
    const totalRaffle = results.reduce((s, r) => s + (r.raffleTimes || 0), 0);
    const totalPrize = results.reduce((s, r) => s + (r.prizes ? r.prizes.length : 0), 0);

    console.log('');
    console.log('  ' + line(58));
    console.log('    📊 ✅ ' + ok + ' 完成  ·  💤 ' + already + ' 无变化  ·  🔑 ' + dead + ' 失效  ·  ❌ ' + fail + ' 失败');
    if (totalGain > 0 || totalRaffle > 0) {
        const bits = [];
        if (totalGain > 0) bits.push('本轮 +' + totalGain + ' 分');
        if (totalRaffle > 0) bits.push('抽奖 ' + totalRaffle + ' 次');
        if (totalPrize > 0) bits.push('中奖 ' + totalPrize + ' 件');
        console.log('    🎁 ' + bits.join('  ·  '));
    }
    console.log('  ' + line(58));

    if (dead > 0) {
        console.log('');
        console.log('   💡 有账号凭据失效');
        console.log('');
        console.log('      密码登录：检查 oppo_account 是否写对，或看上方登录失败原因');
        console.log('      TOKENSID：重新抓包 hd.opposhop.cn → Cookie 里 TOKENSID= → 覆盖 oppo_ck');
        console.log('');
    }

    const text = buildPushText(results);
    await pushNotify('OPPO商城 ' + (ok + already) + '/' + results.length + ' 账号完成', text);
}

main().catch((e) => {
    console.error('');
    console.error('  💥 脚本异常：' + (e && e.stack ? e.stack : e));
    process.exit(1);
});
