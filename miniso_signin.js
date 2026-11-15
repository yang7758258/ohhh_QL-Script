#!/usr/bin/env node
/* -------------------------------------------------------------------------
 *  项目名称：名创优品 MINISO（小程序任务中心）
 *  脚本文件：miniso_signin.js
 *  更新说明：
 *    2026-11-15  Mist  仓库首发：签到 + 周期任务 + mini币结算
 * -------------------------------------------------------------------------
 *  Author : Mist
 *  声明   : 仅供个人学习与技术研究，仅用于自己有权操作的账号，风险自负
 * -------------------------------------------------------------------------
 */
"use strict";

const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");

/* ---------------------------- 常量 ---------------------------- */

const ACTIVITY_ID = "18";
const TENANT = "MINISO";

const HOST = {
  saas: "api-saas.miniso.com",
  brand: "api.multibrands.miniso.com",
};

const EP = {
  signInDetail: "/task-manage-platform/api/activity/signInTask/taskDetail",
  signInClaim: "/task-manage-platform/api/activity/signInTask/award/receive",
  periodDetail: "/task-manage-platform/api/activity/periodTask/taskDetail",
  periodClaim: "/task-manage-platform/api/activity/periodTask/award/receive",
  uvClick: "/task-manage-platform/api/activity/task/uvClick",
  coin: "/task-manage-platform/api/virtualCoin/memberV2",
  taskDetail: "/multi-configure-platform/api/activity/task/detail",
  pageDetail: "/multi-configure-platform/api/page/detail",
  browseFinish: "/multi-configure-platform/api/activity/task/browse/finish",
};

/** 任务类型：仅 5（浏览）可无人值守完成 */
const TASK_TYPE = { INVITE: 2, GROUP: 3, BROWSE: 5 };
const TASK_TYPE_LABEL = { 2: "邀请好友", 3: "加群类", 5: "浏览类" };

/** 任务状态：1 可做 / 3 已完成 */
const TASK_STATUS_TODO = 1;

/** 从「5 mini币」这类奖励名里取出数字 */
function awardValue(name) {
  const match = /([0-9]+(?:\.[0-9]+)?)/.exec(String(name || ""));
  return match ? Number(match[1]) : 0;
}

const DRY = process.argv.includes("--dry");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pad = (text, width) => {
  const used = [...String(text)].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0);
  return String(text) + " ".repeat(Math.max(1, width - used));
};

/* ---------------------------- HTTP ---------------------------- */

function request(host, pathname, options) {
  const opts = options || {};
  const payload = opts.body === undefined ? null : Buffer.from(JSON.stringify(opts.body), "utf8");
  const headers = Object.assign({}, opts.headers || {}, payload ? { "content-length": payload.length } : {});

  const attempt = (left) =>
    new Promise((resolve, reject) => {
      const req = https.request({ host: host, path: pathname, method: opts.method || "GET", headers: headers }, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          try {
            resolve(JSON.parse(text));
          } catch (err) {
            reject(new Error("响应非 JSON (" + res.statusCode + ") " + text.slice(0, 120)));
          }
        });
      });
      req.on("error", (err) => {
        if (left > 0) setTimeout(() => attempt(left - 1).then(resolve, reject), 1200);
        else reject(err);
      });
      req.setTimeout(20000, () => req.destroy(new Error("请求超时")));
      if (payload) req.write(payload);
      req.end();
    });

  return attempt(2);
}

/** 传输层可替换，便于自检注入假应答 */
let requestImpl = request;

/* ---------------------------- 客户端 ---------------------------- */

class Miniso {
  constructor(account) {
    this.skey = account.skey;
    this.uid = account.uid;
    this.unionId = account.unionId || "";
    this.alias = account.alias || account.uid;
  }

  /** 网关只认 content-skey + content-uid；签名头按抓包补齐（服务端未校验） */
  headers(extra) {
    const base = {
      accept: "*/*",
      "content-type": "application/json",
      "content-skey": this.skey,
      "content-uid": this.uid,
      "tenant-code": TENANT,
      "content-appcode": "51",
      "content-weappcode": "52",
      "x-mi-store-id": "ZESM",
      "x-mi-version": "5.2.12",
      "x-client-source": "MINISO_WX_MINI",
      version: "storeexpress1.0",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 MicroMessenger/7.0.20 MiniProgramEnv/Windows",
    };
    if (this.unionId) base["content-unionid"] = this.unionId;
    return Object.assign(base, extra || {});
  }

  get(host, pathname) {
    return requestImpl(host, pathname, { headers: this.headers() });
  }

  post(host, pathname, body, extra) {
    return requestImpl(host, pathname, { method: "POST", body: body, headers: this.headers(extra) });
  }

  /* -------- 业务 -------- */

  async profile() {
    const res = await this.get(HOST.saas, EP.coin);
    return res.data || {};
  }

  /** 签到：查状态 -> 埋点击 -> 领奖 */
  async signIn() {
    const detail = await this.get(HOST.saas, EP.signInDetail + "?activityId=" + ACTIVITY_ID);
    const data = detail.data || {};
    const days = data.signInFinishDays || 0;
    const today = (data.taskDetails || []).find((slot) => slot.todaySignInFlag === true);
    const todayReward = today && today.awardNum ? today.awardNum : 0;

    if (data.todaySignInFinishFlag === 1) {
      return { state: "done", reward: todayReward, text: "今日已签到（连续 " + days + " 天）" };
    }
    if (DRY) return { state: "todo", reward: 0, text: "今日待签到（dry 模式未提交）" };

    await this.post(HOST.saas, EP.uvClick, { activityId: ACTIVITY_ID, taskId: data.taskId, taskType: 1 });
    const res = await this.post(HOST.saas, EP.signInClaim, { activityId: ACTIVITY_ID, taskId: data.taskId });

    if (res.success) {
      const amount = ((res.data && res.data.awardDetails) || []).reduce((n, a) => n + (a.awardNum || 0), 0);
      return { state: "ok", reward: amount, text: "签到成功（连续 " + (days + 1) + " 天）" };
    }
    if (/已完成过该任务/.test(res.message || "")) {
      return { state: "done", reward: todayReward, text: "今日已完成过签到" };
    }
    return { state: "fail", reward: 0, text: "签到失败：" + (res.message || "未知错误") };
  }

  /** 周期任务：只处理浏览类，其余标记为需人工 */
  async tasks() {
    const url = EP.periodDetail + "?activityId=" + ACTIVITY_ID + "&unionId=" + encodeURIComponent(this.unionId);
    const res = await this.get(HOST.saas, url);
    const periods = res.data || [];
    const flat = [];
    for (const period of periods) {
      for (const task of period.periodTasks || []) {
        flat.push(Object.assign({ period: period.period }, task));
      }
    }

    const report = [];
    for (const task of flat) {
      const reward = awardValue(task.awardName);
      const finished = (task.periodFinishTimes || 0) >= (task.periodAllowTimes || 1);
      if (finished) {
        report.push({ id: task.taskId, name: task.taskName, state: "done", reward: reward, text: "已完成" });
        continue;
      }
      if (task.taskType !== TASK_TYPE.BROWSE) {
        const label = TASK_TYPE_LABEL[task.taskType] || "类型" + task.taskType;
        report.push({ id: task.taskId, name: task.taskName, state: "manual", reward: 0, text: label + "，需人工" });
        continue;
      }
      const result = await this.browse(task);
      report.push({ id: task.taskId, name: task.taskName, state: result.state, reward: result.reward || 0, text: result.text });
    }
    return report;
  }

  /** 浏览类任务：进任务页 -> 停留 -> 上报完成 -> 领奖 */
  async browse(task) {
    const reward = awardValue(task.awardName);
    try {
      const detail = await this.get(HOST.brand, EP.taskDetail + "?activityId=" + ACTIVITY_ID + "&taskId=" + task.taskId);
      const meta = detail.data || {};
      if (meta.taskStatus !== TASK_STATUS_TODO) return { state: "done", reward: reward, text: "已完成" };
      if (DRY) return { state: "todo", reward: 0, text: "待完成（dry 模式未提交）" };

      const match = /(?:[?&]id=)(\d+)/.exec(meta.browsePagePath || task.pageJumpUrl || "");
      const pageId = match ? match[1] : "";
      const dwell = Math.max(5, Number(meta.browseTime || task.browseSeconds || 10));

      await this.post(HOST.saas, EP.uvClick, { activityId: ACTIVITY_ID, taskId: task.taskId, taskType: TASK_TYPE.BROWSE });
      if (pageId) await this.get(HOST.brand, EP.pageDetail + "?id=" + pageId);
      await sleep(dwell * 1000 + 2000);
      await this.post(HOST.brand, EP.browseFinish, { activityId: Number(ACTIVITY_ID), taskId: task.taskId }, { tenant: TENANT });

      const claim = await this.post(HOST.saas, EP.periodClaim, { activityId: ACTIVITY_ID, taskId: String(task.taskId) });
      if (claim.success) {
        const amount = ((claim.data && claim.data.awardDetails) || []).reduce((n, a) => n + (a.awardNum || 0), 0);
        return { state: "ok", reward: amount, text: "领取成功" };
      }
      if (/不存在已完成待领取的奖励/.test(claim.message || "")) {
        return { state: "done", reward: reward, text: "奖励已领取" };
      }
      return { state: "fail", reward: 0, text: "领取失败：" + (claim.message || "未知错误") };
    } catch (err) {
      return { state: "fail", reward: 0, text: "异常：" + err.message };
    }
  }

  /** 单账号完整流程 */
  async run() {
    const lines = [];
    const push = (name, kind, text, reward) => lines.push({ name: name, kind: kind, text: text, reward: reward || 0 });

    let earned = 0;

    try {
      const sign = await this.signIn();
      earned += sign.reward || 0;
      push("签到", sign.state, sign.text, sign.reward);
    } catch (err) {
      push("签到", "fail", "异常：" + err.message, 0);
    }

    try {
      for (const task of await this.tasks()) {
        earned += task.reward || 0;
        push(task.name, task.state, task.text, task.reward);
      }
    } catch (err) {
      push("任务", "fail", "异常：" + err.message, 0);
    }

    try {
      const me = await this.profile();
      const coin = (me.quantity === undefined ? "?" : me.quantity) + " " + (me.coinName || "mini币");
      push("余额", "info", coin + "（今日 +" + earned + "）", 0);
    } catch (err) {
      push("余额", "info", "读取失败", 0);
    }

    return lines;
  }
}

/* ---------------------------- 账号装载 ---------------------------- */

function parseAccount(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  if (text.startsWith("{")) {
    const obj = JSON.parse(text);
    return { skey: obj.skey || obj.token, uid: String(obj.uid || obj.memberId), unionId: obj.unionId || obj.unionid };
  }
  const parts = text.split(/[#,|]/).map((s) => s.trim());
  if (!parts[0] || !parts[1]) throw new Error("账号格式应为 skey#uid");
  return { skey: parts[0], uid: parts[1], unionId: parts[2] || "" };
}

function loadAccounts() {
  const seen = new Set();
  const accounts = [];
  const buckets = [process.env.MINISO_ACCOUNT || process.env.MINISO_CK || ""];

  // 凭证优先读同目录，其次读项目根目录
  for (const ckFile of [path.join(__dirname, "miniso_ck.json"), path.join(__dirname, "..", "miniso_ck.json")]) {
    if (!fs.existsSync(ckFile)) continue;
    try {
      const local = JSON.parse(fs.readFileSync(ckFile, "utf8"));
      buckets.push(Array.isArray(local) ? local.join("&") : String(local));
    } catch (err) {
      console.log("[warn] " + path.basename(ckFile) + " 解析失败：" + err.message);
    }
  }

  for (const bucket of buckets) {
    for (const token of String(bucket).split(/[\n&]+/)) {
      if (!token.trim()) continue;
      try {
        const account = parseAccount(token);
        if (!account || seen.has(account.skey)) continue;
        seen.add(account.skey);
        accounts.push(account);
      } catch (err) {
        console.log("[warn] 跳过无法解析的账号项");
      }
    }
  }
  return accounts;
}

/* ---------------------------- 输出 ---------------------------- */

const WIDTH = 44;
const maskUid = (uid) => String(uid).replace(/^(\d{3})\d+(\d{3})$/, "$1****$2");

/** 控制台标记 */
const MARK = { ok: "✓", done: "·", manual: "–", fail: "!", todo: "…", info: "" };
/** 推送表情 */
const EMOJI = { ok: "✅", done: "☑️", manual: "🙋", fail: "❌", todo: "📅", info: "💰" };

function slotOf(line) {
  if (line.kind === "info" || line.name === "签到") return line.name;
  return MARK[line.kind] + " " + line.name;
}

function pushLine(line) {
  const icon = line.name === "签到" ? "📅" : EMOJI[line.kind] || "•";
  return icon + " " + line.name + "：" + line.text + (line.reward ? " +" + line.reward : "");
}

function render(alias, lines) {
  const rule = "-".repeat(Math.max(6, WIDTH - alias.length - 11));
  console.log("");
  console.log("+-- MINISO · " + alias + " " + rule);
  for (const line of lines) {
    console.log("| " + pad(slotOf(line), 16) + line.text + (line.reward ? " +" + line.reward : ""));
  }
  console.log("+" + "-".repeat(WIDTH));
}

/* ---------------------------- 入口 ---------------------------- */

async function main() {
  const accounts = loadAccounts();
  if (!accounts.length) {
    console.log("[error] 未找到账号：设置 MINISO_ACCOUNT=skey#uid 或提供 miniso_ck.json");
    process.exit(1);
  }

  const summary = [];
  const budget = Math.min(accounts.length, 6);

  for (const account of accounts.slice(0, budget)) {
    const client = new Miniso(account);
    const alias = maskUid(account.uid);
    const lines = await client.run();
    render(alias, lines);
    const detail = lines.map((line) => pushLine(line)).join("\n");
    summary.push("【" + alias + "】\n" + detail);
    if (accounts.length > 1) await sleep(1500 + Math.random() * 1500);
  }

  const title = "🏪 名创优品任务中心 · " + summary.length + " 个账号" + (DRY ? "（dry）" : "");
  if (process.env.MINISO_PUSH !== "off") {
    try {
      const { sendNotify } = require(path.join(__dirname, "sendNotify.js"));
      await sendNotify(title, summary.join("\n\n"));
    } catch (err) {
      /* 无推送模块时静默，本地运行不阻断 */
    }
  }
  console.log("\n" + title + "\n");
}

if (require.main === module) {
  main().catch((err) => {
    console.log("[fatal] " + (err.stack || err.message));
    process.exit(1);
  });
}

module.exports = {
  Miniso: Miniso,
  main: main,
  loadAccounts: loadAccounts,
  slotOf: slotOf,
  pushLine: pushLine,
  /** 自检注入：替换 HTTP 传输层 */
  setTransport: (fn) => {
    requestImpl = fn;
  },
};
