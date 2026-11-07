/* ---------------------------------------------------------------------------
 *  项目名称：中国联通（签到 + 任务中心）
 *  脚本文件：unicom_signin.js
 *  更新说明：
 *    2026-11-01  Mist  仓库整理：统一项目标识、清理隐私信息
 *    2026-11-03  Mist  设备指纹改为按账号派生，修复「设备登录过多」；UA 去掉真机型号
 *    2026-11-07  Mist  v1.3 推送排版紧凑化（unicom_push_style）；补全接口与坑位说明
 * ---------------------------------------------------------------------------
 */
/**
 * ============================================================================
 *  中国联通（Unicom）· 每日签到 + 任务中心（青龙面板版 · 纯 HTTP 无依赖）
 * ============================================================================
 *
 *  作    者：Mist
 *  版    本：v1.3（新增：推送排版紧凑化；token 失效自动密码登录续期）
 *  适配版本：中国联通 iOS 13.1（com.chinaunicom.mobilebusiness）/ 签到区 H5 13.0100
 *
 * ----------------------------------------------------------------------------
 *  【这条路是怎么走通的】
 * ----------------------------------------------------------------------------
 *  iOS 抓包（10973 条）→ 筛出 act.10010.com / activity.10010.com 两组签到接口
 *  → 把抓包 Cookie 拆成 43 个逐个二分，测出「只靠 ecs_token 一个就够」
 *  → 再用 ecs_token 单独跑通签到、任务、月签、余额、积分五条链路，逐条对账。
 *
 *  一、鉴权：只要一个 ecs_token
 *      act.10010.com 与 activity.10010.com 这两个域**只认 ecs_token**。
 *      我把抓包里的 43 个 Cookie 拆开做贪心最小集，结果是：
 *        ecs_token 单独一项 → status 0000
 *        其余 42 项任意组合（custId / u_account / c_mobile / numToken / TOKEN_UID*…）→ 0001
 *      所以本脚本只发 ecs_token，不伪造任何设备指纹，被风控的概率最低。
 *      ★ 坑一：m.client.10010.com（原生接口）**不**认 ecs_token，那套要 token_online。
 *              签到区完全走 act/activity 两个域，不需要碰原生接口。
 *
 *  二、密码登录：可以全自动，已验证跑通
 *      POST https://loginhl.10010.com/mobileService/login.htm
 *        mobile   = RSA_PKCS1_v1_5(手机号 + 6位随机数字, PUB_KEY)
 *        password = RSA_PKCS1_v1_5(明文密码 + 6位随机数字, PUB_KEY)
 *        appId    = 118 位固定模板（dex 里是拼出来的，不是明文常量）
 *        keyVersion=2 / deviceCode / deviceId / uniqueIdentifier …
 *      实测返回码：
 *        code 11       服务密码已停用，请用登录密码
 *        code 2        请使用短信验证码登录进行身份验证（风控硬闸，与密码对错无关）
 *        ECS99999      当前账号登录需要图形验证码校验 ← 正常态
 *        type 10       跳到 img.client.10010.com/loginRisk（腾讯 TCaptcha 点选）
 *
 *      ★ 关键修正：validateTencentCaptcha 是**明文 JSON**，encrypt-key/scene-key
 *        两个头虽然是空的也必须带上，不需要任何 AES/RSA 混合加密。
 *
 *      完整四步（全部实测通过，见 unicom_auto_login.py）：
 *        ① login.htm                         → ECS99999 + mobile(640 hex) + type=10
 *        ② 真实浏览器过腾讯点选验证码         → ticket + randstr
 *        ③ POST /login-web/v1/chartCaptcha/validateTencentCaptcha
 *           {"seq":"<uuid4>","captchaType":"10","mobile":"<640hex>",
 *            "ticket":"...","randStr":"...","imei":"<deviceCode>"}
 *                                            → resultToken
 *        ④ login.htm + resultToken           → code=0 + ecs_token
 *
 *      ★ 为什么必须用浏览器：cap_union_new_verify 的 collect（tdc.js 设备指纹+
 *        轨迹）、eks、pow_answer 都由腾讯 SDK 在页面里现算，纯 Python 补不出来。
 *        但只要在 iframe 里用真实鼠标点对坐标，SDK 就会自己算好并提交。
 *      ★ 验证码识别：背景图标用「严格阈值连通域 ∪ AntiCAP 检测」做候选池，
 *        再「先旋转后归一化 + IoU 全排列最优分配」匹配提示条顺序。
 *        形态学开运算可剔除穿过图标的草叶/棱边，实测两个样本 3/3 全中。
 *      → 结论：**配 unicom_pwd 即可全自动续期**；没配则退回抓包拿 ecs_token。
 *
 *  三、签到接口
 *      GET  activity.10010.com/sixPalaceGridTurntableLottery/signin/getContinuous
 *             ?taskId=&channel=shouye&imei=<deviceCode>
 *           → data.current[0].isSigned = y/n、data.continueCount = 连签天数
 *      POST activity.10010.com/sixPalaceGridTurntableLottery/signin/daySign
 *           body: shareCl=&shareCode=            ← 两个都必须存在，可以为空
 *           → data.statusDesc「签到成功」、data.redSignMessage「+0.01元」
 *           ★ 坑二：已签到时返回 code 0002「您今天已经签到啦」，
 *                   这是幂等，不是错误，别当失败报。
 *
 *  四、任务中心（这才是大头，一天 6 个 × 0.01 元）
 *      GET  …/task/taskList?type=2
 *           → data.taskList[] + data.tagList[].taskDTOList[]
 *      任务对象关键字段：
 *           taskState  1=可做 3=已领 0=可领（抽奖类）
 *           taskType   5=浏览类（能自动做完） 8=跳第三方 App（做不了） 3=抽奖
 *           url        任务落地页，type=8 时是 "1"（占位）
 *      GET  m.client.10010.com/taskcallback/topstories/gettaskip
 *           body: mobile=<手机号>&orderId=<32位大写随机>
 *           → 服务端记一次 IP 流水，返回 {code:0000, msg:<客户端IP>}
 *      GET  …/task/completeTask?taskId=&orderId=&systemCode=QDQD
 *      GET  …/task/getTaskReward?taskId=
 *           → data.code 0000 + data.prizeNameRed「+0.01元」= 到账
 *           → data.code 0329「任务失败」= 这类任务（抽奖）不走这条领奖路径，跳过即可
 *      ★ 坑三：completeTask 对 type=8 直接回 0305「任务完成失败」，
 *              但**仍会**在 getTaskReward 里回 0329，别把它当成功。
 *      ★ 坑四：状态机必须自己去重。只按 taskState 循环会死循环
 *              （type=3 的 taskState 永远停在 0），所以脚本记 attempted 集合。
 *
 *  五、月签有礼
 *      GET  …/floor/getMonthSign
 *           → data.taskList[]: taskStatus 1=可领 0=未达成 2=已领
 *      GET  …/task/getTaskReward?taskId=&taskType=30&id=
 *           ★ 坑五：这里必须带 taskType=30 和 id，只给 taskId 会领不到。
 *
 *  六、资产
 *      POST act.10010.com/SigninApp/convert/getTelephone   → data.telephone（话费红包余额）
 *      GET  …/signin/getIntegral                            → data.integralTotal（积分）
 *      POST act.10010.com/SigninApp/convert/phoneDetails    → 红包流水（明细对账用）
 *
 *  七、失效特征
 *      status/code 0000  正常
 *      0001              未登录（ecs_token 过期）→ 重新抓包
 *      0002              今天已签到（幂等）
 *      0329              系统繁忙 / 任务失败（软失败，跳过）
 *      0305              completeTask 不支持该任务类型
 *
 *  八、ecs_token 能活多久
 *      实测：2026-10-25 20:16 拿到的 ecs_token，到 2026-10-26 21:44（25.5 小时）
 *      仍然返回 status 0000，可以正常签到 → **有效期至少 25 小时，跨天无忧**。
 *      同一份抓包里的 token_online 只有 5 分钟寿命（onLine.htm 立即回 code 1），
 *      所以 token_online 是一次性票，ecs_token 才是长期票。
 *      结论：每天 8:45 跑一次签到，token 完全撑得住；万一哪天失效，
 *      配了 unicom_pwd 会自动过验证码续期，没配才需要手动重抓包。
 *      抓包位置：App 随便点几下 → 抓包工具里找任意 act.10010.com 请求 →
 *      复制 Cookie 里的 ecs_token= 后面那一段（很长，以 eyJ 开头）。
 *
 * ----------------------------------------------------------------------------
 *  【免责声明】
 * ----------------------------------------------------------------------------
 *  1. 本脚本仅供个人学习与技术研究，仅用于自己有权操作的账号。
 *  2. 使用本脚本可能违反平台《用户协议》，由此产生的账号受限、红包清空
 *     等后果，由使用者自行承担。
 *  3. 请勿用于批量注册、代签到、售卖等商业用途；请勿高频调用。
 *  4. 脚本不收集、不上传任何账号信息，所有凭证只在你自己的青龙里。
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

// ============================================================================
// 一、配置（只需要填一个变量：unicom = 手机号:登录密码）
// ============================================================================

const ENV_MAIN = 'unicom';             // ★ 唯一必填：手机号:登录密码（多账号换行）
const ENV_MAIN_ALT = 'UNICOM';         // 大写容错
const ENV_CK = 'unicom_ck';            // 可选兜底：已有 ecs_token（不想用浏览器登录时）
const ENV_PUSH = 'unicom_push';        // on/off：是否推送（默认 on）
const ENV_TY_PUSH = 'TYpush';          // 与其它脚本共用的总开关
const ENV_DELAY = 'unicom_delay';      // 多账号之间的随机间隔，形如 5-15（秒）
const ENV_TASKS = 'unicom_tasks';      // on/off：任务中心（默认 on）
const ENV_MONTH = 'unicom_monthsign';  // on/off：月签有礼（默认 on）
const ENV_POINTS = 'unicom_points';    // on/off：查积分（默认 on）
const ENV_PROBE = 'unicom_probe';      // on：只探针（查状态，不签到不做任务）
const ENV_FORCE = 'unicom_force';      // on：即使已签也强制发一次签到请求（调试用）
const ENV_DEBUG = 'unicom_debug';      // on/off：打印原始报文
const ENV_TASK_ID = 'unicom_task_id';  // 调试：只处理指定 taskId（忽略任务状态）
// 高级项（一般不用改）
const ENV_PYPATH = 'unicom_pypath';    // python 解释器路径（默认 python）
const ENV_LOGIN_SCRIPT = 'unicom_login_script'; // unicom_auto_login.py 路径（自动查找）
const ENV_QL_URL = 'unicom_ql_url';    // 青龙地址，配了才回写 token
const ENV_QL_USER = 'unicom_ql_user';  // 青龙用户名
const ENV_QL_PASS = 'unicom_ql_pass';  // 青龙密码
const ENV_CMF = 'unicom_cmf';           // on/off：乘风破浪2026 云盘活动（默认 on）
const ENV_CMF_TEST = 'unicom_cmf_test'; // on：云盘活动只查询不执行
const ENV_CMF_SRC = 'unicom_cmf_src';   // lt_cmf2026.py 路径（默认自动查找）
const ENV_ALL = 'unicom_all';           // on/off：全部扩展任务（默认 on）
const ENV_ALL_SKIP = 'unicom_all_skip'; // 跳过指定模块，逗号分隔（enable_ 前缀可省）
const ENV_ALL_SRC = 'unicom_all_src';   // chinaUnicom.py 路径（默认自动查找）
const ENV_WOREAD = 'unicom_woread';     // on/off：联通阅读（默认 on）
const ENV_PUSH_STYLE = 'unicom_push_style'; // simple(默认紧凑) / full(旧版明细)

// ── 全部扩展任务（chinaUnicom.py 的 10 个模块）──────────────────────
const ALL_WRAPPER = path.join(__dirname, '..', '附带脚本', 'unicom_tasks.py');
const ALL_WRAPPER_ALT = path.join(__dirname, 'unicom_tasks.py');

// 模块中文名，用于日志/推送
const ALL_MODULES = {
    sign: '首页签到',
    ltzf: '联通祝福',
    ttlxj: '天天领现金',
    market: '权益超市',
    woread: '联通阅读',
    aiting: '联通爱听',
    security: '安全管家',
    ltyp: '联通云盘',
    wostore: '沃云手机',
    regional: '区域专区',
};

// ── 乘风破浪2026（联通云盘）─────────────────────────────────────────
const CMF_WRAPPER = () => resolveFile('unicom_cmf.py');
const CMF_TOKEN_CACHE = resolveFile('unicom_token_cache.json',
    path.join(__dirname, '..', 'unicom_token_cache.json'))
    || path.join(__dirname, 'unicom_token_cache.json');

/** 签到区两个域 */
const HOST_ACT = 'https://act.10010.com';
const HOST_ACTIVITY = 'https://activity.10010.com';
const HOST_MCLIENT = 'https://m.client.10010.com';

const API = {
    // 身份 / 资产
    signboard: `${HOST_ACT}/SigninApp/convert/signboard`,
    telephone: `${HOST_ACT}/SigninApp/convert/getTelephone`,
    phoneDetails: `${HOST_ACT}/SigninApp/convert/phoneDetails`,
    // 签到
    continuous: `${HOST_ACTIVITY}/sixPalaceGridTurntableLottery/signin/getContinuous`,
    daySign: `${HOST_ACTIVITY}/sixPalaceGridTurntableLottery/signin/daySign`,
    integral: `${HOST_ACTIVITY}/sixPalaceGridTurntableLottery/signin/getIntegral`,
    // 任务中心
    taskList: `${HOST_ACTIVITY}/sixPalaceGridTurntableLottery/task/taskList`,
    completeTask: `${HOST_ACTIVITY}/sixPalaceGridTurntableLottery/task/completeTask`,
    taskReward: `${HOST_ACTIVITY}/sixPalaceGridTurntableLottery/task/getTaskReward`,
    taskIp: `${HOST_MCLIENT}/taskcallback/topstories/gettaskip`,
    // 月签有礼
    monthSign: `${HOST_ACTIVITY}/sixPalaceGridTurntableLottery/floor/getMonthSign`,
    // 悬浮任务
    floating: `${HOST_ACT}/SigninApp/floatingTask/getFloatingTask`,
    floatingDone: `${HOST_ACT}/SigninApp/floatingTask/accomplishFloatingTask`,
};

/**
 * 设备种子与系统版本：从环境变量读，默认中性机型，不写死任何人的真机。
 * （设备型号 unicom_device_model 只影响密码登录，那是 unicom_auto_login.py 的事）
 */
const DEVICE_SEED = process.env.unicom_device_seed || 'mist-2026';
const DEVICE_OS = process.env.unicom_device_os || '17.6.1';
const UA_OS = DEVICE_OS.split('.').slice(0, 2).join('_');   // 真实 UA 是 17_6，不是 17_6_1

/** 与 App 一致的 UA（WebView 那套，带 unicom{version:...} 标记） */
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS ' + UA_OS + ' like Mac OS X) AppleWebKit/605.1.15 '
    + '(KHTML, like Gecko)  unicom{version:iphone_c@13.0100};ltst;OSVersion/' + DEVICE_OS;

/**
 * 设备码：按 手机号 + 种子 确定性派生，同一个账号永远是同一台设备。
 * 旧写法是 crypto.randomBytes —— 缓存一丢就换一台新设备，跑几天就顶到
 * 联通「设备登录过多」的上限，连自己真机都登不进去。
 */
function deriveDeviceCode(mobile) {
    const hx = crypto.createHash('sha256')
        .update('unicom|' + DEVICE_SEED + '|' + (mobile || 'anon'), 'utf8')
        .digest('hex').toUpperCase();
    return [hx.slice(0, 8), hx.slice(8, 12), hx.slice(12, 16), hx.slice(16, 20), hx.slice(20, 32)]
        .join('-');
}
const REFERER = 'https://img.client.10010.com/SigininApp/index.html';
const ORIGIN = 'https://img.client.10010.com';

/** 失败码字典（脚本按这张表判状态） */
const CODE_TEXT = {
    '0000': '成功',
    '0001': '未登录，ecs_token 已失效',
    '0002': '今天已经签到啦',
    '0305': '任务完成失败（该类型不支持自动完成）',
    '0329': '系统繁忙 / 任务失败',
};

// ============================================================================
// 二、终端排版（与美居脚本同一套，等宽对齐不乱）
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

const line = (w = 54) => '─'.repeat(w);

function section(t, w = 58) {
    console.log('');
    console.log('  ' + t);
    console.log('  ' + line(w));
}

// ============================================================================
// 三、小工具
// ============================================================================

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);

const flag = (name, def = false) => {
    const v = String(process.env[name] ?? '').trim();
    if (!v) return def;
    return /^(1|on|true|yes|y)$/i.test(v);
};

const DEBUG = flag(ENV_DEBUG);

const maskMobile = (m) => {
    const s = String(m || '');
    return /^\d{11}$/.test(s) ? `${s.slice(0, 3)}****${s.slice(-4)}` : s;
};

const maskToken = (t) => {
    const s = String(t || '');
    if (s.length <= 12) return s || '—';
    return `${s.slice(0, 8)}…${s.slice(-6)}`;
};

/** 32 位大写随机 orderId（App 里就是这么造的） */
const orderIdOf = () => {
    const cs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let s = '';
    for (let i = 0; i < 32; i++) s += cs[Math.floor(Math.random() * cs.length)];
    return s;
};

/** 从 "+0.01元" / "0.05" 这类串里抠出数字 */
function numOf(v) {
    if (v === null || v === undefined) return null;
    const m = String(v).match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
}

/** 金额格式化成 2 位 */
const money = (n) => (Number.isFinite(n) ? n.toFixed(2) : '—');

// ============================================================================
// 四、HTTP
// ============================================================================

function request(opts) {
    return new Promise((resolve, reject) => {
        const u = new URL(opts.url);
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
                        else if (enc.includes('deflate')) buf = zlib.inflateSync(buf);
                        else if (enc.includes('br') && zlib.brotliDecompressSync) buf = zlib.brotliDecompressSync(buf);
                    } catch (e) { /* 解不开就用原文 */ }
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

function parseJson(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    try {
        return JSON.parse(t);
    } catch (e) {
        return { _raw: t.slice(0, 400), _err: e.message };
    }
}

/**
 * 打一次联通接口。
 *   sess  会话（提供 ecs_token / mobile）
 *   opt   { method, url, form, referer, timeout }
 */
async function api(sess, opt) {
    const method = opt.method || 'GET';
    const headers = {
        'User-Agent': UA,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
        Origin: ORIGIN,
        Referer: opt.referer || REFERER,
        Cookie: sess.cookie,
    };
    let data = null;
    if (method === 'POST') {
        const form = opt.form || {};
        const body = Object.keys(form).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(form[k])}`).join('&');
        data = body;
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    if (DEBUG) console.log(`      → ${method} ${opt.url.replace(/^https?:\/\/[^/]+/, '')}`);
    const r = await request({ url: opt.url, method, headers, data, timeout: opt.timeout || 20000 });
    const j = parseJson(r.text);
    if (DEBUG) console.log(`      ← ${r.status} ${String(r.text).slice(0, 300)}`);
    if (!j) throw new Error(`响应不是 JSON（HTTP ${r.status}）`);
    return j;
}

/** 统一取状态码：act 用 status，activity 用 code */
const codeOf = (j) => {
    if (!j) return 'null';
    if (j.status !== undefined) return String(j.status);
    if (j.code !== undefined) return String(j.code);
    return 'null';
};

const isOk = (j) => codeOf(j) === '0000';

/** 未登录判定 */
const isDead = (j) => codeOf(j) === '0001' || /您还没有登录|未登录/.test(String(j.msg || j.desc || ''));

// ============================================================================
// 四点五、密码自动登录续期（腾讯点选验证码走真实浏览器）
// ============================================================================

/**
 * 解析 unicom_pwd，一行一个：
 *   18500000000:登录密码
 *   主号#18500000000:登录密码
 */
function parsePwd(raw) {
    const map = {};
    for (const line of String(raw || '').split(/[\n\r]+/).map((s) => s.trim()).filter(Boolean)) {
        let s = line;
        const hash = s.lastIndexOf('#');
        if (hash > 0 && !/^\d{11}:/.test(s)) s = s.slice(hash + 1);
        const i = s.indexOf(':');
        if (i <= 0) continue;
        const m = s.slice(0, i).trim();
        const p = s.slice(i + 1);
        if (/^\d{11}$/.test(m) && p) map[m] = p;
    }
    return map;
}

/**
 * 调用 Python 全自动登录，返回新 ecs_token 或 null。
 * 链路：login.htm(RSA) → 浏览器过腾讯点选 → ticket → validateTencentCaptcha
 *       → resultToken → login.htm → ecs_token
 */
function autoLogin(mobile, password) {
    const { spawnSync } = require('child_process');
    const cands = [];
    if (process.env[ENV_LOGIN_SCRIPT]) cands.push(process.env[ENV_LOGIN_SCRIPT]);
    cands.push(
        path.join(__dirname, 'unicom_auto_login.py'),
        path.join(__dirname, '..', '附带脚本', 'unicom_auto_login.py'),
        path.join('/ql/data/scripts', 'unicom_auto_login.py'),
    );
    const script = cands.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });
    if (!script) {
        console.log('  │  ⚠ 未找到 unicom_auto_login.py，跳过自动续期');
        return null;
    }
    const py = process.env[ENV_PYPATH] || 'python';
    console.log(`  │  🔄 尝试密码自动登录：${maskMobile(mobile)}`);
    const t0 = Date.now();
    const res = spawnSync(py, ['-X', 'utf8', script, '--mobile', mobile,
        '--password', password, '--json'], {
        encoding: 'utf8', timeout: 8 * 60 * 1000, windowsHide: true,
        env: Object.assign({}, process.env, { PYTHONUTF8: '1' }),
    });
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    const out = String(res.stdout || '');
    const m = out.match(/\{"ok":\s*true[^\n]*\}/);
    if (m) {
        try {
            const j = JSON.parse(m[0]);
            if (j.ecs_token) {
                console.log(`  │  ✅ 自动登录成功（${secs}s），已换到新 ecs_token`);
                return j.ecs_token;
            }
        } catch (e) { /* 落到下面 */ }
    }
    const tail = out.split('\n').filter(Boolean).slice(-4).join(' | ').slice(0, 300);
    console.log(`  │  ⚠ 自动登录未拿到 token（${secs}s）${tail ? '：' + tail : ''}`);
    if (res.error) console.log(`  │  ⚠ ${res.error.message}`);
    return null;
}

/**
 * 续期成功后把新 token 回写到青龙环境变量，避免下次又重跑登录。
 * 需要三个可选环境变量：unicom_ql_url / unicom_ql_user / unicom_ql_pass
 */
function syncToQinglong(mobile, token) {
    const base = String(process.env[ENV_QL_URL] || '').trim().replace(/\/+$/, '');
    const user = String(process.env[ENV_QL_USER] || '').trim();
    const pass = String(process.env[ENV_QL_PASS] || '');
    if (!base || !user || !pass || !token) return;
    const py = resolveFile('ql_sync.py');
    if (!fs.existsSync(py)) return;
    try {
        const { execFileSync } = require('child_process');
        // token 走环境变量，不进命令行（避免进程列表/错误信息泄露）
        const o = execFileSync(
            process.env[ENV_PYPATH] || 'python',
            ['-X', 'utf8', py, base, user, pass, mobile],
            {
                encoding: 'utf8', timeout: 60000, windowsHide: true,
                env: Object.assign({}, process.env, {
                    PYTHONUTF8: '1',
                    QL_TOKEN: token,
                }),
            }
        );
        const res = String(o).trim();
        if (res === 'OK') console.log('  │  ☁  青龙已同步新 token');
        else if (res !== 'ENV_NOT_FOUND') {
            // 只报错误类型，绝不回显命令行
            const why = /^[A-Z_0-9]+$/.test(res) ? res : 'ERR';
            console.log(`  │  ⚠ 青龙回写未完成（${why}）`);
        }
    } catch (e) {
        // e.message 里含完整命令行（带 token），一律不打印
        console.log('  │  ⚠ 青龙回写未完成（跳过）');
    }
}

// ============================================================================
// 五、凭证解析 + 缓存
// ============================================================================

/**
 * 在多个候选位置里找第一个存在的文件。
 * 兼容两种部署：本地按项目分层（主脚本/ 附带脚本/），青龙里全部平铺在 /ql/data/scripts/。
 */
function resolveFile(name, ...extra) {
    const cands = [];
    for (const e of extra) if (e) cands.push(e);
    cands.push(
        path.join(__dirname, name),
        path.join(__dirname, '..', '附带脚本', name),
        path.join(__dirname, '..', '主脚本', name),
        path.join(__dirname, '..', name),
        path.join('/ql/data/scripts', name),
        path.join('/ql/scripts', name),
        path.join(process.cwd(), name),
    );
    for (const p of cands) {
        try { if (fs.existsSync(p)) return p; } catch (e) { /* ignore */ }
    }
    return '';
}

const CK_CACHE = resolveFile('.unicom_ck.json',
    path.join(__dirname, '..', '.unicom_ck.json')) || path.join(__dirname, '.unicom_ck.json');

function readCache() {
    try {
        if (!fs.existsSync(CK_CACHE)) return {};
        const txt = fs.readFileSync(CK_CACHE, 'utf8').replace(/^\uFEFF/, '');
        return JSON.parse(txt) || {};
    } catch (e) {
        return {};
    }
}

function writeCache(o) {
    try {
        fs.writeFileSync(CK_CACHE, JSON.stringify(o, null, 2), 'utf8');
    } catch (e) { /* 只读目录就算了 */ }
}

/**
 * 解析 unicom 环境变量，一行一个账号。**主写法只要手机号:密码**：
 *   ① 18500000000:登录密码            ← 推荐，全自动，不用抓包
 *   ② 主号#18500000000:登录密码        ← 带备注
 *   ③ 18500000000#eyJkYXRh...         ← 只有 token（不想用浏览器时兜底）
 *   ④ eyJkYXRh...                     ← 裸 token
 * 判断依据：含 11 位手机号 + 冒号 → 密码模式；含 eyJ 开头长串 → token 模式。
 */
function parseAccounts(raw) {
    const out = [];
    const lines = String(raw || '')
        .split(/[\n\r]+/)
        .map((s) => s.trim())
        .filter(Boolean);

    for (const raw0 of lines) {
        let s = raw0;
        let name = '';

        // 备注前缀：xxx# 后面才是实际凭证
        if (s.includes('#')) {
            const seg = s.split('#').map((x) => x.trim()).filter(Boolean);
            // 找到第一个「像凭证」的段
            let idx = -1;
            for (let i = 0; i < seg.length; i++) {
                if (/^1[3-9]\d{9}$/.test(seg[i]) || /^ey[A-Za-z0-9_\-=]{20,}$/.test(seg[i])) {
                    idx = i;
                    break;
                }
            }
            if (idx > 0) {
                name = seg.slice(0, idx).join('#').trim();
                s = seg.slice(idx).join('#').trim();
            }
        }

        // ---- 密码模式：手机号:密码 ----
        const pm = s.match(/^(1[3-9]\d{9})\s*:\s*(.+)$/);
        if (pm) {
            out.push({
                name: name || `账号${out.length + 1}`,
                mobile: pm[1],
                password: pm[2].trim(),
                token: '',
                jar: {},
                cookie: '',
            });
            continue;
        }

        // ---- token 模式 ----
        let token = '';
        const jar = {};
        if (s.includes('ecs_token=')) {
            for (const kv of s.split(';')) {
                const i = kv.indexOf('=');
                if (i < 0) continue;
                const k = kv.slice(0, i).trim();
                const v = kv.slice(i + 1).trim();
                if (k) jar[k] = v;
            }
            token = jar.ecs_token || '';
        } else if (/^ey[A-Za-z0-9_\-=]{20,}$/.test(s)) {
            token = s;
            jar.ecs_token = s;
        }
        if (!token) continue;

        const mobile = (/^\d{11}$/.test(jar.custId || '') && jar.custId)
            || (/^\d{11}$/.test(jar.u_account || '') && jar.u_account)
            || (/^\d{11}$/.test(jar.c_mobile || '') && jar.c_mobile)
            || '';

        out.push({
            name: name || `账号${out.length + 1}`,
            mobile,
            password: '',
            token,
            jar,
            cookie: `ecs_token=${token}`,
        });
    }
    return out;
}

/** 把缓存里更长的 Cookie 串合并进来（若用户后来贴了整串） */
function mergeCookie(acc, cached) {
    if (acc.jar && Object.keys(acc.jar).length > 1) return;
    const t = (cached && cached.ecs_token) || '';
    if (t && !acc.token) {
        acc.token = t;
        acc.cookie = `ecs_token=${t}`;
    }
    if (!acc.mobile && cached && cached.mobile) acc.mobile = cached.mobile;
}

// ============================================================================
// 六、业务
// ============================================================================

/** 身份自检：signboard 里 isUnicom=true 就说明 token 活着 */
async function queryProfile(sess) {
    const j = await api(sess, { method: 'POST', url: API.signboard, form: {} });
    if (isDead(j)) return { dead: true, raw: j };
    const d = j.data || {};
    const isUnicom = String(d.isUnicom) === 'true';
    // 兜底：既没签看板字段又不是联通号 → 基本可判定 token 无效
    if (!isUnicom && !d.signboard) return { dead: true, raw: j };
    return { dead: false, isUnicom, raw: j };
}

/** 话费红包余额 */
async function queryCoupon(sess) {
    const j = await api(sess, { method: 'POST', url: API.telephone, form: {} });
    if (!isOk(j)) return null;
    const d = j.data || {};
    return {
        amount: numOf(d.telephone) ?? 0,
        expiring: numOf(d.needexpNumber),
        month: d.month || '',
    };
}

/** 积分 */
async function queryPoints(sess) {
    try {
        const j = await api(sess, { url: API.integral });
        if (!isOk(j)) return null;
        return numOf((j.data || {}).integralTotal);
    } catch (e) {
        return null;
    }
}

/** 签到状态 */
async function querySignState(sess) {
    const url = `${API.continuous}?taskId=&channel=shouye&imei=${encodeURIComponent(sess.deviceCode)}`;
    const j = await api(sess, { url });
    if (isDead(j)) return { dead: true, raw: j };
    if (!isOk(j)) return { fail: true, raw: j };
    const d = j.data || {};

    /**
     * 关键字段（2026-10 实测确认，不要再用 current[0].isSigned）：
     *   todayIsSignIn    = "y"/"n"  ← 今天到底签没签，唯一权威
     *   continueCount    = 签完后=本轮连签天数（未签时为 0）
     *   continueCountCur = 当前处在周期第几天（未签时=昨天已签到的天数）
     *   current[]        = 本轮 28 天的奖励表，isSigned 表示「该天是否已完成」，
     *                      周期走完时 28 项全是 y —— 所以拿 current[0] 判今天必错。
     */
    const signedToday = String(d.todayIsSignIn) === 'y';
    const cntSigned = numOf(d.continueCount) || 0;      // 签完后的连签数
    const cntCur = numOf(d.continueCountCur) || 0;      // 周期内位置

    // 展示用连签天数：已签看 continueCount，未签看 continueCountCur
    const streak = signedToday ? cntSigned : cntCur;

    // 每日奖励表（本轮 28 天）
    // 注意：prizeCount 单位是「分」（1 表示 0.01 元），
    // prizeName 已经是格式化好的字符串（"0.01" / "0.16"），展示优先用它
    const days = (d.current || []).map((x) => ({
        day: numOf(x.day),
        signed: String(x.isSigned) === 'y',
        prize: numOf(x.prizeCount),
        prizeName: String(x.prizeName || ''),
        special: String(x.isSpecial) === 'y',
    }));

    // 当天奖励：已签=刚签的那天，未签=今天所在的周期第几天
    const dayNo = signedToday ? (cntSigned || 1) : ((cntCur || 0) + 1);
    const todayPrize = days.find((x) => x.day === dayNo) || null;
    const tomorrow = days.find((x) => x.day === dayNo + 1) || null;

    return {
        signedToday,
        streak,
        streakCur: cntCur,
        streakCnt: cntSigned,
        // keepDays=还需几天到连签奖励，keepDesc=奖励内容
        keepDays: numOf(d.keepDays),
        keepDesc: d.keepDesc || '',
        days,
        todayPrize,
        tomorrow,
        raw: j,
    };
}

/** 签到 */
async function doSign(sess) {
    const j = await api(sess, { method: 'POST', url: API.daySign, form: { shareCl: '', shareCode: '' } });
    const code = codeOf(j);
    if (code === '0000') {
        const d = j.data || {};
        return {
            ok: true,
            desc: d.statusDesc || '签到成功',
            reward: d.redSignMessage || '',
            gain: numOf(d.redSignMessage) ?? numOf(d.prizeCount) ?? 0,
            raw: j,
        };
    }
    if (code === '0002') return { already: true, desc: j.desc || CODE_TEXT['0002'], gain: 0, raw: j };
    return { ok: false, code, desc: j.desc || j.msg || CODE_TEXT[code] || '未知错误', raw: j };
}

/** 把任务列表拍平 */
function flattenTasks(j) {
    const d = (j && j.data) || {};
    let out = Array.isArray(d.taskList) ? d.taskList.slice() : [];
    for (const tag of d.tagList || []) {
        if (Array.isArray(tag.taskDTOList)) out = out.concat(tag.taskDTOList);
    }
    return out.filter(Boolean);
}

/** 单次拉任务列表 */
async function fetchTasks(sess) {
    const j = await api(sess, { url: `${API.taskList}?type=2` });
    if (isDead(j)) return { dead: true };
    if (!isOk(j)) return { fail: true, code: codeOf(j), raw: j };
    return { tasks: flattenTasks(j) };
}

/** 浏览落地页（App 里点「去看看」那一步，服务端会看有没有真的来过） */
async function browseTask(sess, url) {
    if (!/^https?:\/\//.test(String(url || ''))) return false;
    try {
        await request({
            url,
            method: 'GET',
            headers: {
                'User-Agent': UA,
                Accept: 'text/html,application/xhtml+xml,*/*',
                Referer: REFERER,
                Cookie: sess.cookie,
            },
            timeout: 15000,
        });
        return true;
    } catch (e) {
        return false;
    }
}

/** 报 IP 流水拿 orderId 上下文 */
async function taskIp(sess, orderId) {
    try {
        const j = await api(sess, {
            method: 'POST',
            url: API.taskIp,
            form: { mobile: sess.mobile || '', orderId },
            referer: 'https://m.client.10010.com/',
        });
        return isOk(j) ? (j.msg || '') : '';
    } catch (e) {
        return '';
    }
}

/** 完成一个任务 */
async function completeTask(sess, task) {
    const oid = orderIdOf();
    await taskIp(sess, oid);
    const url = `${API.completeTask}?taskId=${encodeURIComponent(task.id)}`
        + `&orderId=${encodeURIComponent(oid)}&systemCode=QDQD`;
    const j = await api(sess, { url });
    const code = codeOf(j);
    if (code === '0000') return { ok: true, raw: j };
    return { ok: false, code, desc: j.desc || j.msg || CODE_TEXT[code] || '未知错误', raw: j };
}

/** 领任务奖励 */
async function claimReward(sess, taskId, extra = {}) {
    const qs = Object.keys({ taskId, ...extra })
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent({ taskId, ...extra }[k])}`)
        .join('&');
    const j = await api(sess, { url: `${API.taskReward}?${qs}` });
    const outer = codeOf(j);
    const d = j.data || {};
    const inner = d.code !== undefined ? String(d.code) : outer;
    if (outer === '0000' && inner === '0000') {
        return {
            ok: true,
            prize: d.prizeName || '',
            reward: d.prizeNameRed || '',
            gain: numOf(d.prizeNameRed) ?? 0,
            desc: d.statusDesc || '领取成功',
            raw: j,
        };
    }
    return {
        ok: false,
        code: inner,
        desc: d.statusDesc || j.desc || j.msg || CODE_TEXT[inner] || '领取失败',
        raw: j,
    };
}

/**
 * 任务中心主循环。
 *   规则（实测得出）：
 *     taskState=1 & taskType=5 & url 是 http  → 浏览 + completeTask
 *     taskState=1 & taskType=8                → 跳第三方 App，做不了，跳过
 *     taskState=0                             → 可领奖（抽奖类领了会 0329，跳过即可）
 *     taskState=3                             → 已完成已领，不碰
 *   用 attempted 集合去重，避免 type=3 卡在 state=0 造成死循环。
 */
async function runTaskCenter(sess, ctx) {
    const res = { done: [], claimed: [], skipped: [], gain: 0, dead: false, fail: null };
    const attempted = new Set();
    const MAX_ROUND = 12;
    const onlyId = String(process.env[ENV_TASK_ID] || '').trim();

    for (let round = 0; round < MAX_ROUND; round++) {
        const f = await fetchTasks(sess);
        if (f.dead) { res.dead = true; return res; }
        if (f.fail) { res.fail = `${f.code} ${(f.raw && (f.raw.desc || f.raw.msg)) || ''}`.trim(); return res; }
        const tasks = f.tasks || [];

        // ① 先做能自动完成的浏览任务
        const todo = tasks.find((t) => {
            if (onlyId) {
                return String(t.id) === onlyId && !attempted.has(`do:${t.id}`);
            }
            const st = String(t.taskState);
            const ty = String(t.taskType);
            return st === '1' && ty === '5' && /^https?:\/\//.test(String(t.url || ''))
                && !attempted.has(`do:${t.id}`);
        });
        if (todo) {
            attempted.add(`do:${todo.id}`);
            console.log(`  │  📋 任务 [${todo.taskName}]`);
            const browsed = await browseTask(sess, todo.url);
            if (browsed) await sleep(rand(5000, 7000));
            const c = await completeTask(sess, todo);
            if (c.ok) {
                await sleep(rand(1200, 2200));
                const rw = await claimReward(sess, todo.id);
                if (rw.ok) {
                    res.done.push({ name: todo.taskName, reward: rw.reward, gain: rw.gain });
                    res.gain += rw.gain || 0;
                    console.log(`  │     ✅ ${rw.desc} ${rw.reward || ''}`.trimEnd());
                } else {
                    res.done.push({ name: todo.taskName, reward: '', gain: 0 });
                    console.log(`  │     ⚠️  已完成但领奖失败[${rw.code}] ${rw.desc}`);
                }
            } else {
                res.skipped.push({ name: todo.taskName, reason: `${c.code} ${c.desc}` });
                console.log(`  │     ⚠️  完成失败[${c.code}] ${c.desc}`);
            }
            await sleep(rand(1500, 2500));
            continue;
        }

        // ② 再领可领的奖。
        //    ★ 只有 taskType=5 的 state=0 才真是「做完待领」；
        //      taskType=3（抽奖）的 state 永远停在 0，领了必回 0329，别去碰。
        const claim = tasks.find((t) => {
            const st = String(t.taskState);
            const ty = String(t.taskType);
            return st === '0' && ty === '5' && !attempted.has(`claim:${t.id}`);
        });
        if (claim) {
            attempted.add(`claim:${claim.id}`);
            const rw = await claimReward(sess, claim.id);
            if (rw.ok) {
                res.claimed.push({ name: claim.taskName, reward: rw.reward, gain: rw.gain });
                res.gain += rw.gain || 0;
                console.log(`  │  🎁 领奖 [${claim.taskName}] ${rw.reward || rw.desc}`.trimEnd());
            } else {
                res.skipped.push({ name: claim.taskName, reason: `${rw.code} ${rw.desc}` });
                console.log(`  │     ⏭  跳过 [${claim.taskName}] ${rw.code} ${rw.desc}`);
            }
            await sleep(rand(1200, 2000));
            continue;
        }

        // ③ 没有新活了
        for (const t of tasks) {
            const st = String(t.taskState);
            const ty = String(t.taskType);
            if (st === '1' && ty === '8') {
                res.skipped.push({ name: t.taskName, reason: '需跳第三方 App' });
            } else if (st === '1' && ty !== '5') {
                res.skipped.push({ name: t.taskName, reason: `类型${ty}需手动` });
            }
        }
        break;
    }

    // 跳过的任务合并成一行，别刷屏
    const sk = res.skipped.filter((x) => /第三方|手动/.test(x.reason)).map((x) => x.name);
    if (sk.length) console.log(`  │  ⏭  需手动：${sk.join('、')}`);

    // 统计一下还有多少没处理
    const f2 = await fetchTasks(sess);
    if (!f2.dead && !f2.fail) {
        const left = (f2.tasks || []).filter((t) => String(t.taskState) === '1' && String(t.taskType) === '5');
        if (left.length) console.log(`  │  ℹ️  仍有 ${left.length} 个浏览任务未完成（可能今日已到上限）`);
    }
    return res;
}

/** 月签有礼 */
async function runMonthSign(sess) {
    const res = { claimed: [], gain: 0, dead: false, fail: null, total: 0, already: 0 };
    const j = await api(sess, { url: API.monthSign });
    if (isDead(j)) { res.dead = true; return res; }
    if (!isOk(j)) { res.fail = `${codeOf(j)} ${j.desc || j.msg || ''}`.trim(); return res; }

    const list = ((j.data || {}).taskList) || [];
    res.total = list.length;
    res.already = list.filter((t) => String(t.taskStatus) === '2').length;

    for (const t of list) {
        if (String(t.taskStatus) !== '1') continue;
        console.log(`  │  📅 月签 [${t.taskName}] 可领取`);
        // ★ 必须带 taskType=30 和 id
        const rw = await claimReward(sess, t.taskId, { taskType: '30', id: t.id });
        if (rw.ok) {
            res.claimed.push({ name: t.taskName, reward: rw.reward, gain: rw.gain });
            res.gain += rw.gain || 0;
            console.log(`  │     ✅ ${rw.reward || rw.desc}`);
        } else {
            console.log(`  │     ⚠️  领取失败[${rw.code}] ${rw.desc}`);
        }
        await sleep(rand(1000, 1800));
    }
    if (!res.claimed.length) {
        console.log(`  │  📅 月签无可领（已领 ${res.already}/${res.total}）`);
    }
    return res;
}

/** 悬浮任务（首页右下角那个浮动按钮，点一下记一次） */
async function runFloating(sess) {
    try {
        const j = await api(sess, { method: 'POST', url: API.floating, form: {} });
        if (!isOk(j)) return null;
        const d = j.data || {};
        if (!d.id) return null;
        const done = Number(d.currentCompleteNum || 0) >= Number(d.completeNum || 1);
        if (done) return { name: d.headlineName || '', skipped: true };
        const r = await api(sess, {
            method: 'POST',
            url: API.floatingDone,
            form: { id: d.id, userNumber: sess.mobile || '', systemCode: 'QDQD' },
        });
        return { name: d.headlineName || '', ok: isOk(r) };
    } catch (e) {
        return null;
    }
}

// ============================================================================
// 七、单账号流程
// ============================================================================

async function runAccount(acc, idx, total, cache) {
    const r = {
        index: idx,
        name: acc.name,
        mobile: acc.mobile || '',
        status: 'fail',        // ok / already / dead / fail
        msg: '',
        signGain: 0,
        taskGain: 0,
        monthGain: 0,
        streak: null,
        coupon: null,
        points: null,
        tasksDone: 0,
        tokenTail: '',
    };

    console.log('');
    console.log(`  ┌─ [${idx}/${total}] ${acc.name}  ${maskMobile(acc.mobile) || '(未带手机号)'}`);

    // token 来源优先级：环境变量给的 → 缓存里按手机号存的
    const cacheKey = acc.mobile ? 'm:' + acc.mobile : '';
    const cachedTok = (cacheKey && cache[cacheKey] && cache[cacheKey].token) || '';
    let token = acc.token || cachedTok || '';

    const sess = {
        token,
        cookie: token ? `ecs_token=${token}` : '',
        mobile: acc.mobile,
        deviceCode: (cache[cacheKey] && cache[cacheKey].deviceCode)
            || deriveDeviceCode(acc.mobile),
    };
    r.tokenTail = maskToken(sess.token);

    /** 统一出口：落缓存再返回 */
    const fin = () => {
        const rec = {
            mobile: sess.mobile,
            token: sess.token,
            deviceCode: sess.deviceCode,
            lastRun: Date.now(),
            lastStatus: r.status,
            coupon: r.coupon,
        };
        if (cacheKey) cache[cacheKey] = rec;
        if (sess.token) cache[sess.token] = rec;
        return r;
    };

    /** 拿 token：没有或已失效就自动登录 */
    const ensureToken = async () => {
        if (!acc.password) return !!sess.token;
        const fresh = autoLogin(acc.mobile, acc.password);
        if (!fresh) return false;
        sess.token = fresh;
        sess.cookie = `ecs_token=${fresh}`;
        r.tokenTail = maskToken(fresh);
        syncToQinglong(acc.mobile, fresh);
        return true;
    };

    // ── ① 身份自检 ─────────────────────────────────────────────────────
    let prof = null;
    if (sess.token) {
        try {
            prof = await queryProfile(sess);
        } catch (e) {
            r.status = 'fail';
            r.msg = `网络异常：${e.message}`;
            console.log(`  │  ❌ ${r.msg}`);
            console.log('  └─ 结束');
            return fin();
        }
    }

    // 没有 token，或 token 失效 → 密码登录
    if (!sess.token || (prof && prof.dead)) {
        if (!acc.password) {
            r.status = 'dead';
            r.msg = sess.token ? 'token 已失效' : '未提供 token';
            console.log(`  │  🔑 ${r.msg}`);
            console.log('  └─ 请在 unicom 变量里改用「手机号:登录密码」写法');
            return fin();
        }
        if (!(await ensureToken())) {
            r.status = 'dead';
            r.msg = '自动登录失败';
            console.log('  │  🔑 自动登录失败');
            console.log('  └─ 请检查密码是否正确，或稍后重试');
            return fin();
        }
        try {
            prof = await queryProfile(sess);
        } catch (e) {
            prof = null;
        }
        if (!prof || prof.dead) {
            r.status = 'dead';
            r.msg = '登录后 token 仍无效';
            console.log('  │  🔑 登录后 token 仍无效');
            console.log('  └─ 可能是风控拦截，稍后重试');
            return fin();
        }
    }

    console.log(`  │  🗝  token ${maskToken(sess.token)}  ${prof.isUnicom ? '联通在网 ✅' : '非联通号'}`);

    // ── ② 资产基线 ─────────────────────────────────────────────────────
    let before = null;
    try {
        before = await queryCoupon(sess);
        if (before) console.log(`  │  💰 话费红包余额 ${money(before.amount)} 元`);
    } catch (e) { /* 资产查不到不影响签到 */ }

    // ── ③ 签到状态 ─────────────────────────────────────────────────────
    let st;
    try {
        st = await querySignState(sess);
    } catch (e) {
        r.status = 'fail';
        r.msg = `查询签到状态失败：${e.message}`;
        console.log(`  │  ❌ ${r.msg}`);
        console.log('  └─ 结束');
        return fin();
    }
    if (st.dead) {
        r.status = 'dead';
        r.msg = 'token 中途失效';
        console.log(`  │  🔑 ${r.msg}`);
        console.log('  └─ 请稍后重试');
        return fin();
    }
    if (st.fail) {
        r.status = 'fail';
        r.msg = `查询签到状态失败：${codeOf(st.raw)} ${st.raw.desc || st.raw.msg || ''}`.trim();
        console.log(`  │  ❌ ${r.msg}`);
        console.log('  └─ 结束');
        return fin();
    }

    r.streak = st.streak;
    console.log(`  │  📅 连签 ${st.streak ?? '?'} 天   今日${st.signedToday ? '已签 ✅' : '未签 ⏳'}`);
    if (st.keepDays && st.keepDesc) {
        console.log(`  │  🎁 再连签 ${st.keepDays} 天可得 ${st.keepDesc}`);
    }
    if (st.todayPrize) {
        const tag = st.todayPrize.special ? '（连签大奖）' : '';
        const when = st.signedToday ? '本轮第' : '今天';
        // prizeName 是 "0.01" 这种，prizeCount 是分
        const val = st.todayPrize.prizeName
            || (st.todayPrize.prize ? money(st.todayPrize.prize / 100) : '?');
        console.log(`  │  📌 ${when} ${st.todayPrize.day} 天：${val} 元${tag}`);
    }

    // ── ④ 探针模式 ─────────────────────────────────────────────────────
    if (flag(ENV_PROBE)) {
        r.status = st.signedToday ? 'already' : 'ok';
        r.msg = st.signedToday ? '已签到（探针模式，未发请求）' : '未签到（探针模式）';
        console.log(`  │  🔍 ${r.msg}`);
        if (flag(ENV_POINTS, true)) {
            r.points = await queryPoints(sess);
            if (r.points !== null) console.log(`  │  🪙 可用积分 ${r.points}`);
        }
        r.coupon = before ? before.amount : null;
        console.log('  └─ 完成');
        return fin();
    }

    // ── ⑤ 签到 ─────────────────────────────────────────────────────────
    if (st.signedToday && !flag(ENV_FORCE)) {
        r.status = 'already';
        r.msg = '今天已签到';
        console.log('  │  🙋 今天已签到，跳过签到请求');
    } else {
        try {
            const sg = await doSign(sess);
            if (sg.ok) {
                r.signGain = sg.gain || 0;
                r.status = 'ok';
                console.log(`  │  ✅ ${sg.desc} ${sg.reward || ''}`.trimEnd());
            } else if (sg.already) {
                r.status = 'already';
                console.log(`  │  🙋 ${sg.desc}`);
            } else {
                console.log(`  │  ⚠️  签到失败[${sg.code}] ${sg.desc}`);
                r.msg = `签到失败：${sg.code} ${sg.desc}`;
            }
        } catch (e) {
            console.log(`  │  ❌ 签到异常：${e.message}`);
            r.msg = `签到异常：${e.message}`;
        }
        await sleep(rand(1500, 2500));
    }

    // ── ⑥ 任务中心 ─────────────────────────────────────────────────────
    if (flag(ENV_TASKS, true)) {
        console.log('  │  🧩 任务中心…');
        try {
            const tk = await runTaskCenter(sess, r);
            if (tk.dead) {
                r.status = 'dead';
                r.msg = '任务中心返回 0001，token 失效';
                console.log(`  │  🔑 ${r.msg}`);
                console.log('  └─ 需重新抓包换 unicom_ck');
                return fin();
            }
            r.taskGain = tk.gain;
            r.tasksDone = tk.done.length + tk.claimed.length;
            if (tk.fail) console.log(`  │  ⚠️  任务中心异常：${tk.fail}`);
            if (!tk.done.length && !tk.claimed.length) {
                console.log('  │  ℹ️  没有可做/可领的任务');
            } else {
                console.log(`  │  🧩 任务完成 ${tk.done.length} 个、领奖 ${tk.claimed.length} 个，+${money(tk.gain)} 元`);
            }
        } catch (e) {
            console.log(`  │  ❌ 任务中心异常：${e.message}`);
        }
    }

    // ── ⑦ 月签有礼 ─────────────────────────────────────────────────────
    if (flag(ENV_MONTH, true)) {
        try {
            const ms = await runMonthSign(sess);
            if (ms.dead) {
                r.status = 'dead';
                r.msg = '月签接口返回 0001，token 失效';
                console.log(`  │  🔑 ${r.msg}`);
                console.log('  └─ 需重新抓包换 unicom_ck');
                return fin();
            }
            r.monthGain = ms.gain;
            if (ms.fail) console.log(`  │  ⚠️  月签查询失败：${ms.fail}`);
        } catch (e) {
            console.log(`  │  ❌ 月签异常：${e.message}`);
        }
    }

    // ── ⑧ 悬浮任务（顺手） ─────────────────────────────────────────────
    try {
        const fl = await runFloating(sess);
        if (fl && !fl.skipped) {
            console.log(`  │  🎈 悬浮任务 [${fl.name}] ${fl.ok ? '已记录' : '未完成'}`);
        }
    } catch (e) { /* 忽略 */ }

    // ── ⑨ 结算 ─────────────────────────────────────────────────────────
    await sleep(rand(800, 1500));
    let after = null;
    try {
        after = await queryCoupon(sess);
    } catch (e) { /* 忽略 */ }

    if (after) {
        r.coupon = after.amount;
        const delta = before ? after.amount - before.amount : null;
        if (delta !== null) {
            console.log(`  │  💰 话费红包 ${money(before.amount)} → ${money(after.amount)}`
                + `（本次 +${money(delta)}）`);
        } else {
            console.log(`  │  💰 话费红包余额 ${money(after.amount)} 元`);
        }
        if (after.expiring && after.expiring > 0) {
            console.log(`  │  ⏰ ${money(after.expiring)} 元将于 ${after.month} 月底到期`);
        }
    }

    if (flag(ENV_POINTS, true)) {
        r.points = await queryPoints(sess);
        if (r.points !== null) console.log(`  │  🪙 可用积分 ${r.points}`);
    }

    const totalGain = r.signGain + r.taskGain + r.monthGain;
    if (r.status === 'fail' && !r.msg) r.status = 'ok';
    if (r.status !== 'dead' && r.status !== 'already') r.status = 'ok';
    console.log(`  └─ 本次共 +${money(totalGain)} 元话费红包`);
    return fin();
}

// ============================================================================
// 八、推送（sendNotify.js 优先，内置兜底）
// ============================================================================

/**
 * 乘风破浪2026（联通云盘活动）
 * 复用主脚本已经拿到的 ecs_token → 走云盘「二级缓存登录」(ecs_token→ticket→userToken, 2 次请求)
 * 实际任务交给 unicom_cmf.py 包装器调度（原脚本 lt_cmf2026.py 不改动，便于升级）
 */
function findCmfSrc() {
    const cands = [
        process.env[ENV_CMF_SRC],
        path.join(__dirname, 'lt_cmf2026.py'),
        path.join(__dirname, '..', '..', 'lt_cmf2026.py'),
        '/ql/data/scripts/lt_cmf2026.py',
        '/ql/scripts/lt_cmf2026.py',
    ].filter(Boolean);
    for (const p of cands) {
        try { if (fs.existsSync(p)) return p; } catch (e) { /* ignore */ }
    }
    return '';
}

function runCmfActivity(results, cache) {
    if (!flag(ENV_CMF, true)) return null;
    if (flag(ENV_PROBE)) return null;   // 探针模式不跑活动

    const src = findCmfSrc();
    if (!src || !CMF_WRAPPER()) {
        console.log('');
        console.log('  🧊 乘风破浪2026：缺少 ' + (src ? 'unicom_cmf.py' : 'lt_cmf2026.py') + '，跳过');
        return null;
    }

    // 收集本轮拿到 token 的账号
    const list = [];
    for (const r of results) {
        if (!r.mobile) continue;
        const rec = cache['m:' + r.mobile];
        const tok = (rec && rec.token) || '';
        if (tok && tok.length > 100) list.push({ mobile: r.mobile, token: tok, index: r.index });
    }
    if (!list.length) return null;

    // 把自己的 token 写成 lt_cmf2026 认的缓存格式（键=手机号，ts_cloud 走 12h TTL）
    const nowMs = Date.now();
    let tc = {};
    try {
        if (fs.existsSync(CMF_TOKEN_CACHE)) {
            tc = JSON.parse(fs.readFileSync(CMF_TOKEN_CACHE, 'utf8').replace(/^\uFEFF/, '')) || {};
        }
    } catch (e) { tc = {}; }
    for (const it of list) {
        const prev = (tc[it.mobile] && typeof tc[it.mobile] === 'object') ? tc[it.mobile] : {};
        tc[it.mobile] = Object.assign({}, prev, {
            phone: it.mobile,
            ecs_token: it.token,
            ts_cloud: nowMs,
            cloud_time: new Date(nowMs).toISOString().slice(0, 19).replace('T', ' '),
        });
    }
    try {
        fs.writeFileSync(CMF_TOKEN_CACHE, JSON.stringify(tc, null, 2), 'utf8');
    } catch (e) { /* 只读目录就算了 */ }

    console.log('');
    console.log('  ┌─ 🧊 乘风破浪2026（联通云盘）');
    console.log(`  │  ${list.length} 个账号参与`);

    const { spawnSync } = require('child_process');
    const py = process.env[ENV_PYPATH] || 'python';
    const args = ['-X', 'utf8', CMF_WRAPPER(),
        '--phones', list.map((x) => x.mobile).join(','),
        '--src', src,
        '--cache', CMF_TOKEN_CACHE];
    if (flag(ENV_CMF_TEST)) args.push('--test');

    const env = Object.assign({}, process.env, { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' });
    // 让原脚本的推送闭嘴，统一走我们的推送
    delete env.PUSH_PLUS_TOKEN;
    delete env.PUSH_PLUS_TOPIC;

    let out = null;
    try {
        const r = spawnSync(py, args, {
            cwd: path.dirname(CMF_WRAPPER()), env, timeout: 20 * 60 * 1000,
            maxBuffer: 32 * 1024 * 1024, encoding: 'utf8',
        });
        const errTxt = String(r.stderr || '');
        // 过程日志只挑关键行，避免刷屏
        const keep = /(选角|打卡|抽奖|中奖|视频|挂机值|第一关|异常|失败|❌|⚠️|✅)/;
        for (const ln of errTxt.split(/[\r\n]+/)) {
            if (!ln.trim()) continue;
            if (!keep.test(ln)) continue;
            // 去掉时间戳和「账号[n]」前缀，活动日志自己带上下文
            console.log('  │  ' + ln
                .replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '')
                .replace(/^账号\[\d+\]\s*/, ''));
        }
        for (const ln of String(r.stdout || '').split(/[\r\n]+/)) {
            if (ln.startsWith('%%CMF_JSON%%')) {
                out = JSON.parse(ln.slice('%%CMF_JSON%%'.length));
                break;
            }
        }
        if (!out) {
            const tail = String(r.stdout || '').slice(-300) || errTxt.slice(-300);
            console.log('  │  ⚠️ 活动未返回结果' + (tail ? `：${tail.replace(/\s+/g, ' ')}` : ''));
        }
    } catch (e) {
        console.log(`  │  ⚠️ 活动执行异常：${e.message}`);
    }

    if (!out || !out.ok) {
        console.log(`  └─ ⚠️ 未完成${out && out.error ? '：' + String(out.error).slice(0, 80) : ''}`);
        return { ok: false, accounts: [], error: (out && out.error) || '无返回' };
    }

    // 打印结果
    const accs = out.accounts || [];
    const endedCnt = accs.filter((a) => a.ended).length;
    if (endedCnt === accs.length) {
        console.log('  └─ ⏹  活动已结束（全部账号跳过）');
        return out;
    }
    for (const a of accs) {
        if (a.ended) {
            console.log(`  │  [${a.index}] ${a.phone}  ⏹ 活动已结束`);
            continue;
        }
        const tag = a.login ? (a.checkin || '已参与') : '登录失败';
        console.log(`  │  [${a.index}] ${a.phone}  ${tag}`);
        const line2 = [];
        if (a.hangValue) line2.push(`挂机值 ${a.hangValue}`);
        if (a.hangRank) line2.push(`排名 ${a.hangRank}`);
        if (a.hangRegion) line2.push(a.hangRegion);
        if (line2.length) console.log('  │      ' + line2.join(' · '));
        const wins = (a.prizes || []).filter((x) => x.name && x.name !== '谢谢参与');
        if (wins.length) {
            console.log('  │      🎁 ' + wins.map((x) => x.name + (x.code ? `(码:${x.code})` : '')).join('、'));
        }
        if (a.error) console.log(`  │      ⚠️ ${a.error}`);
    }
    const okCnt = accs.filter((a) => a.login).length;
    const tail = endedCnt ? `${okCnt}/${accs.length} 账号完成 · ${endedCnt} 已结束`
        : `${okCnt}/${accs.length} 账号完成`;
    console.log(`  └─ ${tail}`);
    return out;
}

/**
 * 全部扩展任务 —— 调 unicom_tasks.py 包装器跑 chinaUnicom.py 的 10 个模块
 * 包装器复用我们已拿到的 ecs_token（跳过它的 onLine 登录链）
 */
function findAllSrc() {
    const cands = [
        process.env[ENV_ALL_SRC],
        path.join(__dirname, 'chinaUnicom.py'),
        path.join(__dirname, '..', '主脚本', 'chinaUnicom.py'),
        '/ql/data/scripts/chinaUnicom.py',
        '/ql/scripts/chinaUnicom.py',
    ].filter(Boolean);
    for (const p of cands) {
        try { if (fs.existsSync(p)) return p; } catch (e) { /* ignore */ }
    }
    return '';
}

function findAllWrapper() {
    return resolveFile('unicom_tasks.py');
}

function runAllTasks(results, cache) {
    if (!flag(ENV_ALL, true)) return null;
    if (flag(ENV_PROBE)) return null;   // 探针模式不跑任务

    const src = findAllSrc();
    const wrapper = findAllWrapper();
    if (!src || !wrapper) {
        console.log('');
        console.log('  🧩 扩展任务：缺少 ' + (!src ? 'chinaUnicom.py' : 'unicom_tasks.py') + '，跳过');
        return null;
    }

    const list = [];
    for (const r of results) {
        if (!r.mobile) continue;
        const rec = cache['m:' + r.mobile];
        const tok = (rec && rec.token) || '';
        if (tok && tok.length > 100) list.push(r.mobile);
    }
    if (!list.length) return null;

    console.log('');
    console.log('  ┌─ 🧩 扩展任务（联通祝福 / 天天领现金 / 权益超市 / 爱听 / 安全管家 …）');
    console.log(`  │  ${list.length} 个账号参与`);

    const { spawnSync } = require('child_process');
    const py = process.env[ENV_PYPATH] || 'python';
    const args = ['-X', 'utf8', wrapper,
        '--phones', list.join(','),
        '--cache', CK_CACHE,
        '--src', src];
    const skip = String(process.env[ENV_ALL_SKIP] || '').trim();
    if (skip) args.push('--skip', skip);

    const env = Object.assign({}, process.env, { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' });
    delete env.PUSH_PLUS_TOKEN;
    delete env.PUSH_PLUS_TOPIC;
    // 阅读开关：JS 侧叫 unicom_woread，Python 侧读 UNICOM_CU_WOREAD
    env.UNICOM_CU_WOREAD = flag(ENV_WOREAD, true) ? 'on' : 'off';

    let out = null;
    try {
        const r = spawnSync(py, args, {
            cwd: path.dirname(wrapper), env, timeout: 40 * 60 * 1000,
            maxBuffer: 64 * 1024 * 1024, encoding: 'utf8',
        });
        const errTxt = String(r.stderr || '');
        // 只挑有价值的行，避免刷屏
        const keep = /(====|✅|❌|⚠️|🎁|💰|抽奖|中奖|打卡|积分|红包|立减金|失败|异常)/;
        const drop = /(重试 \(|正在|获取ticket成功|识别到纯手机号)/;
        let shown = 0;
        for (const ln of errTxt.split(/[\r\n]+/)) {
            if (!ln.trim() || !keep.test(ln) || drop.test(ln)) continue;
            console.log('  │  ' + ln
                .replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '')
                .replace(/^账号\[\d+\]\s*/, ''));
            shown += 1;
        }
        if (!shown) console.log('  │  （无关键日志）');

        for (const ln of String(r.stdout || '').split(/[\r\n]+/)) {
            if (ln.startsWith('%%CU_JSON%%')) {
                out = JSON.parse(ln.slice('%%CU_JSON%%'.length));
                break;
            }
        }
        if (!out) {
            const tail = String(r.stdout || '').slice(-300) || errTxt.slice(-300);
            console.log('  │  ⚠️ 扩展任务未返回结果' + (tail ? `：${tail.replace(/\s+/g, ' ')}` : ''));
        }
    } catch (e) {
        console.log(`  │  ⚠️ 扩展任务执行异常：${e.message}`);
    }

    if (!out || !out.ok) {
        console.log(`  └─ ⚠️ 未完成${out && out.error ? '：' + String(out.error).slice(0, 80) : ''}`);
        return { ok: false, accounts: [], error: (out && out.error) || '无返回' };
    }

    const accs = out.accounts || [];
    for (const a of accs) {
        console.log(`  │  [${a.index}] ${a.phone}  ${a.login ? '完成' : '未登录'}  ${a.seconds}s`);
        for (const ln of (a.logs || [])) console.log('  │      ' + ln);
        if (a.error) console.log(`  │      ⚠️ ${a.error}`);
    }
    const okCnt = accs.filter((a) => a.login).length;
    console.log(`  └─ ${okCnt}/${accs.length} 账号完成`);
    return out;
}

// ────────────────────────────────────────────────────────────────────────────
// 推送排版
//   unicom_push_style = simple（默认）→ 一个账号一行，扩展任务压成一行
//   unicom_push_style = full          → 旧版逐条明细（排查时用）
// ────────────────────────────────────────────────────────────────────────────

/** 按显示宽度截断（中文算 2 格），超长补 … */
function ellip(s, n) {
    const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    if (strWidth(t) <= n) return t;
    let out = '';
    let w = 0;
    for (const ch of t) {
        const cw = strWidth(ch);
        if (w + cw > n - 2) break;
        out += ch;
        w += cw;
    }
    return out.replace(/[\s·,，、:：+\-]+$/g, '') + '…';
}

/** 子脚本日志洗成短标签：去时间戳 / 账号前缀 / 状态符号 / 尾部括号细节 */
function cleanLog(s) {
    return String(s || '')
        .replace(/\u001b\[[0-9;]*m/g, '')
        .replace(/^\[?\d{2}:\d{2}:\d{2}\]?\s*/, '')
        .replace(/^账号\[\d+\]\s*/, '')
        .replace(/^[✅❌⚠️🎁💰🔑🧩🧊📌🔔·\-\s]+/, '')
        .replace(/[（(][^）)]*[）)]\s*$/, '')
        .replace(/^(成功|完成)[:：]?\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** 推送里没信息量的行（注入 token / 余额播报 / 进度播报） */
const LOG_NOISE = /(跳过 onLine|已注入 ecs_token|套餐详情|^\s*-\s|当前余额|实时话费|积分概览|运行后|今日已赚|[查询模式])/;

const PUSH_BADGE = { ok: '✅', already: '💤', dead: '🔑', fail: '❌' };
const NUM_CIRCLE = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

const pad2 = (n) => String(n).padStart(2, '0');
const stampOf = (d) => `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

// ── 扩展任务日志 → 「来源 结果」短标签 ──────────────────────────────────
/** 只留有信息量的行：中奖 / 领取 / 收益 */
const LOG_KEEP = /(中奖|抽奖结果|获得|领取|抢兑|成功|立减金|话费券|元|积分)/;

/** '联通祝福: [沃祝福]抽奖: 5元话费券[恭喜中奖]' → '联通祝福 5元话费券' */
function pairOf(line) {
    let t = cleanLog(line);
    if (!t || LOG_NOISE.test(t) || !LOG_KEEP.test(t)) return '';
    t = t.replace(/本次运行增加\s*/g, '+').replace(/\s*\+\s*/g, ' +');
    const segs = t.split(/[:：]/).map((x) => x.trim()).filter(Boolean);
    let src = '';
    let res = t;
    if (segs.length > 1) {
        src = segs[0];
        res = segs[segs.length - 1];
    }
    src = src.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    res = res.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    // 来源去模块前缀：'签到区-话费红包' → '话费红包'
    if (src.includes('-')) src = src.split('-').pop().trim();
    // 结果只有裸数字时补单位
    if (/^\d+(\.\d+)?$/.test(res)) res += /积分/.test(t) ? '积分' : (/元/.test(t) ? '元' : '');
    if (src === res) res = '';
    const out = [ellip(src, 14), ellip(res, 15)].filter(Boolean).join(' ');
    return out.length > 1 ? out : '';
}

// ── 扩展任务 / 云盘：各压成「小标题 + 每账号一行」──────────────────────
function compactAllBlock(all) {
    if (!all || !all.ok || !(all.accounts || []).length) return [];
    const accs = all.accounts;
    const okCnt = accs.filter((a) => a.login).length;
    const rows = [];
    for (const a of accs) {
        const pairs = [];
        for (const ln of (a.logs || [])) {
            const x = pairOf(ln);
            if (x && !pairs.includes(x)) pairs.push(x);
            if (pairs.length >= 2) break;
        }
        const who = a.phone || `#${a.index}`;
        const body = pairs.length ? pairs.join(' · ') : (a.login ? '完成' : '🔑未登录');
        rows.push(`   ${who} · ${body}`);
    }
    if (!rows.length) return [];
    return [`🧩 扩展任务 ${okCnt}/${accs.length}`, ...rows];
}

function compactCmfBlock(cmf) {
    if (!cmf || !cmf.ok || !(cmf.accounts || []).length) return [];
    const accs = (cmf.accounts || []).filter((a) => !a.ended);
    if (!accs.length) return [];
    const okCnt = accs.filter((a) => a.login).length;
    const rows = accs.map((a) => {
        if (!a.login) return `   ${a.phone} · 🔑未登录`;
        const bits = [];
        if (a.hangValue) bits.push(`挂机${a.hangValue}`);
        if (a.hangRank) bits.push(`排名${a.hangRank}`);
        const wins = (a.prizes || [])
            .filter((x) => x && x.name && x.name !== '谢谢参与')
            .map((x) => x.name);
        if (wins.length) bits.push('🎁' + ellip(wins.join('/'), 14));
        return `   ${a.phone} · ${bits.join(' · ') || '完成'}`;
    });
    return [`🧊 云盘 ${okCnt}/${accs.length}`, ...rows];
}

// ── 旧版明细（unicom_push_style=full 时使用，逻辑未改）──────────────────
function buildCmfPushLines(cmf) {
    if (!cmf || !cmf.ok || !(cmf.accounts || []).length) return [];
    const accs = cmf.accounts;
    const endedCnt = accs.filter((a) => a.ended).length;
    if (endedCnt === accs.length) return [];
    const L = [];
    L.push('');
    L.push('🧊 乘风破浪2026（云盘）');
    for (const a of accs) {
        if (a.ended) continue;
        const stat = a.login ? '参与成功' : '登录失败';
        L.push(`  ${a.phone}  ${stat}`);
        const sub = [];
        if (a.checkin) sub.push(a.checkin);
        if (a.hangValue) sub.push(`挂机值 ${a.hangValue}`);
        if (a.hangRank) sub.push(`排名 ${a.hangRank}`);
        if (sub.length) L.push('    ' + sub.join(' · '));
        if (a.hangRegion) L.push('    ' + a.hangRegion);
        const wins = (a.prizes || []).filter((x) => x.name && x.name !== '谢谢参与');
        if (wins.length) {
            L.push('    🎁 ' + wins.map((x) => x.name + (x.code ? `(码:${x.code})` : '')).join('、'));
        }
        if (a.error) L.push(`    ⚠️ ${a.error}`);
    }
    const okCnt = accs.filter((a) => a.login).length;
    L.push(`  完成 ${okCnt}/${accs.length} 个账号`);
    return L;
}

function buildAllPushLines(all) {
    if (!all || !all.ok || !(all.accounts || []).length) return [];
    const L = [];
    L.push('');
    L.push('🧩 扩展任务');
    for (const a of all.accounts) {
        L.push(`  ${a.phone}  ${a.login ? '完成' : '未登录'}  ${a.seconds}s`);
        for (const ln of (a.logs || [])) L.push('    ' + ln);
        if (a.error) L.push(`    ⚠️ ${a.error}`);
    }
    const okCnt = all.accounts.filter((a) => a.login).length;
    L.push(`  完成 ${okCnt}/${all.accounts.length} 个账号`);
    return L;
}

function buildPushTextFull(results, cmf, all) {
    const ok = results.filter((r) => r.status === 'ok').length;
    const already = results.filter((r) => r.status === 'already').length;
    const dead = results.filter((r) => r.status === 'dead').length;
    const fail = results.filter((r) => r.status === 'fail').length;
    const normal = ok + already;
    const totalGain = results.reduce(
        (s, r) => s + (r.signGain || 0) + (r.taskGain || 0) + (r.monthGain || 0), 0);
    const totalTasks = results.reduce((s, r) => s + (r.tasksDone || 0), 0);
    const stamp = stampOf(new Date());

    const L = [];
    const sep = '────────────────────';
    L.push(stamp);
    L.push(sep);

    results.forEach((r, i) => {
        const stat = { ok: '签到成功', already: '今日已签', dead: '登录失败', fail: '执行异常' }[r.status] || '未知';
        const gain = (r.signGain || 0) + (r.taskGain || 0) + (r.monthGain || 0);
        L.push(`【${i + 1}】${maskMobile(r.mobile) || r.name}  ${stat}`);
        const sub = [];
        if (r.streak != null) sub.push(`连签 ${r.streak} 天`);
        if (r.tasksDone) sub.push(`任务 ${r.tasksDone} 个`);
        if (gain > 0) sub.push(`收益 +${money(gain)} 元`);
        if (sub.length) L.push('    ' + sub.join(' · '));
        const sub2 = [];
        if (r.coupon != null) sub2.push(`红包 ${money(r.coupon)} 元`);
        if (r.points != null) sub2.push(`积分 ${r.points}`);
        if (sub2.length) L.push('    ' + sub2.join(' · '));
        if (r.msg && r.status !== 'ok' && r.status !== 'already') L.push(`    原因：${r.msg}`);
        if (i < results.length - 1) L.push('');
    });

    L.push(sep);
    const tail = [`合计 +${money(totalGain)} 元`];
    if (totalTasks) tail.push(`任务 ${totalTasks} 个`);
    tail.push(`正常 ${normal}/${results.length}`);
    if (dead) tail.push(`失效 ${dead}`);
    if (fail) tail.push(`异常 ${fail}`);
    L.push(tail.join(' · '));

    for (const ln of buildAllPushLines(all)) L.push(ln);
    for (const ln of buildCmfPushLines(cmf)) L.push(ln);

    return {
        title: `中国联通 ${normal}/${results.length} 正常 · +${money(totalGain)}元`,
        text: L.join('\n'),
    };
}

// ── 主入口：默认走紧凑版 ────────────────────────────────────────────────
function buildPushText(results, cmf, all, secs) {
    const style = String(process.env[ENV_PUSH_STYLE] || 'simple').trim().toLowerCase();
    if (style === 'full' || style === 'verbose') return buildPushTextFull(results, cmf, all);

    const cnt = { ok: 0, already: 0, dead: 0, fail: 0 };
    for (const r of results) if (cnt[r.status] !== undefined) cnt[r.status] += 1;
    const normal = cnt.ok + cnt.already;
    const totalGain = results.reduce(
        (s, r) => s + (r.signGain || 0) + (r.taskGain || 0) + (r.monthGain || 0), 0);
    const totalTasks = results.reduce((s, r) => s + (r.tasksDone || 0), 0);

    const L = [];
    L.push(`🛰 中国联通签到 · ${stampOf(new Date())}`);
    L.push(`✅${cnt.ok} 成功 · 💤${cnt.already} 已签 · 🔑${cnt.dead} 失效 · ❌${cnt.fail} 异常`);
    const acct = [`💰 +${money(totalGain)} 元`];
    if (totalTasks) acct.push(`任务 ${totalTasks} 个`);
    acct.push(`正常 ${normal}/${results.length}`);
    if (secs) acct.push(`耗时 ${Math.round(secs)}s`);
    L.push(acct.join(' · '));

    const rows = [];
    results.forEach((r, i) => {
        const num = NUM_CIRCLE[i] || `${i + 1}.`;
        const who = maskMobile(r.mobile) || r.name || `账号${i + 1}`;
        const bits = [];
        if (r.status === 'ok' || r.status === 'already') {
            if (r.streak != null) bits.push(`连签${r.streak}天`);
            if (r.tasksDone) bits.push(`任务${r.tasksDone}`);
            const g = (r.signGain || 0) + (r.taskGain || 0) + (r.monthGain || 0);
            if (g > 0) bits.push(`+${money(g)}元`);
            if (r.coupon != null) bits.push(`红包${money(r.coupon)}`);
            if (r.points != null) bits.push(`积分${r.points}`);
        } else {
            bits.push(ellip(r.msg || '未知原因', 28));
        }
        rows.push(`${num} ${who} ${PUSH_BADGE[r.status] || '·'} ${bits.join(' · ')}`.trim());
    });
    if (rows.length) {
        L.push('');
        for (const ln of rows) L.push(ln);
    }

    const extra = [...compactAllBlock(all), ...compactCmfBlock(cmf)];
    if (extra.length) {
        L.push('');
        for (const ln of extra) L.push(ln);
    }

    const warn = cnt.dead + cnt.fail > 0 ? (normal === 0 ? ' · ❌需处理' : ' · ⚠️') : '';
    return {
        title: `联通签到 ${normal}/${results.length} · +${money(totalGain)}元${warn}`,
        text: L.join('\n'),
    };
}

function httpCall(url, method = 'GET', body = null, headers = {}, timeout = 20000) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const lib = u.protocol === 'https:' ? https : http;
        const h = { ...headers };
        let buf = null;
        if (body !== null && body !== undefined) {
            buf = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8');
            h['Content-Type'] = h['Content-Type'] || 'application/json';
            h['Content-Length'] = buf.length;
        }
        const req = lib.request(
            {
                protocol: u.protocol,
                hostname: u.hostname,
                port: u.port || (u.protocol === 'https:' ? 443 : 80),
                path: u.pathname + u.search,
                method,
                headers: h,
                timeout,
            },
            (res) => {
                const cs = [];
                res.on('data', (c) => cs.push(c));
                res.on('end', () => {
                    let b = Buffer.concat(cs);
                    const enc = String(res.headers['content-encoding'] || '').toLowerCase();
                    try {
                        if (enc.includes('gzip')) b = zlib.gunzipSync(b);
                        else if (enc.includes('deflate')) b = zlib.inflateSync(b);
                    } catch (e) { /* 忽略 */ }
                    resolve({ status: res.statusCode, text: b.toString('utf8') });
                });
            }
        );
        req.on('timeout', () => req.destroy(new Error('超时')));
        req.on('error', reject);
        if (buf) req.write(buf);
        req.end();
    });
}

async function push(results, cmf, all, secs) {
    const enabled = !/^(0|off|false|no|n)$/i.test(String(process.env[ENV_PUSH] || 'on').trim());
    const master = !/^(0|off|false|no|n)$/i.test(String(process.env[ENV_TY_PUSH] || 'on').trim());
    if (!enabled || !master) return;
    if (!results.length) return;

    const { title, text } = buildPushText(results, cmf, all, secs);

    // ① 优先用青龙自带的 sendNotify.js
    const notifyPaths = [
        path.join(__dirname, 'sendNotify.js'),
        '/ql/data/scripts/sendNotify.js',
        '/ql/scripts/sendNotify.js',
        path.join(process.cwd(), 'sendNotify.js'),
    ].filter(Boolean);

    for (const p of notifyPaths) {
        try {
            if (!fs.existsSync(p)) continue;
            const mod = require(p);
            const fn = mod && (mod.sendNotify || mod.default || mod);
            if (typeof fn === 'function') {
                await fn(title, text);
                return;
            }
        } catch (e) {
            if (DEBUG) console.log(`      sendNotify(${p}) 失败：${e.message}`);
        }
    }

    // ② 兜底：企业微信应用（QYWX_AM）
    const qywx = String(process.env.QYWX_AM || '').trim();
    if (qywx) {
        const [corpId, secret, agentId, ...tos] = qywx.split(',');
        try {
            const tk = await httpCall(
                `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpId)}`
                + `&corpsecret=${encodeURIComponent(secret)}`
            );
            const tj = parseJson(tk.text) || {};
            if (tj.access_token) {
                await httpCall(
                    `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${tj.access_token}`,
                    'POST',
                    {
                        touser: tos.length ? tos.join('|') : '@all',
                        msgtype: 'text',
                        agentid: agentId,
                        text: { content: `${title}\n\n${text}` },
                    }
                );
                return;
            }
        } catch (e) {
            if (DEBUG) console.log(`      QYWX 推送失败：${e.message}`);
        }
    }

    // ③ 都没有就打到控制台
    console.log('');
    console.log('  📮 未配置推送渠道，推送内容如下：');
    console.log(`     ${title}`);
    for (const ln of text.split('\n')) console.log(`     ${ln}`);
}

// ============================================================================
// 九、主流程
// ============================================================================

async function main() {
    const t0 = Date.now();

    console.log('');
    console.log('  ' + line(58));
    console.log('   中国联通 · 每日签到 + 任务中心   v1.2');
    console.log('  ' + line(58));

    const raw = String(
        process.env[ENV_MAIN] || process.env[ENV_MAIN_ALT]
        || process.env[ENV_CK] || process.env.UNICOM_CK || ''
    ).trim();
    if (!raw) {
        console.log('');
        console.log('  ❌ 没有配置变量 unicom');
        console.log('');
        console.log('  只需填一行：手机号:登录密码');
        console.log('');
        console.log('      unicom = 18500000000:你的登录密码');
        console.log('');
        console.log('  多账号换行：');
        console.log('      18500000000:密码1');
        console.log('      18600000000:密码2');
        console.log('');
        process.exit(1);
    }

    const accounts = parseAccounts(raw);
    if (!accounts.length) {
        console.log('  ❌ unicom 解析不出账号，格式应为「手机号:登录密码」');
        process.exit(1);
    }

    const cache = readCache();
    console.log(`  共 ${accounts.length} 个账号`);
    if (flag(ENV_PROBE)) console.log('  🔍 探针模式：只查状态，不签到不做任务');

    const results = [];
    for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];
        try {
            results.push(await runAccount(acc, i + 1, accounts.length, cache));
        } catch (e) {
            console.log(`  │  ❌ 未捕获异常：${e && e.stack ? e.stack : e}`);
            results.push({
                index: i + 1, name: acc.name, mobile: acc.mobile,
                status: 'fail', msg: `异常：${e.message}`, signGain: 0, taskGain: 0, monthGain: 0,
            });
        }
        writeCache(cache);
        if (i < accounts.length - 1) {
            const [a, b] = String(process.env[ENV_DELAY] || '5-15').split('-').map((x) => Number(x));
            const lo = Number.isFinite(a) ? a : 5;
            const hi = Number.isFinite(b) ? b : lo + 10;
            const wait = rand(lo, hi);
            console.log(`\n  ⏳ 等待 ${wait.toFixed(1)}s 再跑下一个账号…`);
            await sleep(wait * 1000);
        }
    }

    // ── 扩展任务：所有账号签到完后统一跑一次 ────────────────────────────
    let all = null;
    try {
        all = runAllTasks(results, cache);
    } catch (e) {
        console.log(`  🧩 扩展任务异常：${e.message}`);
    }
    writeCache(cache);

    // ── 乘风破浪2026（云盘活动）：所有账号签到完后统一跑一次 ────────────
    let cmf = null;
    try {
        cmf = runCmfActivity(results, cache);
    } catch (e) {
        console.log(`  🧊 乘风破浪2026 异常：${e.message}`);
    }
    writeCache(cache);

    // ── 汇总 ────────────────────────────────────────────────────────────
    const ok = results.filter((r) => r.status === 'ok').length;
    const already = results.filter((r) => r.status === 'already').length;
    const dead = results.filter((r) => r.status === 'dead').length;
    const fail = results.filter((r) => r.status === 'fail').length;
    const totalGain = results.reduce((s, r) => s + (r.signGain || 0) + (r.taskGain || 0) + (r.monthGain || 0), 0);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);

    console.log('');
    console.log('  ' + line(58));
    console.log(`   ✅${ok} 成功 · 💤${already} 已签 · 🔑${dead} 失效 · ❌${fail} 异常   正常 ${ok + already}/${results.length}`);
    console.log(`   💰 +${money(totalGain)} 元话费红包 · 耗时 ${secs}s`);
    console.log('  ' + line(58));

    if (dead) {
        console.log('');
        console.log('   🔑 有账号登录失败：');
        console.log('      · 检查 unicom 变量是否为「手机号:登录密码」');
        console.log('      · 密码确认无误后，隔几小时或换网络再试（风控会自解）');
        console.log('      · 自动登录需要 Chrome + Python + Playwright，详见 README');
    }

    if (flag(ENV_DEBUG)) {
        console.log('');
        console.log('   🔧 调试明细：');
        for (const r of results) {
            console.log(`      [${r.index}] ${r.status}  token=${r.tokenTail || '—'}  ${r.msg || ''}`);
        }
    }

    await push(results, cmf, all, Number(secs));
    console.log('');
}

main().catch((e) => {
    console.log('脚本异常：' + (e && e.stack ? e.stack : e));
    process.exit(1);
});
