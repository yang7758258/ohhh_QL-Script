#!/usr/bin/env node
/* -------------------------------------------------------------------------
 *  项目名称：活力伊利（access-token 提取）
 *  脚本文件：grab_yili_ck.js
 *  更新说明：
 *    2026-11-14  Mist  仓库首发：从 HAR / cURL 抠 access-token，可写青龙
 *                青龙连接信息只从环境变量 QL_URL/QL_USER/QL_PASS 读
 * -------------------------------------------------------------------------
 */
/**
 * grab_yili_ck.js —— 从 HAR / cURL 里把「活力伊利」的 access-token 抠出来
 *
 *   用法：
 *     node grab_yili_ck.js <xxx.har>                 只提取 + 落盘 yili_token.json
 *     node grab_yili_ck.js <xxx.har> --deploy         提取后自动写入青龙环境变量
 *     node grab_yili_ck.js --curl "<curl 命令文本>"   从 cURL 里抠
 *
 *   产出：<项目根>/yili_token.json   [{ token, remark, nick, mobile, at }]
 *   青龙侧只写一个变量：yili_ck（多账号换行，支持「备注#token」）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const HOST = 'msmarket.msx.digitalyili.com';
const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/144.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI ' +
    'MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) ' +
    'UnifiedPCWindowsWechat(0xf2541f38) XWEB/25819';

// 青龙连接信息只从环境变量读 —— 仓库里不留任何人的地址、账号、密码
const QL = {
    base: String(process.env.QL_URL || '').replace(/\/+$/, ''),
    user: String(process.env.QL_USER || ''),
    pass: String(process.env.QL_PASS || ''),
};

function needQL() {
    const miss = [];
    if (!QL.base) miss.push('QL_URL');
    if (!QL.user) miss.push('QL_USER');
    if (!QL.pass) miss.push('QL_PASS');
    if (miss.length) {
        console.error('[x] --deploy 需要设置环境变量：' + miss.join(' / '));
        console.error('    例：QL_URL=http://127.0.0.1:5700 QL_USER=admin QL_PASS=你的密码');
        process.exit(1);
    }
}

function readHar(file) {
    const har = JSON.parse(fs.readFileSync(file, 'utf8'));
    const set = new Set();
    for (const e of (har.log && har.log.entries) || []) {
        const url = (e.request && e.request.url) || '';
        if (!url.includes(HOST)) continue;
        for (const h of (e.request.headers || [])) {
            if (String(h.name).toLowerCase() === 'access-token' && h.value && h.value.length > 40) {
                set.add(String(h.value).trim());
            }
        }
    }
    return [...set];
}

function fromCurl(text) {
    const m = text.match(/access-token:\s*([^\s'"\\,]+)/i);
    return m ? [m[1].trim()] : [];
}

const baseHeaders = (token) => ({
    'access-token': token,
    'tenant-id': '1559474730809618433',
    scene: '1256',
    'content-type': 'application/json',
    accept: '*/*',
    'user-agent': UA,
    'atv-page': encodeURIComponent('pages/index/index'),
    'forward-appid': '',
    'source-type': '',
    'register-source': '',
    xweb_xhr: '1',
    referer: 'https://servicewechat.com/wx06af0ef532292cd3/928/page-frame.html',
});

function probe(token, apiPath) {
    return new Promise((resolve) => {
        const req = https.request(
            { host: HOST, path: '/gateway/api' + apiPath, method: 'GET', headers: baseHeaders(token) },
            (res) => {
                let b = '';
                res.on('data', (c) => (b += c));
                res.on('end', () => {
                    try { resolve(JSON.parse(b)); } catch (e) { resolve(null); }
                });
            }
        );
        req.on('error', () => resolve(null));
        req.setTimeout(12000, () => { req.destroy(); resolve(null); });
        req.end();
    });
}

function qlPost(p, body, token) {
    const data = JSON.stringify(body);
    const headers = { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) };
    if (token) headers.authorization = 'Bearer ' + token;
    return new Promise((resolve) => {
        const u = new URL(QL.base + p);
        const req = require('http').request(
            { host: u.hostname, port: u.port, path: u.pathname + u.search, method: 'POST', headers },
            (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { resolve({ raw: b }); } }); }
        );
        req.on('error', (e) => resolve({ err: e.message }));
        req.setTimeout(15000, () => { req.destroy(); resolve({ err: 'timeout' }); });
        req.write(data);
        req.end();
    });
}

function qlPut(p, body, token) {
    const data = body === undefined ? '' : JSON.stringify(body);
    const headers = { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) };
    if (token) headers.authorization = 'Bearer ' + token;
    return new Promise((resolve) => {
        const u = new URL(QL.base + p);
        const req = require('http').request(
            { host: u.hostname, port: u.port, path: u.pathname + u.search, method: 'PUT', headers },
            (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { resolve({ raw: b }); } }); }
        );
        req.on('error', (e) => resolve({ err: e.message }));
        req.setTimeout(15000, () => { req.destroy(); resolve({ err: 'timeout' }); });
        if (data) req.write(data);
        req.end();
    });
}

function qlGet(p, token) {
    return new Promise((resolve) => {
        const u = new URL(QL.base + p);
        const headers = {};
        if (token) headers.authorization = 'Bearer ' + token;
        const req = require('http').request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET', headers }, (res) => {
            let b = '';
            res.on('data', (c) => (b += c));
            res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { resolve({ raw: b }); } });
        });
        req.on('error', (e) => resolve({ err: e.message }));
        req.end();
    });
}

async function deploy(accounts) {
    needQL();
    const lg = await qlPost('/api/user/login', { username: QL.user, password: QL.pass });
    if (!lg || !lg.data || !lg.data.token) {
        console.log('[青龙] 登录失败：' + JSON.stringify(lg).slice(0, 200));
        return false;
    }
    const tk = lg.data.token;
    const value = accounts.map((a) => (a.remark ? a.remark + '#' : '') + a.token).join('\n');
    const found = await qlGet('/api/envs?searchValue=yili_ck', tk);
    const list = ((found.data && found.data.data) || found.data || []).filter((x) => x && x.name === 'yili_ck');
    if (list.length) {
        const r = await qlPut('/api/envs', { id: list[0].id, name: 'yili_ck', value, remarks: '活力伊利 access-token' }, tk);
        console.log('[青龙] 更新 yili_ck → ' + (r.code === 200 ? 'OK' : JSON.stringify(r).slice(0, 120)));
    } else {
        const r = await qlPost('/api/envs', [{ name: 'yili_ck', value, remarks: '活力伊利 access-token' }], tk);
        console.log('[青龙] 新建 yili_ck → ' + (r.code === 200 ? 'OK' : JSON.stringify(r).slice(0, 120)));
    }
    return true;
}

(async () => {
    const args = process.argv.slice(2);
    let tokens = [];
    const curlIdx = args.indexOf('--curl');
    if (curlIdx !== -1) {
        tokens = fromCurl(args[curlIdx + 1] || '');
    } else {
        const file = args.find((a) => !a.startsWith('--'));
        if (!file) {
            console.log('用法: node grab_yili_ck.js <xxx.har> [--deploy]');
            process.exit(1);
        }
        tokens = readHar(path.resolve(file));
    }
    tokens = [...new Set(tokens)];
    if (!tokens.length) {
        console.log('✗ 没在 HAR 里找到 access-token（确认抓的是 msmarket.msx.digitalyili.com 的请求）');
        process.exit(2);
    }
    console.log('找到 ' + tokens.length + ' 个 access-token，逐个验证：');
    const accounts = [];
    for (const t of tokens) {
        const info = await probe(t, '/auth/account/user/info');
        if (info && info.status === true && info.data) {
            const a = {
                token: t,
                remark: info.data.nickName || '',
                nick: info.data.nickName || '',
                mobile: String(info.data.mobile || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2'),
                at: new Date().toISOString(),
            };
            accounts.push(a);
            console.log('  ✓ ' + a.nick + '  ' + a.mobile + '  (token ' + t.length + ' 字符)');
        } else {
            console.log('  ✗ 无效/过期：' + String(t).slice(0, 12) + '…  ' + JSON.stringify(info && info.error));
        }
    }
    if (!accounts.length) {
        console.log('全部无效，重抓一次（小程序里随便点两下再抓）');
        process.exit(2);
    }
    const out = path.join(__dirname, '..', 'yili_token.json');
    fs.writeFileSync(out, JSON.stringify(accounts, null, 2), 'utf8');
    console.log('已写：' + out);
    if (args.includes('--deploy')) await deploy(accounts);
})();
