/* -------------------------------------------------------------------------
 *  项目名称：快手极速版（招财鸭 · Playwright）
 *  脚本文件：ks_duck_signin.js
 *  更新说明：
 *    2026-11-22  Mist  仓库首发：签到 / 喂食 / 领奖 / 饲料仓 / 饲料雨全自动
 * -------------------------------------------------------------------------
 *  Author : Mist
 *  声明   : 仅供个人学习与技术研究，仅用于自己有权操作的账号，风险自负
 * -------------------------------------------------------------------------
 */
'use strict';
const fs = require('fs');
const path = require('path');

const URL_HOME = 'https://nebula.kuaishou.com/games/lucky-duck/home?layoutType=4&source=TASK';
const API = '/rest/n/encourage/game/luckyDuck/';
const CK = (process.env.ks_ck || '').trim();

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function parseCookie(s) {
  return s.split(';').map((x) => x.trim()).filter(Boolean).map((x) => {
    const i = x.indexOf('=');
    if (i <= 0) return null;
    return { name: x.slice(0, i).trim(), value: x.slice(i + 1).trim(), domain: '.kuaishou.com', path: '/' };
  }).filter(Boolean);
}

/** 探测可用浏览器：返回 { path, source } 或 null */
function detectBrowser() {
  const { execSync } = require('child_process');
  const cands = [];

  // 1) 环境变量优先
  ['CHROME_PATH', 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH', 'CHROMIUM_PATH'].forEach((k) => {
    if (process.env[k]) cands.push([process.env[k], 'env:' + k]);
  });

  // 2) which / command -v 动态查找（容器里最可靠）
  ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome', 'msedge'].forEach((bin) => {
    try {
      const p = String(execSync('command -v ' + bin + ' 2>/dev/null || which ' + bin + ' 2>/dev/null', { encoding: 'utf8' })).trim();
      if (p && p.indexOf('\n') < 0) cands.push([p, 'which:' + bin]);
    } catch (e) {}
  });

  // 3) 常见安装路径
  [
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable', '/usr/lib/chromium/chromium',
    '/usr/lib/chromium-browser/chromium-browser', '/snap/bin/chromium',
    '/opt/google/chrome/chrome', '/opt/chromium/chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].forEach((p) => cands.push([p, 'path']));

  // 4) find 兜底（限深度，避免卡死）
  try {
    const out = String(execSync('find /usr /opt /snap -maxdepth 4 -type f -name "chromium" -o -maxdepth 4 -type f -name "chrome" -o -maxdepth 4 -type f -name "chrome-headless-shell" 2>/dev/null | head -5', { encoding: 'utf8', timeout: 8000 }));
    out.split('\n').map((s) => s.trim()).filter(Boolean).forEach((p) => cands.push([p, 'find']));
  } catch (e) {}

  // 5) playwright 自带缓存（任意版本）
  const caches = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.env.HOME ? path.join(process.env.HOME, '.cache', 'ms-playwright') : '',
    '/root/.cache/ms-playwright',
  ].filter(Boolean);
  for (const cache of caches) {
    try {
      if (!fs.existsSync(cache)) continue;
      for (const d of fs.readdirSync(cache)) {
        for (const rel of ['chrome-linux/chrome', 'chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux64/chrome']) {
          const fp = path.join(cache, d, rel);
          if (fs.existsSync(fp)) cands.push([fp, 'pw:' + d]);
        }
      }
    } catch (e) {}
  }

  // 去重 + 存在性检查
  const seen = new Set();
  for (const [p, src] of cands) {
    if (!p || seen.has(p)) continue;
    seen.add(p);
    try {
      if (fs.existsSync(p)) {
        try { fs.accessSync(p, fs.constants.X_OK); } catch (e) { continue; }
        return { path: p, source: src };
      }
    } catch (e) {}
  }
  return null;
}

(async () => {
  log('');
  log('  ────────────────────────────────────────────');
  log('    🦆 快手极速版 · 招财鸭');
  log('  ────────────────────────────────────────────');

  if (!CK) { log('  ⚠️  ks_ck 未配置'); return; }
  if ((process.env.ks_duck_on || 'on') === 'off') { log('  ⏸  ks_duck_on=off'); return; }

  let chromium = null;
  for (const m of ['playwright', 'playwright-core']) {
    try { chromium = require(m).chromium; break; } catch (e) {}
  }
  if (!chromium) {
    log('  ✗ 缺少 playwright 库');
    log('     青龙容器内执行：npm install playwright');
    return;
  }

  const found = detectBrowser();
  const opt = {
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
           '--disable-blink-features=AutomationControlled', '--disable-setuid-sandbox'],
  };
  if (found) {
    opt.executablePath = found.path;
    log('  浏览器 ' + found.source + '  ' + found.path);
  } else {
    log('  ' + '⚠️'.repeat(1) + ' 未探测到浏览器，尝试 playwright 默认路径…');
    log('     如果失败，容器内执行以下之一：');
    log('       npx playwright install chromium --with-deps');
    log('       apt install -y chromium && export CHROME_PATH=/usr/bin/chromium');
  }

  let browser;
  try {
    browser = await chromium.launch(opt);
  } catch (e) {
    const msg = String(e && e.message || e);
    log('');
    log('  ✗ 浏览器启动失败');
    log('    ' + msg.split('\n')[0].slice(0, 160));
    log('');
    log('  ' + '─'.repeat(50));
    log('  青龙容器内执行下面任一方案：');
    log('');
    log('  方案 A（官方，约 300 MB）');
    log('    npx playwright install chromium --with-deps');
    log('');
    log('  方案 B（系统 chromium，约 100 MB）');
    log('    apt-get update && apt-get install -y chromium fonts-wqy-zenhei');
    log('    export CHROME_PATH=/usr/bin/chromium');
    log('  ' + '─'.repeat(50));
    return;
  }

  try {
    const ctx = await browser.newContext({
      viewport: { width: 800, height: 1400 },
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_2 like Mac OS X) AppleWebKit/605.1.15 ' +
                 '(KHTML, like Gecko) Mobile/15E148 ksNebula/14.10.30.4489',
      locale: 'zh-CN',
    });
    await ctx.addCookies(parseCookie(CK));
    const page = await ctx.newPage();
    await page.goto(URL_HOME, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(5000);
    log('  页面 ' + page.url().slice(0, 78));
    if (page.url().indexOf('login') >= 0) { log('  ✗ Cookie 失效'); return; }

    // 1 签到
    const sign = await page.evaluate(async (api) => {
      try {
        const r = await fetch(api + 'signIn/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        return await r.text();
      } catch (e) { return 'ERR ' + e; }
    }, API);
    let sj = null; try { sj = JSON.parse(sign); } catch (e) {}
    if (sj && sj.result === 1) log('  ✓ 签到成功  +' + ((sj.data && sj.data.amount) || 0));
    else if (sj && sj.result === 102802) log('  · 今天已签到');
    else log('  ✗ 签到 ' + sign.slice(0, 100));
    await sleep(1200);

    // 2 签到日历
    try {
      const t = await page.evaluate(async (api) => {
        const r = await fetch(api + 'signIn/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        return await r.text();
      }, API);
      const list = ((JSON.parse(t).data) || {}).awardList || [];
      if (list.length) {
        log('  📅 签到日历 ' + list.map((a) => (a.signed ? '✓' : '·') + a.rewardAmount).join(' '));
      }
    } catch (e) {}

    // 3 收饲料仓
    try {
      const g = await page.evaluate(async (api) => {
        const r = await fetch(api + 'feedGranaryInfo');
        return await r.text();
      }, API);
      const gd = JSON.parse(g).data || {};
      if (gd.fodderAmount > 0) {
        const left = Math.max(0, (gd.produceTotalTime || 0) - (gd.produceCostTime || 0));
        if (left <= 0) {
          const c = await page.evaluate(async (api) => {
            const r = await fetch(api + 'collectFeed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'granaryReward' }) });
            return await r.text();
          }, API);
          const cj = JSON.parse(c);
          log(cj.result === 1 ? '  ✓ 收饲料仓 +' + gd.fodderAmount : '  · 收饲料仓 ' + (cj.error_msg || cj.result));
        } else log('  · 饲料仓还需 ' + Math.ceil(left / 60000) + ' 分钟产满（' + gd.fodderAmount + ' 粒）');
      }
    } catch (e) {}

    // 4 饲料雨
    try {
      const rj = await page.evaluate(async (api) => {
        const r = await fetch(api + 'feedRain');
        return await r.text();
      }, API);
      const fr = (JSON.parse(rj).data || {}).feedRain || {};
      if (fr.status && fr.pkgAmount > 0) {
        const hit = await page.evaluate(async (api) => {
          const r = await fetch(api + 'collectFeedRain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
          return await r.text();
        }, API);
        const hj = JSON.parse(hit);
        log(hj.result === 1 ? '  ✓ 领饲料雨 +' + (fr.pkgAmount * (fr.feedAmountPerPkg || 15)) : '  · 饲料雨 ' + (hj.error_msg || hj.result));
      } else if (fr.startTime) {
        const st = new Date(fr.startTime);
        log('  · 饲料雨 ' + (st.getMonth() + 1) + '/' + st.getDate() + ' ' +
            String(st.getHours()).padStart(2, '0') + ':' + String(st.getMinutes()).padStart(2, '0') +
            ' 开，' + fr.pkgAmount + ' 包');
      }
    } catch (e) {}

    // 5 领奖 + 预约
    async function findBtns(pat) {
      return await page.evaluate((p) => {
        const re = new RegExp(p);
        const out = [];
        document.querySelectorAll('*').forEach((el) => {
          if (el.children.length) return;
          const t = (el.textContent || '').trim();
          if (!t || t.length > 16 || !re.test(t)) return;
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return;
          out.push({ t, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
        });
        return out;
      }, pat);
    }
    async function clickAll(label, pat, max) {
      let n = 0;
      for (let i = 0; i < max; i++) {
        const b = await findBtns(pat);
        if (!b.length) break;
        await page.mouse.click(b[0].x, b[0].y);
        n++;
        log('  ↳ ' + label + '「' + b[0].t + '」');
        await sleep(1800);
      }
      return n;
    }
    await clickAll('领奖', '^可领取$|^领取$|再喂\\d+次领|^立即领取$', 6);

    // 6 喂食 + 点鸭子
    const FEED = { x: 400, y: 1235 };
    const DUCK = { x: 400, y: 660 };
    let fed = 0;
    for (let i = 1; i <= 8; i++) {
      const st = await page.evaluate(async (api) => {
        const r = await fetch(api + 'statusRefresh');
        return await r.text();
      }, API);
      const d = (JSON.parse(st).data) || {};
      if (d.awardFeedingRemainingTimes <= 0) { log('  · 可喂次数用完'); break; }
      if (d.feedAmount < 100) { log('  · 饲料不足(' + d.feedAmount + ')，停'); break; }
      const pos = i % 2 === 1 ? FEED : DUCK;
      await page.mouse.click(pos.x, pos.y);
      await sleep(2800);
      const st2 = await page.evaluate(async (api) => {
        const r = await fetch(api + 'statusRefresh');
        return await r.text();
      }, API);
      const d2 = (JSON.parse(st2).data) || {};
      if (d2.activeness > d.activeness) {
        fed++;
        log('  ↳ 喂食 #' + i + '  心情 ' + d.activeness + '→' + d2.activeness);
      } else log('  ↳ 第 ' + i + ' 次没推进');
      await clickAll('喂后领奖', '^可领取$|再喂\\d+次领', 3);
    }

    // 7 抓鸭子状态
    try {
      const cj = await page.evaluate(async () => {
        const r = await fetch('/rest/n/encourage/game/luckyDuck/catchDuck/statusRefresh');
        return await r.text();
      });
      const c = JSON.parse(cj).data || {};
      if (c.totalFreeTimes) {
        log('');
        log('  🎮 抓鸭子 ' + c.playTimes + '/' + c.totalFreeTimes + ' 剩 ' + c.freeTimes + ' 次 | 鸭鸭币 ' + c.gameCoinsAmount);
      }
    } catch (e) {}

    // 8 最终状态
    const fin = await page.evaluate(async (api) => {
      const r = await fetch(api + 'statusRefresh');
      return await r.text();
    }, API);
    const fd = (JSON.parse(fin).data) || {};
    log('');
    log('  📊 饲料 ' + fd.feedAmount + ' | 蛋 ' + fd.eggAmount + ' | 心情 ' + fd.activeness + '/100 | 可喂 ' + fd.awardFeedingRemainingTimes);
    log('  成功喂食 ' + fed + ' 次');
    log('');
  } finally {
    try { await browser.close(); } catch (e) {}
  }
})().catch((e) => { console.error('异常:', e && e.message); process.exit(1); });
