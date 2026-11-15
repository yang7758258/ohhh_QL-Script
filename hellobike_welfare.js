#!/usr/bin/env node
/* -------------------------------------------------------------------------
 *  项目名称：哈啰出行（小程序福利中心 · 签到 / 看视频 / 积分）
 *  脚本文件：hellobike_welfare.js
 *  更新说明：
 *    2026-11-15  Mist  仓库首发：签到 + 激励视频阶梯 + 积分与奖励金结算
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

const HOST = "api.hellobike.com";
const API_PATH = "/api";
const ORIGIN = "https://m.hellobike.com";

const ACT = {
  checkToken: "user.login.checkToken",          // 登录态探活（data: true/false）
  sign: "common.welfare.sign",                  // 签到
  signInfo: "common.welfare.new.signInfo",      // 签到 + 模块（含视频任务）
  point: "user.taurus.pointInfo",               // 积分 / 奖励金
  alipay: "common.welfare.queryAlipayLightVideo", // 看视频抵扣
  adShow: "adx.ssp.show",                       // 广告竞价下发
  adCallback: "adx.ssp.callback",               // 广告事件上报（奖励发放依据）
};

/** 客户端指纹：小程序 web-view 的固定取值，服务端按此识别为合法端 */
const CLIENT = {
  from: "h5",
  systemCode: 64,
  platform: 2,
  version: "7.0.30",
  appVer: "7.0.75",
  adAppId: "taro-ad-component",
  ua:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/144.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI " +
    "MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) " +
    "UnifiedPCWindowsWechat(0xf2541f38) XWEB/25819 miniProgram/wxb937e3d0b3ca117e",
  /** 定位：服务端未校验，仅作指纹的一部分，可用环境变量覆盖 */
  lon: Number(process.env.HELLOBIKE_LON || 116.397428),
  lat: Number(process.env.HELLOBIKE_LAT || 39.90923),
};

// 城市 / 行政区码：任务按城市下发，改成自己的城市即可（环境变量优先）
const DEFAULT_CITY = process.env.HELLOBIKE_CITY || "0733";
const DEFAULT_ADCODE = process.env.HELLOBIKE_ADCODE || "430211";

/** 视频任务来源：signInfo 模块走 mars 业务线，支付宝轻视频走 welfareCenter */
const BIZ_LINE = { welfare: "mars", alipay: "welfareCenter" };

const PREVIEW = process.argv.includes("--preview");
const DRY = process.argv.includes("--dry") || PREVIEW;
const ROUNDS_FLAG = (() => {
  const i = process.argv.indexOf("--rounds");
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) ? v : null;
})();

const envInt = (name, fallback) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
};

/**
 * 看视频档数上限：默认 full = 当日阶梯全刷
 *   full / all / 空 / -1 -> Infinity
 *   数字 N                -> 最多 N 档
 */
function videoCap() {
  if (ROUNDS_FLAG !== null) return ROUNDS_FLAG;
  const raw = process.env.HELLOBIKE_VIDEO === undefined ? "full" : String(process.env.HELLOBIKE_VIDEO).trim().toLowerCase();
  if (raw === "" || raw === "full" || raw === "all" || raw === "-1") return Infinity;
  const n = Number(raw);
  return Number.isFinite(n) ? n : Infinity;
}

/** 10 格进度条：▓ 已完成 / ░ 未完成 */
function bar(done, total, cells) {
  const width = cells || 10;
  if (!total || total <= 0) return "";
  const filled = Math.max(0, Math.min(width, Math.round((Number(done) / Number(total)) * width)));
  return "▓".repeat(filled) + "░".repeat(width - filled);
}

/** 到期时间文案：优先用抓包 ticket 里的 epoch，否则如实说不知道 */
function expireText(expire) {
  const epoch = Number(expire || 0);
  if (!Number.isFinite(epoch) || epoch < 1e9) return "";
  const days = Math.floor((epoch * 1000 - Date.now()) / 86400000);
  const date = new Date(epoch * 1000).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
  if (days < 0) return "票据已于 " + date + " 到期";
  return date + " 到期（剩 " + days + " 天）";
}

/* ---------------------------- 工具 ---------------------------- */

/** 延时实现可替换：离线自检注入零延时，避免空等视频时长 */
let sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sleep = (ms) => sleepImpl(ms);
const between = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function randomBase62(length) {
  let out = "";
  for (let i = 0; i < length; i += 1) out += BASE62[Math.floor(Math.random() * BASE62.length)];
  return out;
}

/** 抓包里的 requestid 形如 5T1db78NGZNdsKI（16 位，5T1 前缀 + 13 位 base62），服务端不校验 */
const makeRequestId = () => "5T1" + randomBase62(13);

/** 广告域只在该接口带 sid（uuid v4），同样属于装饰性头 */
function makeSid() {
  const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return hex(8) + "-" + hex(4) + "-4" + hex(3) + "-" + ((8 + Math.floor(Math.random() * 4)).toString(16)) + hex(3) + "-" + hex(12);
}

const pad = (text, width) => {
  const used = [...String(text)].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0);
  return String(text) + " ".repeat(Math.max(1, width - used));
};

/** 按显示宽度裁到固定列（中文算 2 列），保证表格右边界不歪 */
const fitName = (text, width) => {
  let out = "";
  let used = 0;
  for (const ch of String(text)) {
    const cw = ch.charCodeAt(0) > 0x2e80 ? 2 : 1;
    if (used + cw > width - 1) {
      out += "…";
      used += 1;
      break;
    }
    out += ch;
    used += cw;
  }
  return out + " ".repeat(Math.max(1, width - used));
};

/** 积分 -> 元（1 积分 = 0.001 元，与 pointInfo.amount 实测一致） */
const toYuan = (points) => (Number(points || 0) / 1000).toFixed(2);

/* ---------------------------- HTTP ---------------------------- */

function request(action, body, headers) {
  const payload = Buffer.from(JSON.stringify(body), "utf8");
  const opts = {
    host: HOST,
    path: API_PATH + "?" + action,
    method: "POST",
    headers: Object.assign(
      {
        accept: "application/json, text/plain, */*",
        "content-type": "application/json",
        origin: ORIGIN,
        referer: ORIGIN + "/",
        "accept-language": "zh-CN,zh;q=0.9",
        "user-agent": CLIENT.ua,
        requestid: makeRequestId(),
        "content-length": payload.length,
      },
      headers || {}
    ),
  };

  const attempt = (left) =>
    new Promise((resolve, reject) => {
      const req = https.request(opts, (res) => {
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
        if (left > 0) setTimeout(() => attempt(left - 1).then(resolve, reject), 1500);
        else reject(err);
      });
      req.setTimeout(20000, () => req.destroy(new Error("请求超时")));
      req.write(payload);
      req.end();
    });

  return attempt(2);
}

/** 传输层可替换，便于离线自检注入假应答 */
let requestImpl = request;

/* ---------------------------- 客户端 ---------------------------- */

class Hellobike {
  constructor(account) {
    this.token = account.token;
    this.cityCode = account.cityCode || DEFAULT_CITY;
    this.adCode = account.adCode || DEFAULT_ADCODE;
    this.userGuid = account.userGuid || "";
    this.ticketExpire = Number(account.ticketExpire || 0);
    this.alias = account.alias || "";
  }

  /** 身份只认 header.token + body.token；requestid / sid / xweb_xhr 为装饰头 */
  post(action, body, headers) {
    return requestImpl(action, body, Object.assign({ token: this.token, xweb_xhr: "1" }, headers || {}));
  }

  base(action, extra) {
    return Object.assign(
      { from: CLIENT.from, systemCode: CLIENT.systemCode, platform: CLIENT.platform, version: CLIENT.version, action: action, token: this.token },
      extra || {}
    );
  }

  /* -------- 查询 -------- */

  /** 登录态探活：data=true 有效、false 失效（HTTP 一律 200） */
  async checkToken() {
    const res = await this.post(ACT.checkToken, {
      from: "weChat",
      action: ACT.checkToken,
      oldToken: this.token,
      systemCode: String(CLIENT.systemCode),
    });
    return res.code === 0 && res.data === true;
  }

  /** 到期时间（读抓包 ticket 的 epoch；服务端不直接返回到期） */
  expireInfo() {
    const epoch = this.ticketExpire;
    if (!Number.isFinite(epoch) || epoch < 1e9) return { known: false, days: null, date: "" };
    return {
      known: true,
      days: Math.floor((epoch * 1000 - Date.now()) / 86400000),
      date: new Date(epoch * 1000).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }),
    };
  }

  async pointInfo() {
    const res = await this.post(ACT.point, this.base(ACT.point, { pointType: 1 }));
    if (res.code !== 0) throw new Error("积分查询失败：" + (res.msg || res.code));
    return res.data || {};
  }

  async signInfo() {
    const res = await this.post(ACT.signInfo, this.base(ACT.signInfo, { newWelfare: true, manufacturer: "" }));
    if (res.code !== 0) throw new Error("签到信息失败：" + (res.msg || res.code));
    return res.data || {};
  }

  /* -------- 签到 -------- */

  async signIn(info) {
    const data = info || (await this.signInfo());
    if (data.didSignToday) {
      return { state: "done", reward: 0, text: "今日已签 · " + (data.signBtnText || "明天再来") };
    }
    if (DRY) return { state: "todo", reward: 0, text: "今日待签（dry 未提交）" };

    const res = await this.post(ACT.sign, this.base(ACT.sign, { newWelfare: true }));
    if (res.code === 0) {
      const count = Number((res.data && res.data.bountyCountToday) || data.bountyCountToday || 0);
      const title = (res.data && res.data.title) || "";
      return { state: "ok", reward: count, text: "签到成功" + (title ? " · " + title : "") };
    }
    if (/已签|重复/.test(res.msg || "")) {
      return { state: "done", reward: 0, text: "今日已签" };
    }
    return { state: "fail", reward: 0, text: "签到失败：" + (res.msg || res.code) };
  }

  /* -------- 视频任务清单 -------- */

  /** 从 signInfo.moduleInfo 里挑出带广告位的激励视频模块 */
  videoModules(info) {
    const list = [];
    for (const mod of (info && info.moduleInfo) || []) {
      const it = mod.information || {};
      if (!mod.advertisementUnitId || !it.taskCode) continue;
      const stages = it.stageOffers || [];
      const total = Number(it.totalProgress || stages.length || 0);
      const progress = Number(it.currentProgress || 0);
      list.push({
        source: "welfare",
        label: String(mod.moduleName || it.mainTitle || "看视频").replace(/领奖$/, ""),
        unitId: mod.advertisementUnitId,
        taskCode: it.taskCode,
        businessLine: BIZ_LINE.welfare,
        progress: progress,
        total: total,
        stages: stages,
        status: it.taskStatus,
      });
    }
    return list;
  }

  /** 支付宝轻视频（看视频抵扣）：独立入口，取 adResourceId + taskCode */
  async alipayModule() {
    const res = await this.post(ACT.alipay, this.base(ACT.alipay));
    if (res.code !== 0 || !res.data) return null;
    const data = res.data;
    if (data.userGuid) this.userGuid = data.userGuid;
    if (!data.adResourceId || !data.taskCode) return null;
    return {
      source: "alipay",
      label: "看视频抵扣",
      unitId: data.adResourceId,
      taskCode: data.taskCode,
      businessLine: BIZ_LINE.alipay,
      progress: Number(data.watchedCount || 0),
      total: Number(data.maxPeriodCount || 0),
      stages: [],
      status: "RUNNING",
    };
  }

  /** 第 progress 档的奖励（积分） */
  stageReward(mod) {
    const stage = (mod.stages || [])[mod.progress];
    return stage ? Number(stage.totalAmount || 0) : 0;
  }

  /* -------- 广告链路 -------- */

  device(full) {
    const base = {
      ua: CLIENT.ua,
      carrier: 0,
      connectionType: 2,
      make: "microsoft",
      os: "windows",
      geo: { lon: CLIENT.lon, lat: CLIENT.lat, ad: this.adCode, city: this.cityCode },
    };
    if (!full) return base;
    return Object.assign(base, {
      osv: "",
      screen: { width: 400, height: 747 },
      deviceModel: "microsoft",
      language: "zh_CN",
    });
  }

  async adShow(mod) {
    const res = await this.post(
      ACT.adShow,
      {
        impIds: [mod.unitId],
        device: this.device(false),
        app: { appId: CLIENT.adAppId, systemCode: String(CLIENT.systemCode), ver: CLIENT.appVer },
        action: ACT.adShow,
        systemCode: String(CLIENT.systemCode),
        token: this.token,
      },
      { sid: makeSid() }
    );
    if (res.code !== 0) throw new Error("广告下发失败：" + (res.msg || res.code));
    return res.data || {};
  }

  /** eventExt.extra 里的 bizExtra 是嵌套 JSON 字符串，字段与抓包逐字一致 */
  adExtra(mod) {
    const bizExtra = JSON.stringify({
      userTaskId: mod.taskCode,
      business_line: mod.businessLine,
      userGuid: this.userGuid,
      systemCode: CLIENT.systemCode,
      version: CLIENT.version,
      cityCode: this.cityCode,
      eventCode: "benefit_center_rewarded_ad_event",
    });
    return JSON.stringify({ userTaskId: mod.taskCode, business_line: mod.businessLine, bizExtra: bizExtra });
  }

  adCallback(mod, pack, type, timing) {
    const tracker = pack.tracker;
    const eventExt = { adTaskType: "rewarded_video" };
    if (timing && timing.loadDuration) eventExt.loadDuration = timing.loadDuration;
    if (timing && timing.showDuration) eventExt.showDuration = timing.showDuration;
    eventExt.extra = this.adExtra(mod);

    const creative = {
      task_name: tracker.task_name,
      child_task_id: tracker.child_task_id,
      task_id: tracker.task_id,
      child_task_name: tracker.child_task_name,
      params: tracker.params,
      creativeId: pack.creativeId,
      traceId: pack.traceId,
      serverTimeStamp: pack.serverTimeStamp,
      pageId: pack.pageId,
      callBackType: type,
      eventTime: Date.now(),
      thirdPartnerAdUnitId: pack.thirdUnit,
      eventExt: eventExt,
    };
    if (!tracker.traceId && !tracker.params) return Promise.resolve({ code: -1, msg: "缺少 tracker" });

    return this.post(
      ACT.adCallback,
      {
        action: ACT.adCallback,
        token: this.token,
        device: this.device(true),
        app: { appId: CLIENT.adAppId, systemCode: String(CLIENT.systemCode), ver: CLIENT.appVer },
        impCallBackInfos: [{ impId: mod.unitId, creativeCallBackInfos: [creative] }],
        systemCode: String(CLIENT.systemCode),
      },
      { sid: makeSid() }
    );
  }

  /** 一轮完整激励视频：竞价 -> LOAD -> SHOWED -> 播完 -> COMPLETE（奖励在 COMPLETE 时入账） */
  async videoRound(mod) {
    const show = await this.adShow(mod);
    const adm = (show.adm || [])[0];
    const creative = adm && (adm.creative || [])[0];
    if (!creative) return { state: "skip", reward: 0, text: "无广告填充（稍后再试）" };

    const tracker = creative.tracker || {};
    const params = (() => {
      try {
        return JSON.parse(tracker.params || "{}");
      } catch (err) {
        return {};
      }
    })();
    if (params.user_guid) this.userGuid = params.user_guid;

    const pack = {
      creativeId: creative.id || "",
      tracker: tracker,
      traceId: show.traceId || params.auction_id || "",
      serverTimeStamp: String(show.timestamp || Date.now()),
      pageId: (adm.ext && adm.ext.pageId) || "Welfare",
      thirdUnit: ((show.resourceMappings || {})[creative.id] || {}).thirdPartnerAdUnitId || "",
    };

    const startedAt = Date.now();
    await this.adCallback(mod, pack, "INSPIRE_LOAD", {});
    await sleep(between(800, 1600));
    await this.adCallback(mod, pack, "INSPIRE_SHOWED", { loadDuration: Date.now() - startedAt });

    const showDuration = between(14000, 19000);
    if (!DRY) await sleep(showDuration);

    const done = await this.adCallback(mod, pack, "INSPIRE_COMPLETE", { showDuration: showDuration });
    if (!done || done.code !== 0) return { state: "fail", reward: 0, text: "回调失败：" + ((done && done.msg) || "未知") };
    return { state: "ok", reward: this.stageReward(mod), text: "" };
  }

  /** 跑完一个模块的剩余档位 */
  async runVideo(mod, cap) {
    const remaining = Math.max(0, mod.total - mod.progress);
    const rounds = Math.min(remaining, cap);
    // 总量过大（如抵扣池 500）时不画进度条，避免一行过长
    const gauge = mod.total && mod.total <= 100 ? bar(mod.progress, mod.total) : "";
    if (!remaining) {
      return { state: "done", reward: 0, text: "本周期已满档（" + mod.progress + "/" + mod.total + " " + gauge + "）" };
    }
    if (!rounds) return { state: "todo", reward: 0, text: "剩余 " + remaining + " 档，本轮上限 0" };
    if (DRY) {
      const planned = Math.min(remaining, rounds);
      return { state: "todo", reward: 0, text: "待完成 " + planned + " 档（" + mod.progress + "/" + mod.total + (gauge ? " " + gauge : "") + "）" };
    }

    let gained = 0;
    let done = 0;
    for (let i = 0; i < rounds; i += 1) {
      const res = await this.videoRound(mod);
      if (res.state === "skip") {
        if (!done) return { state: "skip", reward: 0, text: res.text };
        break;
      }
      if (res.state !== "ok") return { state: "fail", reward: gained, text: res.text };
      gained += res.reward;
      done += 1;
      if (process.env.HELLOBIKE_QUIET !== "1") {
        const unit = mod.source === "alipay" ? "次" : "档";
        const tally = mod.source === "alipay" ? "（抵扣按档结算，档内不计数）" : "（本地累计 +" + gained + "）";
        console.log("  🎬 " + mod.label + " 第 " + Math.min(mod.progress + 1, mod.total || 999) + " " + unit + " +" + res.reward + tally);
      }

      // 回读权威进度，确认奖励真的到账（失败不影响已得积分统计）
      try {
        const fresh = await this.signInfo();
        const hit = this.videoModules(fresh).find((m) => m.taskCode === mod.taskCode);
        if (hit) {
          mod.progress = hit.progress;
          mod.stages = hit.stages;
        } else {
          // 服务端未回该模块（taskCode 变化 / 活动换挡）时按本地推进
          mod.progress += 1;
        }
      } catch (err) {
        /* 回读失败时按本地进度推进 */
        mod.progress += 1;
      }
      if (i < rounds - 1) await sleep(between(3000, 6000));
      if (mod.total && mod.progress >= mod.total) break;
    }
    const tailGauge = mod.total && mod.total <= 100 ? " " + bar(mod.progress, mod.total) : "";
    return { state: "ok", reward: gained, text: "完成 " + done + " 档（" + mod.progress + "/" + mod.total + tailGauge + "）" };
  }

  /* -------- 单账号完整流程 -------- */

  async run() {
    const lines = [];
    const push = (name, kind, text, reward) => lines.push({ name: name, kind: kind, text: text, reward: reward || 0 });
    let earned = 0;

    // 起点积分：抵扣按档结算（档内逐条 0），用净增额做「本次 +N」才准
    let pointsBefore = null;
    try {
      const me = await this.pointInfo();
      pointsBefore = Number(me.points);
    } catch (err) {
      /* 读不到就退回逐条累加 */
    }

    // 0) 登录态：checkToken 是权威判定（HTTP 恒 200，看 data 布尔）
    try {
      if (!(await this.checkToken())) {
        const exp = this.expireInfo();
        push("登录态", "fail", "已失效" + (exp.known ? " · 票据 " + exp.date + " 到期" : "") + "，请重抓 token", 0);
        return lines;
      }
      const exp = this.expireInfo();
      push("登录态", "info", exp.known ? "有效 · " + expireText(this.ticketExpire) : "有效 · 到期时间未知（服务端不返回）", 0);
    } catch (err) {
      push("登录态", "info", "探活失败（继续按原 token 跑）：" + err.message, 0);
    }

    let info = null;
    try {
      info = await this.signInfo();
    } catch (err) {
      push("签到", "fail", err.message.replace(/^Error:\s*/, ""), 0);
      return lines;
    }
    // 1) 签到
    try {
      const sign = await this.signIn(info);
      earned += sign.reward;
      push("签到", sign.state, sign.text, sign.reward);
    } catch (err) {
      push("签到", "fail", "异常：" + err.message, 0);
    }

    // 2) 拆红包 / 看视频阶梯
    const cap = videoCap();
    const modules = this.videoModules(info);
    if (!modules.length) push("看视频", "info", "当前账号无激励视频任务", 0);

    for (const mod of modules) {
      try {
        const res = await this.runVideo(mod, cap);
        earned += res.reward;
        push(mod.label, res.state, res.text, res.reward);
      } catch (err) {
        push(mod.label, "fail", "异常：" + err.message, 0);
      }
    }

    // 3) 看视频抵扣（可选）
    if ((process.env.HELLOBIKE_ALIPAY || "on").toLowerCase() === "on") {
      try {
        const mod = await this.alipayModule();
        if (!mod) push("看视频抵扣", "info", "当前账号未开放", 0);
        else {
          const res = await this.runVideo(mod, Math.min(cap, envInt("HELLOBIKE_ALIPAY_ROUNDS", 10)));
          push("看视频抵扣", res.state, res.text, res.reward);
        }
      } catch (err) {
        push("看视频抵扣", "fail", "异常：" + err.message, 0);
      }
    }

    // 4) 结算
    try {
      const me = await this.pointInfo();
      const points = me.points === undefined ? "?" : me.points;
      const amount = me.amount === undefined ? "?" : me.amount;
      const delta = pointsBefore === null || me.points === undefined ? earned : Number(me.points) - pointsBefore;
      push("余额", "info", points + " 积分 / " + amount + " 元（本次 +" + delta + "）", 0);
    } catch (err) {
      push("余额", "info", "读取失败：" + err.message, 0);
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
    const token = obj.token || obj.cookie || obj.ck;
    if (!token) throw new Error("JSON 缺少 token");
    return {
      token: String(token),
      cityCode: obj.cityCode || DEFAULT_CITY,
      adCode: obj.adCode || DEFAULT_ADCODE,
      userGuid: obj.userGuid || "",
      ticketExpire: obj.ticketExpire || 0,
      alias: obj.alias || "",
    };
  }
  const parts = text.split(/[#|,]/).map((s) => s.trim());
  if (!parts[0]) throw new Error("账号格式应为 token#cityCode#adCode#alias");
  return {
    token: parts[0],
    cityCode: parts[1] || DEFAULT_CITY,
    adCode: parts[2] || DEFAULT_ADCODE,
    userGuid: "",
    alias: parts[3] || "",
  };
}

function loadAccounts() {
  const seen = new Set();
  const accounts = [];
  const buckets = [process.env.HELLOBIKE_ACCOUNT || process.env.HELLOBIKE_CK || ""];

  // 凭证优先读同目录，其次读项目根目录
  for (const ckFile of [path.join(__dirname, "hellobike_ck.json"), path.join(__dirname, "..", "hellobike_ck.json")]) {
    if (!fs.existsSync(ckFile)) continue;
    try {
      const local = JSON.parse(fs.readFileSync(ckFile, "utf8"));
      if (Array.isArray(local)) {
        for (const item of local) buckets.push(typeof item === "string" ? item : JSON.stringify(item));
      } else if (typeof local === "string") {
        buckets.push(local);
      } else {
        buckets.push(JSON.stringify(local));
      }
    } catch (err) {
      console.log("[warn] " + path.basename(ckFile) + " 解析失败：" + err.message);
    }
  }

  for (const bucket of buckets) {
    // 面板变量可能整段存 JSON（对象或数组），先摊平
    const text = String(bucket).trim();
    if (text.startsWith("[") || text.startsWith("{")) {
      try {
        const parsed = JSON.parse(text);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          try {
            const account = parseAccount(typeof item === "string" ? item : JSON.stringify(item));
            if (!account || seen.has(account.token)) continue;
            seen.add(account.token);
            accounts.push(account);
          } catch (err) {
            /* 条目坏了就跳过 */
          }
        }
        continue;
      } catch (err) {
        /* 不是合法 JSON，按普通串继续拆 */
      }
    }
    for (const token of text.split(/[\n&]+/)) {
      if (!token.trim()) continue;
      try {
        const account = parseAccount(token);
        if (!account || seen.has(account.token)) continue;
        seen.add(account.token);
        accounts.push(account);
      } catch (err) {
        console.log("[warn] 跳过无法解析的账号项");
      }
    }
  }
  return accounts;
}

/* ---------------------------- 输出 ---------------------------- */

const WIDTH = 46;
const maskToken = (token) => String(token).replace(/^(.{4}).*(.{4})$/, "$1********$2");

/** 控制台标记 */
const MARK = { ok: "✓", done: "·", manual: "–", fail: "!", todo: "…", skip: "–", info: "" };
/** 推送表情（按状态） */
const EMOJI = { ok: "✅", done: "☑️", manual: "🙋", fail: "❌", todo: "📅", skip: "⏭️", info: "💰" };
/** 推送表情（按条目，优先于状态） */
const NAME_ICON = { 登录态: "🔑", 签到: "📅", 余额: "💰", 看视频抵扣: "📺" };
const VIDEO_ICON = "🎬";

function slotOf(line) {
  if (line.kind === "info" && line.name !== "签到") return line.name;
  return MARK[line.kind] + " " + line.name;
}

function pushLine(line) {
  const icon = NAME_ICON[line.name] || (/视频|广告/.test(line.name) ? VIDEO_ICON : EMOJI[line.kind] || "•");
  const reward = line.reward ? " +" + line.reward + " 🎁" : "";
  const tail = line.kind === "fail" ? " ⚠️" : line.kind === "skip" ? " ⏭️" : "";
  // 进度条只留给控制台：手机上 ▓░ 容易变方块，推送里保持「（20/20）」
  const text = String(line.text).replace(/\s*[▓░]{2,}/g, "");
  return icon + " " + line.name + "：" + text + reward + tail;
}

function render(alias, lines) {
  const head = "+-- HELLOBIKE · " + alias + " ";
  console.log("");
  console.log(head + "-".repeat(Math.max(4, WIDTH + 2 - head.length)));
  for (const line of lines) {
    console.log("| " + fitName(slotOf(line), 18) + line.text + (line.reward ? " +" + line.reward : ""));
  }
  console.log("+" + "-".repeat(WIDTH + 1));
}

/* ---------------------------- 入口 ---------------------------- */

/** --check：只验登录态与到期时间，不发任何写请求 */
async function checkOnly() {
  const accounts = loadAccounts();
  if (!accounts.length) {
    console.log("[error] 未找到账号：设置 HELLOBIKE_ACCOUNT 或提供 hellobike_ck.json");
    process.exit(1);
  }
  let alive = 0;
  for (const account of accounts) {
    const api = new Hellobike(account);
    const alias = account.alias || maskToken(account.token);
    try {
      const ok = await api.checkToken();
      if (ok) alive += 1;
      const exp = api.expireInfo();
      const expText = ok
        ? (exp.known ? expireText(api.ticketExpire) : "到期时间未知（服务端不返回）")
        : "已失效，请重抓 token";
      console.log((ok ? "🔑 有效  " : "⚠️  失效  ") + alias + "  " + expText);
    } catch (err) {
      console.log("… 探活异常 " + alias + "  " + err.message);
    }
  }
  process.exit(alive === accounts.length ? 0 : 1);
}

async function main() {
  if (process.argv.includes("--check")) return checkOnly();

  const accounts = loadAccounts();
  if (!accounts.length) {
    console.log("[error] 未找到账号：设置 HELLOBIKE_ACCOUNT=<token> 或提供 hellobike_ck.json");
    process.exit(1);
  }

  const summary = [];
  const budget = Math.min(accounts.length, 5);

  for (const account of accounts.slice(0, budget)) {
    const client = new Hellobike(account);
    const alias = account.alias || maskToken(account.token);
    const lines = await client.run();
    render(alias, lines);
    summary.push("【" + alias + "】\n" + lines.map((line) => pushLine(line)).join("\n"));
    if (accounts.length > 1) await sleep(2000 + Math.random() * 2000);
  }

  const title = "🚲 哈啰出行福利中心 · " + summary.length + " 个账号";

  if (PREVIEW) {
    console.log("\n---- 推送预览 ----");
    console.log(title);
    console.log("");
    console.log(summary.join("\n\n"));
    console.log("------------------\n");
    return;
  }

  if ((process.env.HELLOBIKE_PUSH || "on").toLowerCase() !== "off") {
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
  Hellobike: Hellobike,
  main: main,
  loadAccounts: loadAccounts,
  parseAccount: parseAccount,
  slotOf: slotOf,
  pushLine: pushLine,
  toYuan: toYuan,
  bar: bar,
  videoCap: videoCap,
  expireText: expireText,
  makeRequestId: makeRequestId,
  /** 自检注入：替换 HTTP 传输层 */
  setTransport: (fn) => {
    requestImpl = fn;
  },
  /** 自检注入：替换延时（传 () => Promise.resolve() 即零延时） */
  setSleep: (fn) => {
    sleepImpl = fn;
  },
};
