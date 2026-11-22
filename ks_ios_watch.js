/* -------------------------------------------------------------------------
 *  项目名称：快手极速版（看视频赚金币 · iOS 网关入口）
 *  脚本文件：ks_ios_watch.js
 *  更新说明：
 *    2026-11-22  Mist  仓库首发：定时调 iPad 网关自动上滑，App 真实播放
 * -------------------------------------------------------------------------
 *  Author : Mist
 *  声明   : 仅供个人学习与技术研究，仅用于自己有权操作的账号，风险自负
 * -------------------------------------------------------------------------
 */
'use strict';
const http = require('http');
const https = require('https');

function env(k, d) { const v = process.env[k]; return v === undefined || v === '' ? d : String(v); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const GW = env('ks_gw', '').replace(/\/+$/, '');
const N = Math.max(1, Number(env('ks_watch_n', '6')) || 6);
const DWELL = Math.max(10, Number(env('ks_watch_dwell', '45')) || 45);

function call(method, path, body) {
  return new Promise((resolve) => {
    if (!GW) return resolve({ err: 'ks_gw 未配置' });
    let u;
    try { u = new URL(GW + path); } catch (e) { return resolve({ err: 'ks_gw 格式错: ' + GW }); }
    const mod = u.protocol === 'https:' ? https : http;
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = mod.request({
      hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''), method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, data ? { 'Content-Length': data.length } : {}),
      timeout: 30000,
    }, (res) => {
      const cs = [];
      res.on('data', c => cs.push(c));
      res.on('end', () => {
        const t = Buffer.concat(cs).toString('utf8');
        try { resolve(JSON.parse(t)); } catch (e) { resolve({ raw: t.slice(0, 200) }); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ err: 'timeout' }); });
    req.on('error', e => resolve({ err: e.message }));
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  console.log('');
  console.log('  ────────────────────────────────────────────');
  console.log('    📺 快手极速版 · 自动刷视频（iOS 网关）');
  console.log('  ────────────────────────────────────────────');
  console.log('    网关:', GW || '未配置');
  console.log('    计划:', N, '个视频 ×', DWELL, '秒');
  console.log('');

  if (!GW) {
    console.log('  ⚠️  没配 ks_gw，跳过');
    return;
  }

  const h = await call('GET', '/health');
  if (!h.ok) {
    console.log('  ✗ 网关不通:', JSON.stringify(h));
    return;
  }
  console.log('  ✓ 网关在线 pid=' + h.pid + ' App状态=' + h.state + '（0=前台 2=后台）');

  await call('POST', '/home', {});
  console.log('  ✓ 已切回首页视频流');
  await sleep(2500);

  let ok = 0;
  for (let i = 1; i <= N; i++) {
    const r = await call('POST', '/swipe', {});
    if (r.ok) { ok++; console.log(`  ↑ 上滑 ${i}/${N}`); }
    else console.log(`  ✗ 上滑 ${i} 失败: ${JSON.stringify(r)}`);
    if (i < N) await sleep(DWELL * 1000);
  }

  console.log('');
  console.log(`  📊 完成 ${ok}/${N} 次上滑`);
  console.log('    收益要在下一轮 HTTP 脚本里领（宝箱/任务卡），这里只负责攒进度');
  console.log('');
})().catch(e => { console.error('异常:', e && e.message); process.exit(1); });
