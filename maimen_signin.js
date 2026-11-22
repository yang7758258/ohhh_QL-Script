#!/usr/bin/env node
/* -------------------------------------------------------------------------
 *  项目名称：麦门认证机（麦当劳 MCP · 领券 / 抽奖 / 活动钩子）
 *  脚本文件：maimen_signin.js
 *  更新说明：
 *    2026-11-22  Mist  仓库首发：领券闭环 + 抽奖彩蛋 + 活动钩子，纯 HTTP 无第三方依赖
 * -------------------------------------------------------------------------
 *  Author : Mist
 *  声明   : 仅供个人学习与技术研究，仅用于自己有权操作的账号，风险自负
 * -------------------------------------------------------------------------
 */
"use strict";

const https = require("node:https");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

/* ---------------------------- 常量 ---------------------------- */

const MCP_URL = process.env.MAIMEN_MCP_URL || "https://mcp.mcd.cn/mcp-servers/mcd-mcp";
const PROTOCOL = "2025-06-18";
const CLIENT = { name: "maimen-signin", version: "1.0.0" };

const TOOL = {
  time: "now-time-info",
  account: "query-my-account",
  available: "available-coupons",
  bind: "auto-bind-coupons",
  wallet: "query-my-coupons",
  lotteryInfo: "query-lottery-info",
  draw: "draw-lottery",
  campaign: "campaign-calendar",
};

const DRY = process.argv.includes("--dry");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const envBool = (name, fallback) => {
  const raw = String(process.env[name] === undefined ? "" : process.env[name]).trim().toLowerCase();
  if (!raw) return fallback;
  return !(raw === "off" || raw === "0" || raw === "false" || raw === "no");
};

const envInt = (name, fallback) => {
  const raw = String(process.env[name] === undefined ? "" : process.env[name]).trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const OPT = {
  coupon: envBool("MAIMEN_COUPON", true),
  lottery: envBool("MAIMEN_LOTTERY", true),
  lotteryMax: Math.min(5, Math.max(1, envInt("MAIMEN_LOTTERY_MAX", 1))),
  pointFloor: Math.max(0, envInt("MAIMEN_POINT_FLOOR", 0)),
  campaign: envBool("MAIMEN_CAMPAIGN", true),
  campaignLimit: Math.min(9, Math.max(1, envInt("MAIMEN_CAMPAIGN_LIMIT", 3))),
  expiring: Math.max(0, envInt("MAIMEN_EXPIRING", 3)),
};

/** 餐段判定：麦当劳中国营业时段 */
function mealSlot(hour) {
  const h = Number(hour);
  if (h >= 5 && h < 10) return "早餐";
  if (h >= 10 && h < 14) return "午餐";
  if (h >= 14 && h < 17) return "下午茶";
  if (h >= 17 && h < 21) return "晚餐";
  return "夜宵";
}

/* ---------------------------- HTTP ---------------------------- */

function request(urlText, options) {
  const opts = options || {};
  const target = new URL(urlText);
  const lib = target.protocol === "https:" ? https : http;
  const payload = opts.body === undefined ? null : Buffer.from(JSON.stringify(opts.body), "utf8");
  const headers = Object.assign({}, opts.headers || {}, payload ? { "content-length": payload.length } : {});

  const attempt = (left) =>
    new Promise((resolve, reject) => {
      const req = lib.request(
        {
          host: target.hostname,
          port: target.port || (target.protocol === "https:" ? 443 : 80),
          path: target.pathname + target.search,
          method: opts.method || "POST",
          headers: headers,
        },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString("utf8") }));
        }
      );
      req.on("error", (err) => {
        if (left > 0) setTimeout(() => attempt(left - 1).then(resolve, reject), 1500);
        else reject(err);
      });
      req.setTimeout(30000, () => req.destroy(new Error("请求超时")));
      if (payload) req.write(payload);
      req.end();
    });

  return attempt(2);
}

/** 传输层可替换，便于自检注入假应答 */
let transport = request;

/** streamable http 可能回 SSE：把 data: 行里的 JSON 抽出来 */
function decodeBody(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      return JSON.parse(raw);
    } catch (err) {
      /* fallthrough */
    }
  }
  const frames = raw
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(frames[i]);
    } catch (err) {
      /* keep looking */
    }
  }
  return null;
}

/* ---------------------------- MCP 客户端 ---------------------------- */

class Maimen {
  constructor(account) {
    this.token = account.token;
    this.alias = account.alias || maskToken(account.token);
    this.sessionId = "";
    this.seq = 0;
  }

  headers() {
    const base = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: "Bearer " + this.token,
      "user-agent": "maimen-signin/1.0 (+qinglong)",
    };
    if (this.sessionId) base["mcp-session-id"] = this.sessionId;
    return base;
  }

  async rpc(method, params, notify) {
    const body = { jsonrpc: "2.0", method: method };
    if (!notify) {
      this.seq += 1;
      body.id = this.seq;
    }
    body.params = params || {};

    const res = await transport(MCP_URL, { method: "POST", headers: this.headers(), body: body });
    const sid = res.headers && (res.headers["mcp-session-id"] || res.headers["Mcp-Session-Id"]);
    if (sid) this.sessionId = String(sid);
    if (notify) return null;

    const json = decodeBody(res.text);
    if (!json) throw new Error("MCP 响应无法解析（HTTP " + res.status + "）：" + String(res.text).slice(0, 120));
    if (json.error) throw new Error("MCP 错误：" + (json.error.message || JSON.stringify(json.error)).slice(0, 160));
    return json.result;
  }

  async connect() {
    const info = await this.rpc("initialize", {
      protocolVersion: PROTOCOL,
      capabilities: {},
      clientInfo: CLIENT,
    });
    await this.rpc("notifications/initialized", {}, true).catch(() => null);
    return (info && info.serverInfo) || {};
  }

  /** 调工具，拿纯文本（MCP content 里的 text 拼接） */
  async call(name, args) {
    const result = await this.rpc("tools/call", { name: name, arguments: args || {} });
    const content = (result && result.content) || [];
    const text = content
      .filter((item) => item && typeof item.text === "string")
      .map((item) => item.text)
      .join("\n")
      .trim();
    if (result && result.isError) throw new Error(name + " 返回错误：" + text.slice(0, 160));
    return text;
  }

  /* -------- 解析 -------- */

  /** 工具文本里通常带 ## Original Response + 原始 JSON */
  static json(text) {
    const marker = /##\s*Original Response\s*([\s\S]*)$/i.exec(text);
    const body = marker ? marker[1] : text;
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(body.slice(start, end + 1));
    } catch (err) {
      return null;
    }
  }

  static coupons(text) {
    const list = [];
    const lines = String(text).split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const hit = /优惠券标题[：:]\s*(.+)/.exec(lines[i]);
      if (!hit) continue;
      const name = hit[1].replace(/[\s\\]+$/, "").trim();
      let status = "";
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j += 1) {
        const st = /状态[：:]\s*([^\\]+)/.exec(lines[j]);
        if (st) {
          status = st[1].trim();
          break;
        }
      }
      if (name) list.push({ name: name, status: status });
    }
    return list;
  }

  static claim(text) {
    const num = (label) => {
      const hit = new RegExp(label + "[：:]\\s*(\\d+)").exec(String(text));
      return hit ? Number(hit[1]) : 0;
    };
    const names = [];
    const lines = String(text).split(/\r?\n/);
    let inSuccess = false;
    for (const line of lines) {
      if (/成功领取的优惠券/.test(line)) {
        inSuccess = true;
        continue;
      }
      if (!inSuccess) continue;
      if (/^\s*#{2,}/.test(line)) break;
      const hit = /^-\s+(-\s*)?([^\s].*)$/.exec(line);
      if (!hit) continue;
      const value = hit[2].trim();
      if (/couponId|couponCode|图片|<img/.test(value)) continue;
      names.push(value);
    }
    return { total: num("总计"), ok: num("成功"), fail: num("失败"), names: names };
  }

  static wallet(text) {
    const totalHit = /共\s*(\d+)\s*张/.exec(String(text));
    const items = [];
    const blocks = String(text).split(/^##\s+/m).slice(1);
    for (const block of blocks) {
      const name = (block.split(/\r?\n/)[0] || "").trim();
      if (!name) continue;
      const price = /优惠\*\*[：:]\s*([^\n]+)/.exec(block);
      const valid = /有效期\*\*[：:]\s*([^\n]+)/.exec(block);
      const tags = /标签\*\*[：:]\s*([^\n]+)/.exec(block);
      const span = valid ? valid[1] : "";
      const dates = span.match(/\d{4}-\d{2}-\d{2}/g) || [];
      items.push({
        name: name,
        price: price ? price[1].trim() : "",
        validFrom: dates[0] || "",
        validTo: dates.length > 1 ? dates[dates.length - 1] : dates[0] || "",
        tags: tags ? tags[1].trim() : "",
        span: span.trim(),
      });
    }
    return { total: totalHit ? Number(totalHit[1]) : items.length, items: items };
  }

  static campaign(text) {
    const sections = [];
    let current = null;
    for (const line of String(text).split(/\r?\n/)) {
      const head = /^####\s*(.+)$/.exec(line.trim());
      if (head) {
        current = { label: head[1].trim(), titles: [] };
        sections.push(current);
        continue;
      }
      if (!current) continue;
      const title = /活动标题\*\*[：:]\s*(.+)$/.exec(line);
      if (title) current.titles.push(title[1].trim());
    }
    return sections.filter((section) => section.titles.length);
  }

  /** 距到期天数，兼容 2026-11-23 这类纯日期 */
  static daysLeft(dateText) {
    if (!dateText) return null;
    const at = new Date(dateText + "T23:59:59+08:00").getTime();
    if (!Number.isFinite(at)) return null;
    return Math.ceil((at - Date.now()) / 86400000);
  }

  /* -------- 业务 -------- */

  async clock() {
    const json = Maimen.json(await this.call(TOOL.time, {}));
    const d = (json && json.data) || {};
    const hour = d.datetime ? Number(String(d.datetime).slice(11, 13)) : new Date().getHours();
    return { date: d.date || "", clock: (d.formatted || "").slice(11, 16), hour: hour, slot: mealSlot(hour), week: d.dayOfWeek || "" };
  }

  /** 领券闭环：查可领 -> 一键领 -> 回读卡包 */
  async coupons(clock) {
    const available = Maimen.coupons(await this.call(TOOL.available, {}));
    const claimable = available.filter((item) => !/已领取/.test(item.status || ""));

    const walletBefore = Maimen.wallet(await this.call(TOOL.wallet, { page: 1, pageSize: 50 }));
    const result = { state: "done", text: "", brief: "", claimed: 0, wallet: walletBefore.total, expiring: [] };
    let snapshot = walletBefore;

    if (!claimable.length) {
      result.text = "暂无可领券 · 卡包 " + walletBefore.total + " 张";
      result.brief = "无新券 · 卡包 " + walletBefore.total;
    } else if (DRY) {
      result.state = "todo";
      result.text = "可领 " + claimable.length + " 张（dry 未提交）· 卡包 " + walletBefore.total + " 张";
      result.brief = "待领 " + claimable.length + " 张 · 卡包 " + walletBefore.total;
    } else {
      const claim = Maimen.claim(await this.call(TOOL.bind, {}));
      const walletAfter = Maimen.wallet(await this.call(TOOL.wallet, { page: 1, pageSize: 50 }));
      result.claimed = claim.ok;
      result.wallet = walletAfter.total;
      snapshot = walletAfter;
      result.state = claim.ok > 0 ? "ok" : claim.fail > 0 ? "fail" : "done";
      result.text =
        (claim.ok > 0 ? "领取 " + claim.ok + " 张" : "无可领（服务端 0 张）") +
        (claim.fail ? " · 失败 " + claim.fail : "") +
        " · 卡包 " + walletBefore.total + " → " + walletAfter.total + " 张";
      if (claim.names.length && claim.names.length <= 4) result.text += "（" + claim.names.join("、") + "）";

      result.brief =
        (claim.ok > 0 ? "+" + claim.ok + " 张" : "0 张") +
        (claim.fail ? " · 失败 " + claim.fail : "") +
        " · 卡包 " + walletAfter.total;

    }

    // 临期券：无论本次是否领到券都算，券包里的到期提醒才是回访钩子
    if (OPT.expiring > 0) {
      for (const item of snapshot.items) {
        const left = Maimen.daysLeft(item.validTo);
        if (left === null || left > OPT.expiring) continue;
        result.expiring.push({ name: item.name, left: left });
      }
      result.expiring.sort((a, b) => a.left - b.left);
      result.expiring = result.expiring.slice(0, 3);
    }
    return result;
  }

  /** 抽奖彩蛋：先读决策，再按门槛抽 */
  async lottery() {
    const info = Maimen.json(await this.call(TOOL.lotteryInfo, {}));
    const d = (info && info.data) || {};
    const status = (d.status && d.status.code) || "UNKNOWN";
    const prizes = (d.prizes || []).map((p) => p.name).filter(Boolean);

    if (status !== "SUCCESS") {
      return {
        state: "manual",
        text: "活动不可抽（" + status + " " + ((d.status && d.status.message) || "") + "）",
        brief: "不可抽（" + status + "）",
      };
    }

    const decision = d.drawDecision || {};
    const drawPoint = Number(d.drawPoint || 0);
    const balance = Number(d.availablePoint || 0);
    const chances = Number(d.availableTimes || 0);
    const kind = (decision.nextConsumption && decision.nextConsumption.type) || (chances > 0 ? "CHANCES" : "POINTS");

    const preview = prizes.length ? " · 奖池 " + prizes.slice(0, 3).join("、") + (prizes.length > 3 ? "…" : "") : "";
    if (!decision.resourceEligible) {
      return {
        state: "manual",
        text: "积分不足（余 " + balance + " / 单次 " + drawPoint + " 分）" + preview,
        brief: "未抽 · 余 " + balance + " 分",
      };
    }

    let budget = Math.min(OPT.lotteryMax, kind === "CHANCES" ? chances : Math.floor((balance - OPT.pointFloor) / (drawPoint || 1)));
    if (budget < 1) {
      return {
        state: "manual",
        text: "低于积分保留下限 " + OPT.pointFloor + "（余 " + balance + "）" + preview,
        brief: "未抽 · 余 " + balance + " 分",
      };
    }
    if (DRY) {
      return {
        state: "todo",
        text: "可抽 " + budget + " 次 · 每次 " + (kind === "CHANCES" ? "1 次机会" : drawPoint + " 分") + "（dry 未提交）" + preview,
        brief: "可抽 " + budget + " 次",
      };
    }

    const wins = [];
    let spent = 0;
    let remain = balance;
    for (let i = 0; i < budget; i += 1) {
      const res = Maimen.json(await this.call(TOOL.draw, {}));
      const r = (res && res.data) || {};
      const code = (r.status && r.status.code) || "UNKNOWN";
      if (code !== "SUCCESS") {
        if (!wins.length && i === 0) {
          return { state: "fail", text: "抽奖失败：" + ((r.status && r.status.message) || code), brief: "失败" };
        }
        break;
      }
      spent += Number(r.consumePoint || 0);
      remain = r.remainPoint === undefined ? remain : Number(r.remainPoint);
      for (const prize of r.prizes || []) if (prize && prize.name) wins.push(prize.name);
      await sleep(800);
    }

    const times = Math.round(spent / (drawPoint || 1)) || budget;
    const text =
      "抽 " + times + " 次 · 消耗 " + spent + " 分 · " +
      (wins.length ? "中奖 " + wins.join("、") : "未中奖") +
      " · 余 " + remain + " 分" + preview;
    return {
      state: wins.length ? "ok" : "done",
      text: text,
      brief: times + " 次 · " + (wins.length ? "中 " + clip(wins.join("、"), 14) : "未中") + " · 余 " + remain,
      win: wins,
    };
  }

  /** 活动钩子：当月活动日历（今日 + 下一档） */
  async campaign(clock) {
    const sections = Maimen.campaign(await this.call(TOOL.campaign, { specifiedDate: clock.date || undefined }));
    if (!sections.length) return { state: "done", text: "无活动日历返回", brief: "无排期" };

    const today = sections.find((s) => /今日/.test(s.label)) || sections[0];
    const next = sections.find((s) => s !== today);
    const picks = today.titles.slice(0, OPT.campaignLimit);
    const label = (value) => String(value || "").replace(/\s+/g, " ").replace(/^(\d{4}年\d+月\d+日)\s*/, "$1 ").trim();
    const text =
      (label(today.label) || "今日") + " " + today.titles.length + " 场：" + picks.join(" ／ ") +
      (today.titles.length > picks.length ? " …" : "") +
      (next ? " ｜ 下一档 " + label(next.label) + " " + next.titles.length + " 场" : "");
    return { state: "ok", text: text, brief: "今日 " + today.titles.length + " 场 · " + clip(picks[0] || "无", 14) };
  }

  async points() {
    const json = Maimen.json(await this.call(TOOL.account, {}));
    const d = (json && json.data) || {};
    const expire = Number(d.currentMouthExpirePoint || 0);
    return {
      available: d.availablePoint === undefined ? "?" : d.availablePoint,
      currency: d.currency || "积分",
      expire: expire,
      brief: (d.availablePoint === undefined ? "?" : d.availablePoint) + (expire ? " · 过期 " + expire : ""),
    };
  }

  async run() {
    const lines = [];
    const push = (name, kind, text, brief) => lines.push({ name: name, kind: kind, text: text || "", brief: brief || "" });

    let clock = { date: "", clock: "", slot: "", week: "" };
    try {
      clock = await this.clock();
      push("餐段", "info", (clock.date || "") + " " + (clock.clock || "") + " · " + clock.slot);
    } catch (err) {
      push("餐段", "fail", "时间读取失败：" + err.message);
    }

    if (OPT.coupon) {
      try {
        const coupon = await this.coupons(clock);
        push("领券闭环", coupon.state, coupon.text, coupon.brief);
        if (coupon.expiring && coupon.expiring.length) {
          const first = coupon.expiring[0];
          const brief =
            clip(first.name, 12) +
            (first.left <= 0 ? " 今日到期" : " 剩 " + first.left + " 天") +
            (coupon.expiring.length > 1 ? " 等 " + coupon.expiring.length + " 张" : "");
          push("临期券", "manual", coupon.expiring.map((item) => item.name + "（剩 " + item.left + " 天）").join("、"), brief);
        }
      } catch (err) {
        push("领券闭环", "fail", "异常：" + err.message);
      }
    }

    if (OPT.lottery) {
      try {
        const draw = await this.lottery();
        push("抽奖彩蛋", draw.state, draw.text, draw.brief);
      } catch (err) {
        push("抽奖彩蛋", "fail", "异常：" + err.message);
      }
    }

    if (OPT.campaign) {
      try {
        const hook = await this.campaign(clock);
        push("活动钩子", hook.state, hook.text, hook.brief);
      } catch (err) {
        push("活动钩子", "fail", "异常：" + err.message);
      }
    }

    try {
      const me = await this.points();
      push("积分余额", "info", me.available + " " + me.currency + (me.expire ? "（本月将过期 " + me.expire + "）" : ""), me.brief);
    } catch (err) {
      push("积分余额", "info", "读取失败");
    }

    return lines;
  }
}

/* ---------------------------- 账号装载 ---------------------------- */

function maskToken(token) {
  const text = String(token || "");
  if (text.length <= 8) return text ? text.slice(0, 2) + "***" : "?";
  return text.slice(0, 4) + "****" + text.slice(-4);
}

function parseToken(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  if (text.startsWith("{")) {
    const obj = JSON.parse(text);
    return String(obj.token || obj.mcpToken || obj.mcp || obj.value || "").trim() || null;
  }
  return text;
}

function loadAccounts() {
  const pieces = [
    process.env.MAIMEN_MCP_TOKEN || "",
    process.env.MAIMEN_TOKEN || "",
    process.env.MCD_MCP_TOKEN || "",
  ].filter(Boolean);

  const files = [path.join(__dirname, "maimen_mcp.json"), path.join(__dirname, "..", "maimen_mcp.json")];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      const list = Array.isArray(raw) ? raw : [raw];
      for (const item of list) {
        if (!item) continue;
        if (typeof item === "string") {
          pieces.push(item);
          continue;
        }
        const value = item.token || item.mcpToken || item.mcp || item.value || "";
        if (value) pieces.push(String(value));
      }
    } catch (err) {
      console.log("[warn] " + path.basename(file) + " 解析失败：" + err.message);
    }
  }

  const seen = new Set();
  const accounts = [];
  for (const piece of pieces.join("&").split(/[\n&,]+/)) {
    let token = null;
    try {
      token = parseToken(piece);
    } catch (err) {
      console.log("[warn] 跳过无法解析的账号项");
    }
    if (!token || seen.has(token)) continue;
    seen.add(token);
    accounts.push({ token: token, alias: maskToken(token) });
  }
  return accounts;
}

/* ---------------------------- 输出 ---------------------------- */

const WIDTH = 46;
const MARK = { ok: "✓", done: "·", manual: "–", fail: "!", todo: "…", info: "" };
const EMOJI = { ok: "✅", done: "☑️", manual: "🙋", fail: "❌", todo: "📅", info: "•" };
const ICON = { 领券闭环: "🎫", 抽奖彩蛋: "🎁", 活动钩子: "📣", 临期券: "⏰", 积分余额: "💰", 餐段: "🕒" };

const pad = (text, width) => {
  const used = [...String(text)].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0);
  return String(text) + " ".repeat(Math.max(1, width - used));
};

function slotOf(line) {
  if (line.kind === "info") return line.name;
  return MARK[line.kind] + " " + line.name;
}

/** 推送短标签：手机上 2 个字占位一致，扫一眼就懂 */
const LABEL = { 领券闭环: "领券", 抽奖彩蛋: "抽奖", 活动钩子: "活动", 临期券: "临期", 积分余额: "积分" };

function clip(text, width) {
  const chars = [...String(text || "").replace(/\s+/g, " ").trim()];
  return chars.length > width ? chars.slice(0, width).join("") + "…" : chars.join("");
}

/** 推送一行流：图标 + 短标签 + 一句话；无 brief 的行（如餐段）不进推送 */
function pushLine(line) {
  if (!line.brief) return "";
  const icon = ICON[line.name] || EMOJI[line.kind] || "•";
  const label = LABEL[line.name] || "";
  return icon + " " + (label ? label + " " : "") + line.brief;
}

/** 单账号推送块：每行一句、无缩进、无表格线，微信/企业微信都不会折行错位 */
function renderPush(alias, lines, multi) {
  const items = lines.map((line) => pushLine(line)).filter(Boolean);
  if (!items.length) return "";
  return (multi ? "〔" + alias + "〕\n" : "") + items.join("\n");
}

function render(alias, lines) {
  const head = "麦门认证机 · " + alias + " ";
  const rule = "-".repeat(Math.max(4, WIDTH - head.length - 10));
  console.log("");
  console.log("+-- " + head + rule);
  for (const line of lines) console.log("| " + pad(slotOf(line), 14) + line.text);
  console.log("+" + "-".repeat(WIDTH + 4));
}

/* ---------------------------- 入口 ---------------------------- */

async function main() {
  const accounts = loadAccounts();
  if (!accounts.length) {
    console.log("[error] 未找到 Token：设置 MAIMEN_MCP_TOKEN，或提供 maimen_mcp.json");
    process.exit(1);
  }

  const summary = [];
  for (const account of accounts) {
    const client = new Maimen(account);
    try {
      await client.connect();
    } catch (err) {
      console.log("[warn] " + account.alias + " 握手失败：" + err.message);
    }
    let lines = [];
    try {
      lines = await client.run();
    } catch (err) {
      lines = [{ name: "总览", kind: "fail", text: "执行异常：" + err.message }];
    }
    render(account.alias, lines);
    const block = renderPush(account.alias, lines, accounts.length > 1);
    if (block) summary.push(block);
    if (accounts.length > 1) await sleep(1500);
  }

  const title = "🍔 麦门认证机" + (DRY ? "（dry）" : "");
  if (process.env.MAIMEN_PUSH !== "off") {
    try {
      const { sendNotify } = require(path.join(__dirname, "sendNotify.js"));
      await sendNotify(title, summary.join("\n\n"));
    } catch (err) {
      /* 推送模块缺失时静默，本地运行不阻断 */
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
  Maimen: Maimen,
  OPT: OPT,
  main: main,
  loadAccounts: loadAccounts,
  maskToken: maskToken,
  mealSlot: mealSlot,
  slotOf: slotOf,
  pushLine: pushLine,
  decodeBody: decodeBody,
  /** 自检注入：替换传输层 */
  setTransport: (fn) => {
    transport = fn;
  },
};
