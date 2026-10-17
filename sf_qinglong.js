/**
 * 顺丰速运 · 签到 + 做任务领积分
 * ===========================================================================
 *  脚本名称：sf_qinglong.js
 *  作    者：Mist
 *  运行环境：青龙面板 Node.js（依赖 axios、undici）
 *  定时建议：10 12 * * *
 * ===========================================================================
 *  ⚠️  免责声明（务必阅读）
 * ===========================================================================
 *
 *  1. 本脚本仅供**个人学习、研究和技术交流**使用，用于自动化操作**本人账号**
 *     的日常签到行为，不针对任何第三方账号或系统。
 *
 *  2. 使用者应自行确保：
 *       · 所使用账号为本人所有或已获得账号所有人的明确授权；
 *       · 使用行为不违反《顺丰速运用户服务协议》及相关平台规则；
 *       · 不对平台服务器造成异常负载（脚本已内置随机延时，请勿调至 0）。
 *
 *  3. 严禁将本脚本用于下列用途，违者后果自负：
 *       · 批量操作他人账号、代他人签到以牟利；
 *       · 商业用途、二次售卖、捆绑销售；
 *       · 破解、绕过平台风控或安全机制；
 *       · 采集、存储、传播他人个人信息。
 *
 *  4. 相关法律提示（中华人民共和国）：
 *       · 《网络安全法》第二十七条
 *           任何个人和组织不得从事非法侵入他人网络、干扰他人网络正常功能、
 *           窃取网络数据等危害网络安全的活动。
 *       · 《刑法》第二百八十五条（非法侵入计算机信息系统罪）
 *           违反国家规定，侵入国家事务、国防建设、尖端科学技术领域以外的
 *           计算机信息系统，情节严重的，处三年以下有期徒刑或者拘役。
 *       · 《刑法》第二百八十六条（破坏计算机信息系统罪）
 *           对计算机信息系统功能进行删除、修改、增加、干扰，造成计算机信息
 *           系统不能正常运行，后果严重的，依法追究刑事责任。
 *       · 《刑法》第二百五十三条之一（侵犯公民个人信息罪）
 *           违反国家有关规定，向他人出售或者提供公民个人信息，情节严重的，
 *           依法追究刑事责任。
 *       · 《民法典》第一千零三十四条至一千零三十九条（个人信息保护）
 *           自然人的个人信息受法律保护，处理个人信息应遵循合法、正当、
 *           必要原则，并取得本人同意。
 *       · 《数据安全法》第二十七条、第三十二条
 *           开展数据处理活动应建立健全全流程数据安全管理制度；任何组织、
 *           个人不得窃取或者以其他非法方式获取数据。
 *
 *  5. 本脚本按"现状"提供，作者不对因使用本脚本产生的任何直接或间接损失
 *     （包括但不限于账号被封禁、积分被清零、数据丢失）承担责任。
 *     使用即表示你已完整阅读并同意上述条款。
 *
 *  6. 脚本中的接口路径、签名算法等均来自公开可获取的客户端程序，
 *     仅用于演示协议分析与自动化原理，不包含任何平台服务端代码。
 *
 * ===========================================================================
 *  ★ 需要配置的环境变量
 * ===========================================================================
 *
 *  ┌─ sfck ─ 必填 ──────────────────────────────────────────────┐
 *  │ suuid，登录会话凭证                                          │
 *  │ 抓法：Network → 任意请求 → Headers → Request Headers → suuid │
 *  │ 多号：# 或换行分隔                                           │
 *  └───────────────────────────────────────────────────────────┘
 *
 *  ┌─ sftask ─ 选填 ────────────────────────────────────────────┐
 *  │ 留空 = 用内置 12 个任务码（合计 61 分）                        │
 *  │ 覆盖格式："码A#码B"                                          │
 *  └───────────────────────────────────────────────────────────┘
 *
 *  ┌─ sfuser ─ 选填 ────────────────────────────────────────────┐
 *  │ userId / memberId，仅日志显示                                │
 *  └───────────────────────────────────────────────────────────┘
 *
 *  ┌─ TYpush ─ 选填 ────────────────────────────────────────────┐
 *  │ 推送内容格式，三选一                                          │
 *  │                                                            │
 *  │   auto（默认/留空）                                          │
 *  │     智能：企业微信应用 → markdown（彩色排版）                  │
 *  │           其他渠道     → 纯文本（制表符排版）                  │
 *  │                                                            │
 *  │   markdown                                                 │
 *  │     强制彩色排版。企业微信应用生效，                       │
 *  │     发送失败会自动降级为纯文本重试一次。                      │
 *  │                                                            │
 *  │   text                                                     │
 *  │     强制纯文本。用 ┌ ├ └ ━ 制表符排版，所有客户端都不会乱。     │
 *  │     企业微信应用也只发纯文本。                               │
 *  └───────────────────────────────────────────────────────────┘
 *

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
    const m = reason && reason.message ? reason.message : String(reason);
    console.log('   ⚠️  推送渠道内部异常（已忽略，不影响主流程）：' + m);
});

// ---------------------------------------------------------------------------
// 依赖检查
// ---------------------------------------------------------------------------
let axios;
try {
    axios = require('axios');
} catch (e) {
    console.log('');
    console.log('❌ 缺少依赖 axios');
    console.log('   青龙：依赖管理 → NodeJs → 安装 axios');
    console.log('');
    process.exit(0);
}

// ===========================================================================
// 一、配置
// ===========================================================================

const ENV_SUUID = 'sfck';
const ENV_TASK = 'sftask';
const ENV_USER = 'sfuser';

/**
 * 推送格式开关（环境变量 TYpush）
 *   auto / 留空  → 智能：企业微信应用用 markdown
 *                  其他渠道用纯文本（它们不支持 markdown）
 *   markdown     → 强制 markdown（仅对企业微信应用生效，失败自动降级）
 *   text         → 强制纯文本（所有渠道都用制表符版）
 */
const ENV_PUSH_FMT = 'TYpush';

const UCM = process.env.sfhost || 'https://ucmp.sf-express.com';

const SIGN_APP_ID = 'authenticationRnApp';
const SIGN_KEY = '3408870DkRcuC';

const ENABLE_NOTIFY = 1;
const DEBUG = 0;
const DRY_RUN = 0;

const DELAY_MIN_MS = 1200;
const DELAY_MAX_MS = 2800;
const REQUEST_TIMEOUT = 15000;

const APP_VERSION = 'V17.79';
const APP_VERSION_NAME = 'V17.79.0';
const REFERER = 'https://servicewechat.com/wxd4185d00bf7e08ac/738/page-frame.html';
const WX_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 ' +
    'MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI ' +
    'MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090b11) XWEB/9129';

// ---------------------------------------------------------------------------
// 内置任务清单（来源：queryPointTaskAndSignFromES 抓包，合计 61 分）
// ---------------------------------------------------------------------------
const TASK_CATALOG = [
    { code: '6F8AAA6CDCF943FE9FAB00CCA0719125', name: '查看限时储值优惠', award: 2, period: 'D', auto: true },
    { code: 'C3DB23A8385B4AD5BAF3BC22312AC812', name: '去看看生活服务', award: 2, period: 'D', auto: true },
    { code: '1125AEDD23DA491C8D1486DE5805B807', name: '浏览会员权益', award: 4, period: 'W', auto: true },
    { code: 'EBD2831EC93C43A5A4940BAF4672C9A1', name: '去创建你的家庭账户', award: 5, period: 'M', auto: true },
    { code: 'B0C30EA64EFB4828B6CD7BB6F002E6E5', name: '去使用AI小丰寄件', award: 6, period: 'D', auto: false },
    { code: 'D66A32227E964E959D19E52004A753F3', name: '领任意生活特权福利', award: 6, period: 'D', auto: false },
    { code: 'D95612AEF0D44FEEBE7157017BDBCB1A', name: '寄一单国际件', award: 5, period: 'D', auto: false },
    { code: '1ED31ACAC5C24A1DAC8660D57701A146', name: '用行业模板寄件下单', award: 5, period: 'W', auto: false },
    { code: '90D8EC03765A422ABC99F01067479485', name: '参与积分活动(消耗50)', award: 6, period: 'W', auto: false },
    { code: 'A431239561DC456289C3E7C1F421DA12', name: '参与积分活动(消耗260)', award: 9, period: 'M', auto: false },
    { code: '7A9A0EF217074583935DDB3D84C0DF97', name: '设置你的顺丰ID', award: 5, period: 'T', auto: false },
    { code: '5645921EFDAD48DE94950DD5DA6C6231', name: '去新增一个收件偏好', award: 6, period: 'T', auto: false },
];

const PERIOD_CN = { D: '每日', W: '每周', M: '每月', T: '一次性' };

// ---------------------------------------------------------------------------
// 接口表
// ---------------------------------------------------------------------------
const API = {
    getTodaySign: {
        name: '签到状态',
        method: 'GET',
        path: '/proxy/esgcempcore/memberNonactivity/integralSignV2Service/getTodaySign',
    },
    signIn: {
        name: '执行签到',
        method: 'POST',
        path: '/wechat-act/wxapp/signIn?platform=wxapp',
    },
    finishTask: {
        name: '做任务',
        method: 'POST',
        path: '/proxy/esgcempcore/memberEs/taskRecord/finishTask',
    },
    queryPoint: {
        name: '积分查询',
        method: 'GET',
        path: '/cx-wechat-member/member/memGrade/queryPoint?flag=2',
    },
    queryPointRecord: {
        name: '积分明细',
        method: 'POST',
        path: '/cx-wechat-member/member/memGrade/queryPointRecord',
        body: { flag: 0, pageNo: 1, pageSize: 5, type: 'ALL' },
    },
};

// ===========================================================================
// 二、排版工具（中文/emoji 按双宽计算，保证列对齐）
// ===========================================================================

/**
 * 计算字符串显示宽度。
 * 中文、全角符号、emoji 占 2 列，ASCII 占 1 列。
 * 不做这个处理的话，含中文的行会参差不齐。
 */
function strWidth(s) {
    let w = 0;
    for (const ch of String(s)) {
        const c = ch.codePointAt(0);
        const wide =
            c >= 0x1100 &&
            (c <= 0x115f ||                          // 韩文字母
                c === 0x2329 || c === 0x232a ||
                (c >= 0x2e80 && c <= 0xa4cf && c !== 0x303f) || // CJK 部首/汉字
                (c >= 0xac00 && c <= 0xd7a3) ||      // 韩文
                (c >= 0xf900 && c <= 0xfaff) ||      // CJK 兼容
                (c >= 0xfe30 && c <= 0xfe6f) ||      // CJK 标点
                (c >= 0xff00 && c <= 0xff60) ||      // 全角
                (c >= 0xffe0 && c <= 0xffe6) ||
                (c >= 0x1f300 && c <= 0x1f64f) ||    // emoji
                (c >= 0x1f680 && c <= 0x1f6ff) ||
                (c >= 0x1f900 && c <= 0x1f9ff) ||
                (c >= 0x2600 && c <= 0x27bf) ||      // 杂项符号
                (c >= 0x20000 && c <= 0x3fffd));
        w += wide ? 2 : 1;
    }
    return w;
}

/** 左对齐补空格到指定显示宽度 */
const padR = (s, n) => String(s) + ' '.repeat(Math.max(0, n - strWidth(s)));

/** 右对齐补空格到指定显示宽度 */
const padL = (s, n) => ' '.repeat(Math.max(0, n - strWidth(s))) + String(s);

/** 居中补空格到指定显示宽度 */
function padC(s, n) {
    const diff = n - strWidth(s);
    if (diff <= 0) return String(s);
    const left = Math.floor(diff / 2);
    return ' '.repeat(left) + String(s) + ' '.repeat(diff - left);
}

/** 画一条横线 */
const line = (n, ch = '─') => ch.repeat(n);

/** 带边框的标题 */
function boxTitle(text, width = 54) {
    const inner = width - 2;
    console.log('');
    console.log('╭' + line(inner) + '╮');
    console.log('│' + padC(text, inner) + '│');
    console.log('╰' + line(inner) + '╯');
}

/** 带缩进的分节标题 */
function section(title, width = 54) {
    const tail = Math.max(0, width - 3 - strWidth(title));
    console.log('');
    console.log('├─ ' + title + ' ' + line(tail));
}

/** 键值对行（键宽 8，值左对齐） */
function kv(key, value, indent = 3) {
    console.log(' '.repeat(indent) + padR(key, 10) + value);
}

// ===========================================================================
// 三、通用工具
// ===========================================================================

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomSleep = (min = DELAY_MIN_MS, max = DELAY_MAX_MS) =>
    sleep(Math.floor(Math.random() * (max - min)) + min);

function randomWord(len = 32) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const b = crypto.randomBytes(len);
    let o = '';
    for (let i = 0; i < len; i++) o += chars[b[i] % chars.length];
    return o;
}

const makeMsgId = () => 'WA' + randomWord(32).toUpperCase();
const md5Upper = (s) => crypto.createHash('md5').update(s, 'utf8').digest('hex').toUpperCase();
const debugLog = (...a) => DEBUG && console.log('   🔍', ...a);

// ===========================================================================
// 四、签名
// ===========================================================================

/**
 * 小程序 @inc/utils → md5-hash 原文复刻
 *   有 body：appId={appId}&nonceStr={nonce}&requestBody={JSON}&key={key}
 *   无 body：appId={appId}&nonceStr={nonce}&key={key}
 *   sign = MD5(...).toUpperCase()
 */
function makeSign(requestBody = '') {
    const nonceStr = randomWord(32);
    const stringA = requestBody
        ? `appId=${SIGN_APP_ID}&nonceStr=${nonceStr}&requestBody=${requestBody}&key=${SIGN_KEY}`
        : `appId=${SIGN_APP_ID}&nonceStr=${nonceStr}&key=${SIGN_KEY}`;
    return { sign: md5Upper(stringA), nonceStr, stringA };
}

function serializeBody(body) {
    if (body === null || body === undefined || body === '') return '';
    if (typeof body === 'string') return body;
    return JSON.stringify(body);
}

function buildSignedUrl(path, sign, nonceStr) {
    const sep = path.includes('?') ? '&' : '?';
    return `${UCM}${path}${sep}appId=${SIGN_APP_ID}&sign=${sign}&nonceStr=${nonceStr}`;
}

// ===========================================================================
// 五、请求
// ===========================================================================

const http = axios.create({ timeout: REQUEST_TIMEOUT, validateStatus: () => true });

function buildHeaders(user) {
    return {
        suuid: user.suuid,
        msgid: makeMsgId(),
        version: APP_VERSION,
        suuidVersion: APP_VERSION_NAME,
        envVersion: 'release',
        'content-type': 'application/json',
        accept: 'application/json, text/plain, */*',
        'user-agent': WX_USER_AGENT,
        referer: REFERER,
    };
}

async function callApi(user, api, overrideBody = undefined) {
    const body = overrideBody !== undefined ? overrideBody : api.body;
    const bodyStr = serializeBody(body);
    const { sign, nonceStr, stringA } = makeSign(bodyStr);
    const url = buildSignedUrl(api.path, sign, nonceStr);

    if (DRY_RUN) {
        console.log('   🧪 [干跑] ' + api.method + ' ' + api.name);
        console.log('      待签名串 ' + stringA);
        console.log('      签名     ' + sign);
        console.log('      URL      ' + url);
        if (bodyStr) console.log('      请求体   ' + bodyStr);
        return { status: 200, data: { success: true, obj: null } };
    }

    debugLog(api.method, url);
    if (bodyStr) debugLog('body:', bodyStr);

    try {
        const res = await http.request({
            method: api.method,
            url,
            headers: buildHeaders(user),
            data: api.method === 'POST' ? (body === undefined ? {} : body) : undefined,
        });
        debugLog('HTTP', res.status, JSON.stringify(res.data).slice(0, 300));
        return { status: res.status, data: res.data };
    } catch (err) {
        const detail =
            err.code === 'ECONNABORTED' || /timeout/i.test(err.message)
                ? '请求超时'
                : err.code === 'ENOTFOUND'
                    ? '域名解析失败'
                    : err.message;
        console.log('   ⚠️  [' + api.name + '] ' + detail);
        return { status: 'ERR', data: null };
    }
}

const isOk = (r) => !!(r && r.data && r.data.success === true);

function errText(r) {
    if (!r || !r.data) return 'HTTP ' + (r && r.status);
    const d = r.data;
    return d.errorMessage || d.errorCode || d.message || 'HTTP ' + r.status;
}

// ===========================================================================
// 六、业务步骤
// ===========================================================================

/** ① 签到状态 */
async function stepSignStatus(user) {
    const r = await callApi(user, API.getTodaySign);

    if (!isOk(r)) {
        user.signOk = false;
        user.signText = '查询失败：' + errText(r);
        return null;
    }

    const o = r.data.obj || {};
    user.signOk = o.signed === true;
    user.dayCount = o.dayCount ?? '-';
    user.bubble = o.bubbleText || '';
    return o;
}

/** ② 执行签到（500 = 已签到） */
async function stepSignIn(user) {
    const r = await callApi(user, API.signIn, {});
    const d = r.data || {};

    if (r.status === 500 || d.errorCode === '500' || d.errorCode === 500) {
        user.signText = '今日已签到，无需重复';
        return true;
    }

    if (d.success === true) {
        const o = d.obj || {};
        const award = o.award || {};
        const products = Array.isArray(award.productDTOList) ? award.productDTOList : [];

        let num = o.awardNum;
        if (num === undefined || num === null) {
            num = products.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        }
        const gift = award.giftBagName || '';

        user.signOk = true;
        user.signText = gift ? '获得 ' + gift : num ? '获得 ' + num + ' 积分' : '签到成功';
        if (o.dayCount !== undefined) user.dayCount = o.dayCount;
        return true;
    }

    user.signOk = false;
    user.signText = '失败：' + errText(r);
    return false;
}

/**
 * ③ 做任务
 * 请求体 {"taskCode":"..."}
 *   obj:true  → 上报成功，积分约 5 分钟后入账
 *   obj:false → 无奖励（已领过 / 需真实操作）
 */
async function stepFinishTask(user, task, idx) {
    const r = await callApi(user, API.finishTask, { taskCode: task.code });

    const row = {
        idx,
        name: task.name,
        award: task.award,
        period: PERIOD_CN[task.period] || task.period,
        auto: task.auto === true,
        icon: '',
        status: '',
    };

    if (!isOk(r)) {
        row.icon = '❌';
        row.status = '失败';
        user.stat.fail++;
        user.taskRows.push(row);
        return false;
    }

    const o = r.data.obj;

    if (o === true) {
        row.icon = '✅';
        row.status = '已上报';
        user.stat.reported++;
        user.taskRows.push(row);
        return true;
    }

    if (o === false) {
        if (task.auto === true) {
            row.icon = '⚠️';
            row.status = '已领过';
            user.stat.claimed++;
        } else {
            row.icon = '💤';
            row.status = '需手动';
            user.stat.manual++;
        }
        user.taskRows.push(row);
        return false;
    }

    let num = '';
    if (typeof o === 'number') num = o;
    else if (o && typeof o === 'object') num = o.awardNum ?? o.point ?? o.score ?? '';

    row.icon = '🎁';
    row.status = num ? '+' + num + '分' : '完成';
    user.stat.awarded++;
    user.taskRows.push(row);
    return true;
}

/** ④ 积分查询 */
async function stepQueryPoint(user) {
    const r = await callApi(user, API.queryPoint);

    if (!isOk(r)) {
        debugLog('积分失败:', errText(r));
        return null;
    }

    const o = r.data.obj || {};
    const point =
        o.usablePoint ?? o.point ?? o.points ?? o.score ?? o.integral ?? o.totalPoint ?? null;

    user.point = point;
    user.expiringPoint = o.expiringPoint || 0;
    user.expiringDate = o.expiringDate || '';
    return point;
}

/** ⑤ 积分明细 */
async function stepPointRecord(user) {
    const r = await callApi(user, API.queryPointRecord);

    if (!isOk(r)) {
        debugLog('明细失败:', errText(r));
        return null;
    }

    const o = r.data.obj || {};
    const list = o.data || o.recordList || o.list || [];

    user.recordTotal = o.totalCount ?? list.length;
    user.records = list.slice(0, 3).map((it) => ({
        time: it.createTm || '',
        val: Number(it.pointVal ?? it.changePoint ?? 0),
        label: it.sourceCodeLabel || '',
    }));
    return user.records;
}

// ===========================================================================
// 七、单账号执行 + 结果渲染
// ===========================================================================

async function runUser(user, tasks) {
    // ── 执行 ──
    const status = await stepSignStatus(user);
    await randomSleep();

    if (status && status.signed === true) {
        user.signText = '今日已签到，跳过';
    } else {
        await stepSignIn(user);
    }
    await randomSleep();

    for (let i = 0; i < tasks.length; i++) {
        await stepFinishTask(user, tasks[i], i + 1);
        if (i < tasks.length - 1) await randomSleep();
    }
    await randomSleep();

    await stepQueryPoint(user);
    await stepPointRecord(user);
}

/** 渲染单账号结果 */
function renderUser(user, tasks) {
    const W = 54;
    section('账号 ' + user.index + '  结果', W);

    // ── 身份 ──
    if (user.userId) kv('userId', user.userId);

    // ── 签到 ──
    const signIcon = user.signOk ? '✅' : '❌';
    kv('签到', signIcon + '  ' + (user.signText || '-'));
    if (user.dayCount !== undefined && user.dayCount !== '-') {
        kv('连签', user.dayCount + ' 天 🔥' + (user.bubble ? '   今日可领 ' + user.bubble : ''));
    }

    // ── 任务 ──
    const totalAward = tasks.reduce((s, t) => s + (Number(t.award) || 0), 0);
    kv('任务', tasks.length + ' 个 / ' + totalAward + ' 分');

    if (user.taskRows.length) {
        console.log('');
        console.log(
            '   ' + padR('   ', 2) +
            padR('任务名称', 22) +
            padL('奖励', 6) +
            '  ' + padR('周期', 8) +
            padR('状态', 10)
        );
        console.log('   ' + line(W - 3, '·'));

        for (const row of user.taskRows) {
            console.log(
                '   ' + row.icon + ' ' +
                padR(row.name, 22) +
                padL(row.award + '分', 6) +
                '  ' + padR(row.period, 8) +
                padR(row.status, 10)
            );
        }
        console.log('   ' + line(W - 3, '·'));
    }

    // ── 统计 ──
    console.log('');
    const st = user.stat;
    kv('统计',
        '上报 ' + st.reported +
        ' │ 已领过 ' + st.claimed +
        ' │ 需手动 ' + st.manual +
        ' │ 失败 ' + st.fail);

    // ── 积分 ──
    kv('积分', (user.point === null || user.point === undefined ? '未获取' : String(user.point)) + ' 💰');
    if (user.expiringPoint) {
        kv('', '其中 ' + user.expiringPoint + ' 分将于 ' + (user.expiringDate || '近期') + ' 过期 ⏳');
    }

    // ── 明细 ──
    if (user.records.length) {
        kv('明细', '共 ' + user.recordTotal + ' 条，最近 ' + user.records.length + ' 条');
        for (const it of user.records) {
            const icon = it.val > 0 ? '📈' : '📉';
            console.log(
                '      ' + padR(it.time, 20) +
                padL((it.val > 0 ? '+' : '') + it.val, 6) + ' 💰  ' +
                it.label
            );
        }
    }

    console.log('╰' + line(W) + '╯');
}

// ===========================================================================
// 八、推送渠道预检（核心修复）
// ===========================================================================

/**
 * sendNotify.js 里每个渠道的启用条件。
 * 全部为空时 sendNotify() 会静默 return，不报错也不推送。
 */
const PUSH_CHANNELS = [
    { name: '企业微信机器人', keys: ['QYWX_KEY'] },
    { name: '企业微信应用', keys: ['QYWX_AM'], alt: ['QYWX_ORIGIN'] },
    { name: 'Server酱', keys: ['PUSH_KEY'] },
    { name: 'PushPlus', keys: ['PUSH_PLUS_TOKEN'] },
    { name: '钉钉机器人', keys: ['DD_BOT_TOKEN'] },
    { name: '飞书机器人', keys: ['FSKEY'] },
    { name: 'Telegram', keys: ['TG_BOT_TOKEN', 'TG_USER_ID'] },
    { name: 'Bark', keys: ['BARK_PUSH'] },
    { name: 'PushDeer', keys: ['DEER_KEY'] },
    { name: '微加机器人', keys: ['WE_PLUS_BOT_TOKEN'] },
    { name: 'Qmsg酱', keys: ['QMSG_KEY'] },
    { name: 'iGot', keys: ['IGOT_PUSH_KEY'] },
    { name: 'Gotify', keys: ['GOTIFY_URL', 'GOTIFY_TOKEN'] },
    { name: 'PushMe', keys: ['PUSHME_KEY'] },
    { name: 'ntfy', keys: ['NTFY_URL', 'NTFY_TOPIC'] },
    { name: 'WxPusher', keys: ['WXPUSHER_APP_TOKEN'] },
    { name: '自定义Webhook', keys: ['WEBHOOK_URL'] },
    { name: 'SMTP邮件', keys: ['SMTP_EMAIL', 'SMTP_PASSWORD'] },
    { name: 'go-cqhttp', keys: ['GOBOT_URL'] },
    { name: 'SynologyChat', keys: ['CHAT_URL'] },
    { name: '智能微秘书', keys: ['AIBOTK_KEY'] },
    { name: 'Chronocat', keys: ['CHRONOCAT_QQ', 'CHRONOCAT_TOKEN'] },
    { name: 'OpeniLink', keys: ['OPENILINK_APP_TOKEN'] },
];

/** 找出已配置的推送渠道 */
function detectPushChannels() {
    const hit = [];
    for (const ch of PUSH_CHANNELS) {
        const ok = ch.keys.every((k) => {
            const v = process.env[k];
            return v !== undefined && String(v).trim() !== '';
        });
        if (ok) hit.push(ch.name);
    }
    return hit;
}

// ---------------------------------------------------------------------------
// 企业微信应用：本脚本自己发（不经 sendNotify）
//
// 为什么不用 sendNotify：
//   它内部走 undici，而 undici 对 Node 版本和安装质量很敏感。
//   实测同一台机器 axios 能通、undici 却报 TypeError，
//   再叠加它 $.post 错误回调只传 1 个参数的 bug，就直接崩脚本。
//
//   这里用 axios 直连企业微信 API：
//     GET  /cgi-bin/gettoken?corpid=&corpsecret=   → access_token
//     POST /cgi-bin/message/send?access_token=     → 发送文本消息
//
// QYWX_AM 格式：corpid,corpsecret,touser,agentid[,消息类型]
//   touser  多个用 | 分隔；留空则 @all
//   agentid 应用的 AgentId（数字）
// ---------------------------------------------------------------------------

/** 按 UTF-8 字节数拆分文本（企业微信 text 消息 content 上限 2048 字节） */
function splitByBytes(text, maxBytes = 1800) {
    const out = [];
    let cur = '';
    let curBytes = 0;
    for (const ch of String(text)) {
        const b = Buffer.byteLength(ch, 'utf8');
        if (curBytes + b > maxBytes && cur) {
            out.push(cur);
            cur = '';
            curBytes = 0;
        }
        cur += ch;
        curBytes += b;
    }
    if (cur) out.push(cur);
    return out.length ? out : [''];
}

/**
 * 通过企业微信应用发消息
 * @param {string} title        通知标题（仅日志用，正文自带标题）
 * @param {string} body         markdown 正文
 * @param {boolean} useMarkdown true=优先 markdown，false=直接纯文本
 * @param {string} [fallbackText] 降级时用的纯文本正文
 * @returns {Promise<{ok:boolean, reason:string}>}
 */
async function sendQywxApp(title, body, useMarkdown = true, fallbackText = '') {
    const am = (process.env.QYWX_AM || '').trim();
    if (!am) return { ok: false, reason: 'QYWX_AM 未配置' };

    const parts = am.split(',').map((s) => s.trim());
    const corpid = parts[0] || '';
    const corpsecret = parts[1] || '';
    const touser = parts[2] || '@all';
    const agentid = parts[3] || '';
    const origin = (process.env.QYWX_ORIGIN || 'https://qyapi.weixin.qq.com').trim();

    if (!corpid || !corpsecret) return { ok: false, reason: 'QYWX_AM 的 corpid / corpsecret 为空' };
    if (!agentid) return { ok: false, reason: 'QYWX_AM 缺少 agentid（第 4 段）' };

    // ① 取 access_token
    let token = '';
    try {
        const res = await http.get(
            origin + '/cgi-bin/gettoken?corpid=' +
            encodeURIComponent(corpid) + '&corpsecret=' + encodeURIComponent(corpsecret),
            { timeout: 10000 }
        );
        const j = res.data || {};
        if (j.errcode !== 0 || !j.access_token) {
            return { ok: false, reason: 'gettoken 失败 errcode=' + j.errcode + ' ' + (j.errmsg || '') };
        }
        token = j.access_token;
    } catch (e) {
        return { ok: false, reason: 'gettoken 请求异常：' + e.message };
    }

    // ② 发送。markdown 优先（排版好看），失败自动降级纯文本
    //    注意：两个 builder 产出都是自包含的（自带标题和署名），这里不再拼 title
    const send = async (msgtype, content) => {
        // markdown 上限 2048 字节；text 上限 2048 字节，统一按 1800 切
        const chunks = splitByBytes(content, 1800);
        let lastErr = '';

        for (let i = 0; i < chunks.length; i++) {
            const head = chunks.length > 1 ? `(${i + 1}/${chunks.length})\n` : '';
            const payload = {
                touser,
                agentid: /^\d+$/.test(String(agentid)) ? Number(agentid) : agentid,
                msgtype,
                safe: 0,
            };
            payload[msgtype] = { content: head + chunks[i] };

            const res = await http.post(
                origin + '/cgi-bin/message/send?access_token=' + encodeURIComponent(token),
                payload,
                { timeout: 10000, headers: { 'content-type': 'application/json' } }
            );
            const j = res.data || {};
            if (j.errcode !== 0) {
                lastErr = 'errcode=' + j.errcode + ' ' + (j.errmsg || '');
                return { ok: false, reason: lastErr, chunks: chunks.length };
            }
        }
        return { ok: true, reason: '发送成功' + (chunks.length > 1 ? '（分 ' + chunks.length + ' 条）' : ''), chunks: chunks.length };
    };

    try {
        if (useMarkdown) {
            const r = await send('markdown', body);
            if (r.ok) return r;
            // markdown 不被支持（部分企业/应用类型会拒）→ 降级纯文本
            console.log('   ↳ markdown 发送失败（' + r.reason + '），改用纯文本重试');
            return await send('text', fallbackText || body);
        }
        return await send('text', fallbackText || body);
    } catch (e) {
        return { ok: false, reason: '发送请求异常：' + e.message };
    }
}

// ===========================================================================
// 九、主流程
// ===========================================================================

/** 收集每个账号的执行结果，推送时统一排版 */
const notifyUsers = [];
/** 本次执行的元信息（推送标题栏用） */
const runMeta = { startTime: '', totalTasks: 0, totalAward: 0, autoTasks: 0, autoAward: 0 };

async function main() {
    const rawSuuid = process.env[ENV_SUUID] || '';

    if (!rawSuuid.trim()) {
        boxTitle('❌ 未配置环境变量 sfck');
        console.log('');
        console.log('  青龙 → 环境变量 → 新建');
        console.log('    名称  sfck');
        console.log('    值    你的 suuid');
        console.log('');
        console.log('  suuid 抓法：');
        console.log('    Network → 任意请求 → Headers → Request Headers → suuid');
        return;
    }

    const accounts = parseSfuids(rawSuuid);
    const tasks = parseTasks(process.env[ENV_TASK] || '');
    const userId = process.env[ENV_USER] || '';

    if (!accounts.length) {
        console.log('❌ sfck 解析后没有有效账号，请检查格式');
        return;
    }

    const totalAward = tasks.reduce((s, t) => s + (Number(t.award) || 0), 0);
    const autoTasks = tasks.filter((t) => t.auto === true);
    const autoAward = autoTasks.reduce((s, t) => s + (Number(t.award) || 0), 0);

    // ── 启动信息 ──
    const startTime = new Date().toLocaleString('zh-CN');
    boxTitle('🚚  顺丰速运 · 签到 + 做任务');
    console.log('');
    kv('账号数量', accounts.length + ' 个');
    kv('任务数量', tasks.length + ' 个 / ' + totalAward + ' 分');
    kv('可自动', autoTasks.length + ' 个 / ' + autoAward + ' 分 ⚡');
    kv('执行时间', startTime);

    // 记录元信息，推送时用
    runMeta.startTime = startTime;
    runMeta.totalTasks = tasks.length;
    runMeta.totalAward = totalAward;
    runMeta.autoTasks = autoTasks.length;
    runMeta.autoAward = autoAward;
    runMeta.accountCount = accounts.length;

    // ── 逐账号 ──
    for (let i = 0; i < accounts.length; i++) {
        const user = {
            index: i + 1,
            suuid: accounts[i].suuid,
            userId,
            // 结果字段
            signOk: false,
            signText: '',
            dayCount: undefined,
            bubble: '',
            point: null,
            expiringPoint: 0,
            expiringDate: '',
            recordTotal: 0,
            records: [],
            taskRows: [],
            stat: { reported: 0, awarded: 0, claimed: 0, manual: 0, fail: 0 },
        };

        try {
            await runUser(user, tasks);
        } catch (e) {
            user.signText = '执行异常：' + e.message;
        }

        renderUser(user, tasks);

        // 收集结构化数据，推送时再统一排版
        notifyUsers.push(user);

        if (i < accounts.length - 1) {
            const wait = Math.floor(Math.random() * 2000) + 1500;
            console.log('');
            console.log('   ⏳ 等待 ' + (wait / 1000).toFixed(1) + ' 秒处理下一个账号…');
            await sleep(wait);
        }
    }
}

// ===========================================================================
// 十、解析环境变量
// ===========================================================================

function parseSfuids(raw) {
    return String(raw || '')
        .split(/&&&|\n|#/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((item) => {
            const i = item.indexOf('@');
            if (i === -1) return { suuid: item, openId: null };
            return { suuid: item.slice(0, i).trim(), openId: item.slice(i + 1).trim() || null };
        })
        .filter((a) => a.suuid);
}

function parseTasks(raw) {
    const codes = String(raw || '')
        .split(/[#,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

    if (!codes.length) return TASK_CATALOG.slice();

    return codes.map((code) => {
        const hit = TASK_CATALOG.find((t) => t.code.toUpperCase() === code.toUpperCase());
        return hit || { code, name: code.slice(0, 8) + '…', award: '?', period: '-', auto: false };
    });
}

// ===========================================================================
// 十一、推送内容排版
// ===========================================================================

/**
 * 构建 Markdown 版推送正文（企业微信 markdown 消息类型）。
 *
 * 企业微信 markdown 支持的能力有限，只用了这些：
 *   ##  标题        **加粗**        >  引用块
 *   <font color="info|comment|warning">文字</font>   着色
 *
 * 颜色语义：
 *   info    = 绿色（成功）
 *   warning = 橙红（需要注意）
 *   comment = 灰色（次要信息）
 */
function buildMarkdown(users, meta) {
    const L = [];
    const now = meta.startTime || new Date().toLocaleString('zh-CN');

    L.push('## 🚚 顺丰速运 · 签到日报');
    L.push('<font color="comment">' + now + '　共 ' + users.length + ' 个账号</font>');

    for (const u of users) {
        L.push('');
        L.push('> **👤 账号 ' + u.index + '**');

        // 签到
        const signLine = u.signOk
            ? '✅ ' + (u.signText || '签到成功')
            : '❌ ' + (u.signText || '失败');
        L.push('> 签到：<font color="' + (u.signOk ? 'info' : 'warning') + '">' + signLine + '</font>');

        // 连签
        if (u.dayCount !== undefined && u.dayCount !== '-') {
            let s = '> 连签：**' + u.dayCount + '** 天 🔥';
            if (u.bubble) s += '　今日可领 ' + u.bubble;
            L.push(s);
        }

        // 积分
        const pt = u.point === null || u.point === undefined ? '未获取' : String(u.point);
        L.push('> 积分：<font color="warning">**' + pt + '**</font> 💰');
        if (u.expiringPoint) {
            L.push('> <font color="comment">其中 ' + u.expiringPoint + ' 分将于 ' +
                (u.expiringDate || '近期') + ' 过期 ⏳</font>');
        }

        // 任务统计
        const st = u.stat;
        L.push('');
        L.push('> **🎯 任务 ' + meta.totalTasks + ' 个 / ' + meta.totalAward + ' 分**');
        L.push('> ✅ 已上报 **' + st.reported + '**　⚠️ 已领过 **' + st.claimed + '**');
        L.push('> 💤 需手动 **' + st.manual + '**　❌ 失败 **' + st.fail + '**');

        // 任务明细（只列有意义的：已上报 / 失败 / 已领过）
        const notable = (u.taskRows || []).filter((r) => r.icon !== '💤');
        if (notable.length) {
            L.push('');
            L.push('> **📋 任务明细**');
            for (const r of notable) {
                L.push('> ' + r.icon + ' ' + r.name + '　' + r.award + '分　' + r.status);
            }
        }

        // 积分明细
        if (u.records && u.records.length) {
            L.push('');
            L.push('> **📈 最近积分变动**（共 ' + u.recordTotal + ' 条）');
            for (const it of u.records) {
                const icon = it.val > 0 ? '📈' : '📉';
                const sign = it.val > 0 ? '+' : '';
                L.push('> ' + icon + ' ' + it.time + '　**' + sign + it.val + '**　' + it.label);
            }
        }
    }

    L.push('');
    L.push('---');
    L.push('<font color="comment">脚本作者：Mist</font>');
    return L.join('\n');
}

/**
 * 构建纯文本版推送正文（兜底用，也用于不支持 markdown 的渠道）。
 *
 * 排版思路：
 *   ━━━  主分隔线，划分大区块
 *   ┌    区块开头
 *   ├ └  区块内条目（最后一条用 └ 收口）
 *   ！   用全角空格做字段间隔 —— 微信是比例字体，普通空格对不齐，
 *        全角空格宽度固定，看着整齐
 */
function buildText(users, meta) {
    const L = [];
    const RULE = '━━━━━━━━━━━━━━━━━━━━';
    const now = meta.startTime || new Date().toLocaleString('zh-CN');

    L.push('🚚 顺丰速运 · 签到日报');
    L.push(RULE);
    L.push('🕐 ' + now);
    L.push('👥 账号 ' + users.length + ' 个　🎯 任务 ' + meta.totalTasks + ' 个 / ' + meta.totalAward + ' 分');
    L.push('⚡ 可自动 ' + meta.autoTasks + ' 个 / ' + meta.autoAward + ' 分');

    for (const u of users) {
        const st = u.stat;

        // ── 区块 1：账号概况 ──
        L.push('');
        L.push('┌ 👤 账号 ' + u.index);
        const base = [];
        base.push(['签到', (u.signOk ? '✅ ' : '❌ ') + (u.signText || '-')]);
        if (u.dayCount !== undefined && u.dayCount !== '-') {
            base.push(['连签', u.dayCount + ' 天 🔥' + (u.bubble ? '　可领 ' + u.bubble : '')]);
        }
        base.push(['积分', (u.point ?? '未获取') + ' 💰']);
        if (u.expiringPoint) {
            base.push(['过期', u.expiringPoint + ' 分 / ' + (u.expiringDate || '近期') + ' ⏳']);
        }
        base.forEach(([k, v], i) => {
            L.push((i === base.length - 1 ? '└ ' : '├ ') + k + '　' + v);
        });

        // ── 区块 2：任务统计 ──
        L.push('');
        L.push('┌ 🎯 任务统计');
        L.push('├ ✅ 已上报　' + st.reported);
        L.push('├ ⚠️ 已领过　' + st.claimed);
        L.push('├ 💤 需手动　' + st.manual);
        L.push('└ ❌ 失败　　' + st.fail);

        // ── 区块 3：任务明细（只列有价值的）──
        const notable = (u.taskRows || []).filter((r) => r.icon !== '💤');
        if (notable.length) {
            L.push('');
            L.push('┌ 📋 任务明细');
            notable.forEach((r, i) => {
                L.push((i === notable.length - 1 ? '└ ' : '├ ') +
                    r.icon + ' ' + r.name + '　' + r.award + '分　' + r.status);
            });
        }

        // ── 区块 4：积分变动 ──
        if (u.records && u.records.length) {
            L.push('');
            L.push('┌ 📈 最近积分变动 共 ' + u.recordTotal + ' 条');
            u.records.forEach((it, i) => {
                const icon = it.val > 0 ? '📈' : '📉';
                const sign = it.val > 0 ? '+' : '';
                L.push((i === u.records.length - 1 ? '└ ' : '├ ') +
                    icon + ' ' + it.time + '　' + sign + it.val + '　' + it.label);
            });
        }
    }

    L.push('');
    L.push(RULE);
    L.push('脚本作者：Mist');
    return L.join('\n');
}

// ===========================================================================
// 十二、推送
// ===========================================================================

/**
 * 解析推送格式变量 TYpush
 * @returns {'auto'|'markdown'|'text'}
 */
function resolvePushFormat() {
    const raw = String(process.env[ENV_PUSH_FMT] || '').trim().toLowerCase();
    if (!raw) return 'auto';
    if (raw === 'md' || raw === 'markdown') return 'markdown';
    if (raw === 'text' || raw === 'txt' || raw === 'plain') return 'text';
    return 'auto';
}

/** 格式的中文说明，打在日志里 */
const FORMAT_LABEL = {
    auto: '智能（企业微信应用→markdown，其他→纯文本）',
    markdown: 'markdown（强制彩色排版）',
    text: '纯文本（强制制表符排版）',
};

async function sendNotify() {
    if (!ENABLE_NOTIFY) return;

    const W = 54;
    section('📨 推送', W);

    if (!notifyUsers.length) {
        console.log('   ⏭️  无内容，跳过');
        return;
    }

    // 生成两种版本：markdown 给企业微信应用，纯文本给其他渠道
    const md = buildMarkdown(notifyUsers, runMeta);
    const txt = buildText(notifyUsers, runMeta);

    // 读取格式开关
    const fmt = resolvePushFormat();
    console.log('   🎨 推送格式：' + FORMAT_LABEL[fmt]);

    // 调试时可预览推送内容（DEBUG=1 时打印真正会发的那版）
    if (DEBUG) {
        const preview = fmt === 'text' ? txt : md;
        const label = fmt === 'text' ? '纯文本' : 'markdown';
        console.log('');
        console.log('   ── 推送内容预览（' + label + '）──');
        console.log(preview.split('\n').map((l) => '   │ ' + l).join('\n'));
        console.log('   ── 预览结束 ──');
        console.log('');
    }

    // ① 预检渠道
    const channels = detectPushChannels();

    if (!channels.length) {
        console.log('   ⚠️  未检测到任何推送渠道，本次不会发送');
        console.log('');
        console.log('   在青龙「环境变量」里配置任意一个即可：');
        const CH_W = 18; // 中文渠道名按显示宽度对齐
        console.log('     ' + padR('企业微信机器人', CH_W) + 'QYWX_KEY');
        console.log('     ' + padR('企业微信应用', CH_W) + 'QYWX_AM');
        console.log('     ' + padR('Server酱', CH_W) + 'PUSH_KEY');
        console.log('     ' + padR('PushPlus', CH_W) + 'PUSH_PLUS_TOKEN');
        console.log('     ' + padR('钉钉机器人', CH_W) + 'DD_BOT_TOKEN');
        console.log('     ' + padR('飞书机器人', CH_W) + 'FSKEY');
        console.log('     ' + padR('Telegram', CH_W) + 'TG_BOT_TOKEN + TG_USER_ID');
        console.log('     ' + padR('Bark', CH_W) + 'BARK_PUSH');
        console.log('     ' + padR('ntfy', CH_W) + 'NTFY_URL + NTFY_TOPIC');
        console.log('     ' + padR('WxPusher', CH_W) + 'WXPUSHER_APP_TOKEN');
        console.log('');
        console.log('   注：sendNotify.js 在无渠道时静默返回，不报错 —— ');
        console.log('       旧版脚本因此会误报"已推送"，本版已改为预检。');
        console.log('╰' + line(W) + '╯');
        return;
    }

    // ② 企业微信应用：本脚本用 axios 直发，绕开 sendNotify 的 undici 问题
    //
    //    为什么要绕：sendNotify 内部走 undici，同一台机器 axios 能通、
    //    undici 却报 TypeError，再叠加它错误回调只传 1 个参数的 bug 就崩脚本。
    //    这里自己发，既稳又能拿到精确错误码。
    const hasQywxApp = channels.includes('企业微信应用');
    let qywxOk = false;

    if (hasQywxApp) {
        // fmt = 'text' 时强制纯文本；auto / markdown 都先试 markdown
        const wantMd = fmt !== 'text';
        console.log('   📤 企业微信应用：' + (wantMd ? 'markdown 优先（失败降级文本）' : '按要求使用纯文本'));
        const r = await sendQywxApp('顺丰速运签到', md, wantMd, txt);
        if (r.ok) {
            console.log('   ✅ 企业微信应用 ' + r.reason);
            qywxOk = true;
        } else {
            console.log('   ❌ 企业微信应用 ' + r.reason);
        }
        // 从环境变量里摘掉，避免 sendNotify 再试一次并抛错
        delete process.env.QYWX_AM;
    }

    // ③ 其余渠道交给 sendNotify
    const rest = channels.filter((c) => c !== '企业微信应用');

    if (!rest.length) {
        if (hasQywxApp) {
            console.log('   ' + (qywxOk ? '✅ 推送完成' : '⚠️  推送未成功，请按上面提示修正'));
        } else {
            console.log('   ⏭️  没有其他渠道需要处理');
        }
        console.log('╰' + line(W) + '╯');
        return;
    }

    console.log('   📤 其余渠道交由 sendNotify：' + rest.join('、'));

    // ④ 加载模块
    let notifier = null;
    try {
        notifier = require('./sendNotify');
    } catch (e) {
        // 分两种情况提示，避免误导：
        //   · 文件不存在        → 提示把 sendNotify.js 放同目录
        //   · 依赖缺失(undici)  → 提示去青龙依赖管理装 undici
        const msgText = String(e && e.message || '');
        if (/Cannot find module '\.\/sendNotify'/.test(msgText)) {
            console.log('   ❌ 同目录下没有 sendNotify.js');
            console.log('      把青龙的 sendNotify.js 放到与本脚本同一目录');
        } else if (/Cannot find module 'undici'/.test(msgText)) {
            console.log('   ❌ sendNotify.js 缺少依赖 undici');
            console.log('      青龙 → 依赖管理 → NodeJs → 安装 undici');
            console.log('      （sendNotify.js 用 undici 发 HTTP，不是内置模块）');
            console.log('      提示：企业微信应用渠道不依赖它，已由本脚本直接发送');
        } else {
            console.log('   ❌ sendNotify.js 加载失败：' + msgText.split('\n')[0]);
            console.log('      常见原因：Node 版本过低，或 undici 未安装');
        }
        console.log('╰' + line(W) + '╯');
        return;
    }

    if (!notifier || typeof notifier.sendNotify !== 'function') {
        console.log('   ❌ sendNotify.js 没有导出 sendNotify 函数');
        console.log('      请使用青龙官方附带的那份 sendNotify.js');
        console.log('╰' + line(W) + '╯');
        return;
    }

    // ⑤ 调用
    try {
        await notifier.sendNotify('顺丰速运签到', txt);
        console.log('   ✅ 调用完成（各渠道返回结果见下方日志）');
    } catch (e) {
        console.log('   ❌ 推送异常：' + e.message);
    }
    console.log('╰' + line(W) + '╯');
}

// ===========================================================================
// 十二、入口
// ===========================================================================

(async () => {
    await main();
    await sendNotify();
})()
    .catch((e) => console.log('💥 脚本异常：' + (e && e.message ? e.message : e)))
    .finally(() => {
        if (process.exitCode === undefined) process.exitCode = 0;
    });

/**
 * ===========================================================================
 * 附：为什么以前"说推送了但没收到"
 * ===========================================================================
 *
 * sendNotify.js 源码逻辑：
 *
 *   async function sendNotify(text, desp, params = {}) {
 *       await Promise.all([
 *           serverNotify(text, desp),      // 内部：if (!PUSH_KEY) return
 *           pushPlusNotify(text, desp),    // 内部：if (!PUSH_PLUS_TOKEN) return
 *           qywxBotNotify(text, desp),     // 内部：if (!QYWX_KEY) return
 *           ... 共 24 个渠道
 *       ]);
 *   }
 *
 * 每个渠道函数都是"没配就 return"，**既不抛错也不打印**。
 * 所以 sendNotify() 永远 Promise.resolve()。
 * 旧脚本 await 完就打印"✅ 已推送"，其实一个都没发。
 *
 * 本版修复：
 *   1. 调用前先读环境变量，判断哪些渠道真的可用
 *   2. 一个都没有 → 明确提示要配哪个变量，不再谎报
 *   3. 有渠道 → 列出渠道名后再调用，并用词改为"调用完成"
 *
 * ===========================================================================
 * 附：排版说明
 * ===========================================================================
 * 终端里中文、emoji 占 2 个字符宽度，英文数字占 1 个。
 * 脚本内置 strWidth() 按显示宽度计算，再用 padR/padL 补齐，
 * 所以任务表格在不同终端下都能对齐。
 * ===========================================================================
 */
