/**
 * ============================================================================
 *  grab_longhu_token.js —— 从 HAR / cURL 里抠出龙湖 token，校验后落盘（可选写青龙）
 * ============================================================================
 *
 *  为什么需要这个脚本：
 *   龙湖的登录只有「手机号 + 短信验证码」一条路，而首次发码必弹顶象滑块
 *   （909001 请操作图形验证），滑块跑在真机 App / 小程序的 WebView 里，
 *   容器里没有浏览器就跑不了。所以 token 只能抓一次包拿，之后再靠脚本
 *   每天续期（这脚本配套的主脚本 longhu_signin.js 就是干这个的）。
 *
 *   手工复制 token 容易粘错、粘漏（请求头里有三个地方都可能带 token），
 *   所以这里做成一条命令：读 HAR → 抠 token → 逐个校验 → 落本地 → 推青龙。
 *
 *  用法：
 *    node grab_longhu_token.js                          # 自动找当前目录/项目里的 .har
 *    node grab_longhu_token.js "D:\抓包\longhu.har"
 *    node grab_longhu_token.js 龙湖.har --deploy         # 顺便写回青龙变量 longhu_token
 *    node grab_longhu_token.js 龙湖.har --deploy --dry   # 只打印将要写入的内容
 *
 *   没有 HAR 也行：把抓包工具里那一条请求「复制为 cURL」，存成 curl.txt
 *   （或者直接当参数传一行 cURL 文本），本脚本一样能解析。
 *
 *  青龙连接（--deploy 时需要，全部从环境变量读，脚本内不存任何默认值）：
 *    QL_URL   如 http://127.0.0.1:5700
 *    QL_USER  青龙登录用户名
 *    QL_PASS  青龙登录密码
 *
 *  产物：
 *    <项目根>/longhu_token.json
 *      { accounts: [ { token, phone, nick, growth, level } ], source, savedAt }
 *
 *  青龙上是哪个头的值：
 *    X-LF-UserToken  =  lmToken  =  token  =  请求体/响应体里的 data.token
 *    四个都等价，32 位十六进制，本脚本会全试一遍再校验。
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const BASE = 'https://gw2c-hw-open.longfor.com';
const API_KEY_MEMBER = '98717e7a-a039-46af-8143-be7558a089c0';
const BU_CODE = 'C20400';
const CHANNEL = 'C2';
const API_VERSION = 'v2_6_0';
const UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/144.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI ' +
    'MiniProgramEnv/Mac MacWechat/WMPF MacWechat/3.8.7(0x13080712) ' +
    'UnifiedPCMacWechat(0xf2641d55) XWEB/25561';

// 青龙连接信息只从环境变量取 —— 仓库里不留任何人的地址与密码
const QL_URL = String(process.env.QL_URL || '').trim();
const QL_USER = String(process.env.QL_USER || '').trim();
const QL_PASS = String(process.env.QL_PASS || '');

const ENV_NAME = 'longhu_token';
const PROJ = path.join(__dirname, '..');
const OUT_JSON = path.join(PROJ, 'longhu_token.json');

const args = process.argv.slice(2);
const DEPLOY = args.includes('--deploy');
const DRY = args.includes('--dry');
const argIn = args.find((a) => !a.startsWith('--'));

// ---------------------------------------------------------------- 小工具

const maskToken = (t) => {
    const s = String(t || '');
    return s.length <= 10 ? s.slice(0, 2) + '****' : s.slice(0, 6) + '****' + s.slice(-4);
};

function req(opts) {
    return new Promise((resolve, reject) => {
        const u = new URL(opts.url);
        const lib = u.protocol === 'https:' ? https : http;
        const headers = Object.assign({}, opts.headers || {});
        let body = null;
        if (opts.data !== undefined && opts.data !== null) {
            body = Buffer.from(typeof opts.data === 'string' ? opts.data : JSON.stringify(opts.data), 'utf8');
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = body.length;
        }
        const r = lib.request(
            {
                protocol: u.protocol,
                hostname: u.hostname,
                port: u.port || (u.protocol === 'https:' ? 443 : 80),
                path: u.pathname + u.search,
                method: opts.method || 'GET',
                headers: headers,
                timeout: 20000,
            },
            (res) => {
                const cs = [];
                res.on('data', (c) => cs.push(c));
                res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(cs).toString('utf8') }));
            }
        );
        r.on('timeout', () => r.destroy(new Error('请求超时')));
        r.on('error', reject);
        if (body) r.write(body);
        r.end();
    });
}

// ---------------------------------------------------------------- 找输入

function findInput() {
    if (argIn) {
        // 直接传了一行 cURL 文本
        if (/^(curl|git|wget)\s/i.test(argIn.trim())) return { kind: 'text', value: argIn };
        if (!fs.existsSync(argIn)) throw new Error('文件不存在：' + argIn);
        return { kind: 'file', value: fs.readFileSync(argIn, 'utf8') };
    }
    const dirs = [process.cwd(), __dirname, PROJ, path.join(PROJ, '..')];
    const cands = [];
    for (const d of dirs) {
        let ents = [];
        try {
            ents = fs.readdirSync(d, { withFileTypes: true });
        } catch (e) {
            continue;
        }
        for (const e of ents) {
            if (!e.isFile()) continue;
            if (!/\.(har|json|txt)$/i.test(e.name)) continue;
            const p = path.join(d, e.name);
            if (cands.indexOf(p) < 0) cands.push(p);
        }
    }
    const pick = cands.find((p) => /龙湖|longhu|longfor/i.test(p)) || cands.find((p) => /\.har$/i.test(p));
    if (!pick) throw new Error('没找到 .har / curl.txt，请把路径作为第一个参数传进来');
    return { kind: 'file', value: fs.readFileSync(pick, 'utf8'), path: pick };
}

// ---------------------------------------------------------------- 抠 token

const TOKEN_RE = /^[0-9a-fA-F]{32}$/;

/**
 * 从 HAR 或 cURL 文本里收集候选 token
 * @returns {Map<string, {token:string, at:number, how:string}>}
 */
function extract(input) {
    const hits = new Map();
    const add = (raw, at, how) => {
        let tk = String(raw || '').trim().replace(/^["']|["']$/g, '').replace(/^(bearer|wechat)\s+/i, '');
        if (!tk) return;
        // 只收 32 位十六进制（龙湖 token 的形态）；其他长度也收但排在后面
        const score = TOKEN_RE.test(tk) ? 2 : /^[0-9a-zA-Z_-]{16,64}$/.test(tk) ? 1 : 0;
        if (!score) return;
        const prev = hits.get(tk);
        if (!prev || at > prev.at || score > prev.score) hits.set(tk, { token: tk, at: at, how: how, score: score });
    };

    let har = null;
    try {
        har = JSON.parse(input.value);
    } catch (e) {
        har = null;
    }

    if (har && har.log && Array.isArray(har.log.entries)) {
        for (const e of har.log.entries) {
            const url = (e.request && e.request.url) || '';
            const at = Date.parse(e.startedDateTime || '') || 0;
            const isLh = /longfor\.com|longhu/i.test(url);
            for (const h of (e.request && e.request.headers) || []) {
                const name = String(h.name || '').toLowerCase();
                if (isLh && /^(x-lf-usertoken|lmtoken|token)$/.test(name) && h.value) {
                    add(h.value, at, '请求头 ' + h.name);
                }
            }
            const rc = e.response && e.response.content;
            if (rc && rc.text && isLh) {
                let txt = rc.text;
                if (rc.encoding === 'base64') {
                    try {
                        txt = Buffer.from(txt, 'base64').toString('utf8');
                    } catch (err) {
                        /* ignore */
                    }
                }
                const re = /"(?:token|lmToken)"\s*:\s*"([^"]{16,64})"/g;
                let m;
                while ((m = re.exec(txt))) add(m[1], at, '响应体 ' + url.split('?')[0].slice(-40));
            }
        }
        return hits;
    }

    // cURL 文本：-H 'X-LF-UserToken: xxx'
    const text = String(input.value);
    const reH = /(?:^|\s)(?:-H|--header)\s+['"]([^'"]+)['"]/g;
    let m;
    while ((m = reH.exec(text))) {
        const kv = m[1].split(':');
        const name = String(kv[0] || '').trim().toLowerCase();
        const val = kv.slice(1).join(':').trim();
        if (/^(x-lf-usertoken|lmtoken|token)$/.test(name)) add(val, Date.now(), 'cURL 请求头 ' + name);
    }
    // 裸 token：整段文本里唯一的 32 位十六进制
    const reT = /\b[0-9a-fA-F]{32}\b/g;
    while ((m = reT.exec(text))) add(m[0], Date.now(), '文本里的 32 位十六进制');
    return hits;
}

// ---------------------------------------------------------------- 校验

async function verify(token) {
    const h = {
        'User-Agent': UA,
        lmToken: token,
        'X-Gaia-Api-Key': API_KEY_MEMBER,
        'X-LF-Bucode': BU_CODE,
        'X-LF-Channel': CHANNEL,
        'X-LF-Api-Version': API_VERSION,
        'Content-Type': 'application/json',
    };
    try {
        const r = await req({ url: BASE + '/supera/member/api/bff/pages/' + API_VERSION + '/v1/user-info', headers: h });
        let j;
        try {
            j = JSON.parse(r.text);
        } catch (e) {
            j = { code: 'BADJSON', message: r.text.slice(0, 120) };
        }
        if (String(j.code) !== '0000') return { ok: false, code: String(j.code), msg: j.message || '' };
        const d = j.data || {};
        return {
            ok: true,
            phone: d.desensitizePhone || '',
            nick: d.nickName || d.nickname || '',
            growth: Number(d.growthValue || 0),
            level: d.levelName || '',
        };
    } catch (e) {
        return { ok: false, msg: '网络异常：' + e.message };
    }
}

// ---------------------------------------------------------------- 青龙

async function qlLogin() {
    const miss = [];
    if (!QL_URL) miss.push('QL_URL');
    if (!QL_USER) miss.push('QL_USER');
    if (!QL_PASS) miss.push('QL_PASS');
    if (miss.length) {
        throw new Error('--deploy 需要设置环境变量：' + miss.join(' / ')
            + '（例：QL_URL=http://127.0.0.1:5700 QL_USER=admin QL_PASS=你的密码）');
    }
    const r = await req({ url: QL_URL + '/api/user/login', method: 'POST', data: { username: QL_USER, password: QL_PASS } });
    const j = JSON.parse(r.text);
    if (j.code !== 200) throw new Error('青龙登录失败：' + (j.message || r.text.slice(0, 120)));
    return j.data.token;
}

async function ql(method, apiPath, token, body) {
    const r = await req({ url: QL_URL + apiPath, method: method, headers: { Authorization: 'Bearer ' + token }, data: body });
    try {
        return JSON.parse(r.text);
    } catch (e) {
        return { code: -1, _raw: r.text.slice(0, 200) };
    }
}

function rows(resp) {
    const d = resp && resp.data;
    if (Array.isArray(d)) return d.filter((x) => x && typeof x === 'object');
    if (d && Array.isArray(d.data)) return d.data.filter((x) => x && typeof x === 'object');
    return [];
}

/** 合并进 longhu_token：同 token 覆盖、不同 token 追加，行格式 备注#token */
async function deployToQL(accounts) {
    const tk = await qlLogin();
    const list = rows(await ql('GET', '/api/envs?searchValue=' + ENV_NAME, tk));
    const cur = list.find((e) => e.name === ENV_NAME);

    const byToken = new Map();
    if (cur && cur.value) {
        for (const ln of String(cur.value).split(/\n+/)) {
            const s = ln.trim();
            if (!s || s.charAt(0) === '#') continue;
            const seg = s.split('#').map((x) => x.trim());
            const token = seg.length >= 2 ? seg[1] : seg[0];
            if (!token) continue;
            byToken.set(token, s);
        }
    }
    for (const a of accounts) {
        const label = a.phone || maskToken(a.token);
        // 已有行若备注相同也覆盖，避免同一个号攒出多行
        for (const [k, v] of Array.from(byToken.entries())) {
            if (v.split('#')[0].trim() === label) byToken.delete(k);
        }
        byToken.set(a.token, label + '#' + a.token);
    }
    const lines = Array.from(byToken.values());
    const value = lines.join('\n');

    console.log('');
    console.log('将写入青龙变量 ' + ENV_NAME + '（' + lines.length + ' 行）：');
    for (const ln of lines) {
        const seg = ln.split('#');
        console.log('   ' + seg[0] + '  ->  ' + maskToken(seg[1]));
    }
    if (DRY) {
        console.log('');
        console.log('（--dry：未真正写入）');
        return true;
    }

    let r;
    if (cur) {
        r = await ql('PUT', '/api/envs', tk, { id: cur.id, name: ENV_NAME, value: value, remarks: '龙湖天街 token，备注#token 每行一个' });
    } else {
        r = await ql('POST', '/api/envs', tk, [{ name: ENV_NAME, value: value, remarks: '龙湖天街 token，备注#token 每行一个' }]);
    }
    const ok = r.code === 200;
    console.log('');
    console.log((ok ? '✅' : '❌') + ' 青龙变量写入' + (ok ? '成功' : '失败：' + JSON.stringify(r).slice(0, 200)));
    return ok;
}

// ---------------------------------------------------------------- 主流程

async function main() {
    console.log('');
    console.log('  ' + '─'.repeat(56));
    console.log('    🏬 龙湖天街 · token 抓取器');
    console.log('  ' + '─'.repeat(56));

    const input = findInput();
    if (input.path) console.log('   输入：' + input.path);
    const hits = extract(input);
    const cands = Array.from(hits.values()).sort((a, b) => b.score - a.score || b.at - a.at);

    if (!cands.length) {
        console.log('');
        console.log('   ❌ 没在输入里找到疑似 token。');
        console.log('      请确认抓的是发往 gw2c-hw-open.longfor.com 的请求，');
        console.log('      并且 HAR 里保留了请求头（有的抓包工具默认不存 Cookie/自定义头）。');
        return;
    }

    console.log('');
    console.log('   找到 ' + cands.length + ' 个候选，逐个校验：');
    const good = [];
    for (const c of cands) {
        const v = await verify(c.token);
        if (v.ok) {
            console.log('   ✅ ' + maskToken(c.token) + '   ' + (v.phone || '') + '   ' + (v.nick || '珑珠用户') +
                '   成长值 ' + v.growth + (v.level ? '   等级 ' + v.level : '') + '   [' + c.how + ']');
            good.push({ token: c.token, phone: v.phone, nick: v.nick, growth: v.growth, level: v.level, how: c.how });
        } else {
            console.log('   ✖  ' + maskToken(c.token) + '   不可用：' + (v.msg || 'code=' + v.code) + '   [' + c.how + ']');
        }
    }

    if (!good.length) {
        console.log('');
        console.log('   ❌ 候选全部校验失败。多半是 HAR 里的 token 已经过期（30 天），');
        console.log('      重新在 App / 小程序里进一次会员中心再抓一条即可。');
        return;
    }

    const payload = {
        accounts: good,
        source: input.path || 'curl/text',
        savedAt: new Date().toISOString(),
    };
    try {
        fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), 'utf8');
        console.log('');
        console.log('   💾 已落盘：' + OUT_JSON);
    } catch (e) {
        console.log('');
        console.log('   ⚠️  落盘失败：' + e.message);
    }

    if (DEPLOY) {
        await deployToQL(good);
    } else {
        console.log('');
        console.log('   下一步：');
        console.log('     ① 加 --deploy 直接写青龙：node grab_longhu_token.js <har> --deploy');
        console.log('     ② 或者手工贴到青龙变量 ' + ENV_NAME + '，格式：');
        for (const a of good) console.log('        ' + (a.phone || maskToken(a.token)) + '#' + a.token);
    }
    console.log('');
}

main().catch((e) => {
    console.log('脚本异常：' + (e && e.stack ? e.stack : e));
    process.exit(1);
});
