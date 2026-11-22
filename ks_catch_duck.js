/* -------------------------------------------------------------------------
 *  项目名称：快手极速版（抓鸭子 · 纯接口）
 *  脚本文件：ks_catch_duck.js
 *  更新说明：
 *    2026-11-22  Mist  仓库首发：init 拿 roundId → report 上报，不用真玩
 * -------------------------------------------------------------------------
 *  Author : Mist
 *  声明   : 仅供个人学习与技术研究，仅用于自己有权操作的账号，风险自负
 * -------------------------------------------------------------------------
 */
'use strict';
const https = require('https');
const zlib = require('zlib');

const CK = (process.env.ks_ck || process.env.KS_CK || '').trim();
const ON = (process.env.ks_duckchase || 'on').toLowerCase() !== 'off';

const H_GAME = 'ppg.viviv.com';
const H_READ = 'nebula.kuaishou.com';
const API = '/rest/activity/game/common/';
const UA = 'Mozilla/5.0 (iPad; CPU OS 16_2 like Mac OS X) AppleWebKit/605.1.15 ' +
           '(KHTML, like Gecko) Mobile/15E148 ksNebula/14.10.30.4489';

const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', d: '\x1b[90m', x: '\x1b[0m' };
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function req(host, path, method, body, extraHdr) {
  return new Promise((resolve) => {
    const buf = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const h = Object.assign({
      Cookie: CK,
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'User-Agent': UA,
      Origin: 'https://' + host,
      Referer: 'https://' + host + '/',
    }, extraHdr || {});
    if (buf) { h['Content-Type'] = 'application/json'; h['Content-Length'] = buf.length; }
    const r = https.request({ hostname: host, port: 443, path, method, headers: h, timeout: 25000 }, (res) => {
      const cs = [];
      res.on('data', (c) => cs.push(c));
      res.on('end', () => {
        let b = Buffer.concat(cs);
        const enc = (res.headers['content-encoding'] || '').toLowerCase();
        try {
          if (enc.includes('gzip')) b = zlib.gunzipSync(b);
          else if (enc.includes('deflate')) b = zlib.inflateSync(b);
          else if (enc.includes('br')) b = zlib.brotliDecompressSync(b);
        } catch (e) {}
        const txt = b.toString('utf8');
        let json = null;
        try { json = JSON.parse(txt); } catch (e) {}
        resolve({ status: res.statusCode, text: txt, json });
      });
    });
    r.on('timeout', () => { r.destroy(); resolve({ err: 'timeout' }); });
    r.on('error', (e) => resolve({ err: e.message }));
    if (buf) r.write(buf);
    r.end();
  });
}

const M = {
  100000102: '今日免费次数已用完',
  1: null,
};

(async () => {
  log('');
  log('  ' + C.d + '──────────────────────────────────────────────' + C.x);
  log('    🎯 快手极速版 · 抓鸭子赚鸭蛋');
  log('  ' + C.d + '──────────────────────────────────────────────' + C.x);

  if (!CK) { log('  ' + C.r + '✗' + C.x + '  ks_ck 未配置'); return; }
  if (!ON) { log('  ' + C.y + '⏸' + C.x + '  ks_duckchase=off，跳过'); return; }

  // ── 1. 查状态（nebula 域，免签）
  const st = await req(H_READ, '/rest/n/encourage/game/luckyDuck/catchDuck/statusRefresh', 'GET');
  if (!st.json || st.json.result !== 1) {
    log('  ' + C.r + '✗' + C.x + '  查状态失败: ' + String(st.text || st.err).slice(0, 100));
    return;
  }
  const d = st.json.data || {};
  const free = Number(d.freeTimes || 0);
  log('  ' + C.d + '状态' + C.x + '  今日 ' + (d.playTimes || 0) + '/' + (d.totalFreeTimes || 3) +
      ' 次，剩 ' + C.y + free + C.x + ' 次  鸭鸭币 ' + (d.gameCoinsAmount || 0));

  if (free <= 0) {
    log('  ' + C.y + '·' + C.x + '  今日免费次数用完，跳过');
    log('');
    return;
  }

  // ── 2. 每一把：init → heartbeat → report/duck → report/other
  let ok = 0;
  for (let i = 1; i <= free; i++) {
    const init = await req(H_GAME, API + 'catch-duck/v2/init', 'POST', {
      requestId: String(Date.now()), acId: 'growth', gameId: 100, gameVersion: '1.0.3',
    });
    const ij = init.json || {};
    if (ij.result !== 1) {
      log('  ' + C.r + '✗' + C.x + '  第 ' + i + ' 把 init: [' + ij.result + '] ' + (ij.message || ij.error_msg || ''));
      break;
    }
    const dd = ij.data || {};
    const roundId = dd.roundId || dd.round_id;
    const token = dd.reportToken || dd.report_token;
    if (!roundId || !token) {
      log('  ' + C.y + '·' + C.x + '  init 未下发 roundId/reportToken（可能需真实游戏会话）');
      log('      ' + C.d + JSON.stringify(dd).slice(0, 180) + C.x);
      break;
    }

    await sleep(900);
    await req(H_GAME, API + 'heartbeat', 'POST', { acId: 'growth', gameId: 100, gameVersion: '1.0.3' });
    await sleep(700);

    const rd = await req(H_GAME, API + 'catch-duck/v2/report/duck', 'POST', {
      roundId, level: 1, reportToken: token, leftTimeMs: 470000,
      acId: 'growth', gameId: 100, gameVersion: '1.0.3',
    });
    await sleep(700);
    const ro = await req(H_GAME, API + 'catch-duck/v2/report/other', 'POST', {
      roundId, level: 2, leftTimeMs: 450000, catchOtherGroupNum: 10,
      acId: 'growth', gameId: 100, gameVersion: '1.0.3',
    });

    const r1 = (rd.json || {}).result;
    const r2 = (ro.json || {}).result;
    const good = r1 === 1 || r1 === 0 || r2 === 1;
    if (good) { ok++; log('  ' + C.g + '✓' + C.x + '  第 ' + i + ' 把上报成功  round=' + String(roundId).slice(0, 12) + '…'); }
    else log('  ' + C.y + '·' + C.x + '  第 ' + i + ' 把  duck=' + r1 + '  other=' + r2);
    await sleep(1200);
  }

  // ── 3. 复查
  const st2 = await req(H_READ, '/rest/n/encourage/game/luckyDuck/catchDuck/statusRefresh', 'GET');
  const d2 = (st2.json || {}).data || {};
  if (d2.totalFreeTimes) {
    log('');
    log('  ' + C.d + '结果' + C.x + '  ' + (d2.playTimes || 0) + '/' + d2.totalFreeTimes +
        ' 次已用，剩 ' + (d2.freeTimes || 0) + ' 次  鸭鸭币 ' + (d2.gameCoinsAmount || 0) +
        '  ' + C.d + '(1000 币 = 1 颗鸭蛋)' + C.x);
  }
  log('  ' + C.d + '完成' + C.x + '  ' + ok + '/' + free + ' 把上报成功');
  log('');
})().catch((e) => { console.error('异常:', e && e.message); process.exit(1); });
