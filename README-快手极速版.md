# 快手极速版 · 每日任务自动化（青龙版）

> 四条业务线：**主站金币**（纯 HTTP 零依赖）、**招财鸭**（Playwright 跑真实页面）、**抓鸭子**（纯接口）、**看视频赚金币**（iOS 网关驱动 App 真实播放）。
> 逆向过程见本地 `REPORT-快手极速版逆向.md` 与 `REPORT-招财鸭活动逆向.md`（未随仓库发布）。

**从仓库下载这几个就够跑：**

```text
ks_nebula_daily.js     主站金币：签到 / 宝箱 / 任务卡 / 任务上报   （纯 HTTP，零依赖）
ks_duck_signin.js      招财鸭：签到 / 喂食 / 领奖 / 饲料仓 / 饲料雨  （需 playwright）
ks_catch_duck.js       抓鸭子：init → report 自动上报               （纯 HTTP）
ks_ios_watch.js        看视频：定时调网关让 App 自动上滑             （需网关）
sendNotify.js          推送模块（青龙自带同名文件时可跳过）
```

> 四个脚本可独立运行，按需取用。只做签到领金币的话，前两个就够。

---

## 一、文件结构

```text
仓库里（平铺在根目录）：
  ks_nebula_daily.js   主站金币，零依赖，平板不用开
  ks_duck_signin.js    招财鸭，Playwright 驱动
  ks_catch_duck.js     抓鸭子，纯接口
  ks_ios_watch.js      看视频，调网关
  sendNotify.js        推送模块副本
  README-快手极速版.md   本文档

本地开发工具（未随仓库发布）：
  ks_ios_ck_grab.py    iOS Cookie 抓取（frida 读 NSHTTPCookieStorage）
  ks_ios_gateway.py    Frida→HTTP 网关（App 手势注入）
  ks_ios_autowatch.py  本机版自动刷视频
  deploy_ksql.py       青龙一键部署
  objc-bundle.js       frida 17 必需（ObjC 桥已从内置移除）

⚠️ 以下为本机运行产物，含登录凭据，切勿提交：
  ks_ck_ios.txt        完整 Cookie（含 egid）
  ks_state.json        登录态缓存
  ck_web.txt           网页版 Cookie
```

---

## 二、取 Cookie（唯一凭据）

**密码登录这条路是死的，别再试了。** 服务端对三种输入返回同一个码：

```text
POST https://id.kuaishou.com/pass/kuaishou/login/phone/v2
  正确密码   → result=100110150  「密码登录存在安全隐患，请使用短信验证码或者扫码登录方式。」
  错误密码   → 一模一样
  不存在的号 → 一模一样
```

三个不同输入同一个码 = 策略级拦截，服务端根本没校验密码。请求体的 RSA 混合加密是还原正确的，是平台关了这条门。

所以只能走 Cookie。**快手 SSO 的 session 不公开对外续期**，STS（`kuaishou.api_st`）过期后必须重抓 —— 任何号称「纯密码自动续期」的快手脚本都是骗人的。

### 2.1 推荐：App 抓（含 egid，写接口全通）

1. 手机打开快手极速版 → 我的 → 确认已登录；
2. Reqable / Stream 抓包，过滤 `nebula.kuaishou.com`；
3. 点任意请求 → 复制**完整 Cookie 请求头**（约 3000 字符，别截断）；
4. 整行放进青龙环境变量 `ks_ck`。

关键字段：`ud` / `userId` / `kuaishou.api_st` / `did` / `egid` / `kpn=NEBULA` / `appver`。

> `egid` 在不在决定写接口能不能调。网页版拿不到 App 专属 egid，部分强风控任务可能不计数。

### 2.2 备用：网页版

从 `passport.kuaishou.com` 登录后复制的 Cookie 里是 `kuaishou.web.api_st`（不是 `api_st`），且 `kpn=KUAISHOU_VISION`。

实测这份 Cookie 配 9~10 个核心字段就能调 nebula 接口，但 **kpn 必须改**，否则一律 `result=10023`（伪装成未登录）：

| kpn 取值 | 结果 |
| :--- | :--- |
| 不带 kpn | ✅ 1 |
| `KUAISHOU_NEBULA` | ✅ 1 |
| `NEBULA` | ✅ 1 |
| `KUAISHOU_VISION` | ❌ 10023（网页版默认值） |
| `KUAISHOU` | ❌ 10023 |

脚本已在 `KsClient` 构造函数里自动纠偏（非 nebula 渠道改写为 `KUAISHOU_NEBULA`），网页 Cookie 直接贴进来也能用。

---

## 三、青龙配置

### 3.1 环境变量

| 变量 | 必需 | 默认 | 说明 |
| :--- | :---: | :--- | :--- |
| `ks_ck` | ✅ | — | Cookie 整串，多账号换行；支持 `备注#Cookie` |
| `ks_delay` | ⬜ | `5-15` | 多账号随机间隔（秒） |
| `ks_push` | ⬜ | `on` | on / off，另受全局 `TYpush=off` 影响 |
| `ks_box_wait` | ⬜ | `off` | on = 宝箱冷却到了自动等并连开（单次最长约 100 分钟） |
| `ks_box_max` | ⬜ | `20` | 单次运行最多开几个宝箱 |
| `ks_debug` | ⬜ | `off` | on = 打印原始响应体 |
| `ks_duckchase` | ⬜ | `on` | 抓鸭子开关 |
| `ks_gw` | ⬜ | — | 网关地址，如 `http://127.0.0.1:8899`（仅 `ks_ios_watch.js` 用） |
| `ks_watch_n` | ⬜ | `6` | 每轮滑几次 |
| `ks_watch_dwell` | ⬜ | `45` | 每次间隔秒（上报阈值约 40 秒） |

推送（任选其一，跟其他脚本共用）——`QYWX_KEY` / `QYWX_AM` / `PUSH_PLUS_TOKEN` / `SCKEY` / `TG_BOT_TOKEN`+`TG_CHAT_ID`。

### 3.2 定时任务

| 名称 | 命令 | 定时 | 说明 |
| :--- | :--- | :--- | :--- |
| `ks_nebula_daily` | `task ks_nebula_daily.js` | `5 8,12,18,21 * * *` | 一天四次。签到幂等（重复只回 102006），宝箱 300 秒冷却靠多次跑摊平 |
| `ks_duck_signin` | `task ks_duck_signin.js` | `10 8,12,18,21 * * *` | 招财鸭日常 |
| `ks_duck_rain` | `task ks_duck_signin.js` | `0 20 * * *` | 20:00 饲料雨，30 包 × 15 = +450 |
| `ks_catch_duck` | `task ks_catch_duck.js` | `20 9,15,21 * * *` | 抓鸭子，需当日还有次数 |
| `ks_ios_watch` | `task ks_ios_watch.js` | `0 9,13,19,22 * * *` | 一天四轮，每轮 6 个视频 |

> 想一天开满 20 个宝箱，把 `ks_box_wait` 设 on，早上那一次跑满即可。

### 3.3 招财鸭要装 playwright

容器内一次性安装（二选一）：

```bash
# A. 官方浏览器
npx playwright install chromium --with-deps

# B. 用系统 chromium（省 300MB）
apt install -y chromium
export CHROME_PATH=/usr/bin/chromium
```

脚本自动探测顺序：`CHROME_PATH` → playwright 自带 → 系统常见路径。

---

## 四、四条业务线

### 4.1 主站金币（纯 HTTP，零依赖）

| 类型 | 接口 |
| :--- | :--- |
| 读（免签） | `/rest/n/nebula/activity/earn/overview/basicInfo` 余额 / 昵称 |
| 读（免签） | `/rest/wd/encourage/unionTask/signIn/detail` 签到日历 |
| 读（免签） | `/rest/wd/encourage/unionTask/treasureBox/info` 宝箱状态 / 冷却 |
| 读（免签） | `/rest/n/nebula/activity/earn/overview/taskCard/list` 任务卡 |
| 写（Cookie 带 egid 即免签） | `/rest/wd/encourage/unionTask/signIn/report` 签到 |
| 写 | `/rest/wd/encourage/unionTask/treasureBox/report` 开宝箱 |
| 写 | `/rest/n/nebula/task/reward` 任务卡领奖 |

**需要 `__NS_sig3`、本脚本不调**（调了必回 result=50）：

```text
/rest/n/nebula/daily/report                              每日大盘上报
/rest/n/nebula/encourage/push4coin/reward               推送金币
/rest/wd/encourage/unionTask/treasureBox/additionalReward 宝箱加码
/rest/wd/usergrowth/encourage/matrix/resource/action    资源位动作
```

### 4.2 招财鸭（H5 + Playwright）

页面 `https://nebula.kuaishou.com/games/lucky-duck/home?layoutType=4&source=TASK`，分包 `nebula/games/dist/lib/index-*.js`（653 KB）。

签到 / 喂食 / 领奖 / 饲料仓 / 饲料雨全走真实页面点击 —— 页面内签名（`__NS_sig4`，HUDR 格式）由加密 SDK 现场生成，纯 HTTP 复现不了，用浏览器跑本就是设计前提。

| 功能 | 入口 | 结果 |
| :--- | :--- | :--- |
| 签到 | `POST luckyDuck/signIn/report` body `{}` | +100 饲料 |
| 喂食 | 点喂鸭按钮 / 鸭子本体 | 饲料 -100，心情 +5 |
| 领奖 | 点「可领取 / 再喂X次领」 | 按进度发放 |
| 饲料仓 | `feedGranaryInfo` → 产满自动 `collectFeed` | 2 小时 +100 |
| 饲料雨 | `feedRain` → 20:00 `collectFeedRain` | 30 包 × 15 = +450 |

### 4.3 抓鸭子（H5 + 纯接口）

Host 是 `ppg.viviv.com`（VIVO 活动域名），路径 `/rest/activity/game/common/`。

| 接口 | 作用 |
| :--- | :--- |
| `catch-duck/v2/init` | 开局，下发 roundId + reportToken |
| `heartbeat` | 保活 |
| `catch-duck/v2/report/duck` | 抓鸭上报 level=1 |
| `catch-duck/v2/report/other` | 其他上报 level=2 + catchOtherGroupNum |

> 次数用完时 `init` 回 `100000102`，属正常。次日 0 点恢复。

### 4.4 看视频赚金币（iOS 网关）

App 自己播、自己上报，服务端按真实播放结算 —— **不伪造任何数据**。链路：

```text
青龙 ks_ios_watch.js  →  HTTP 8899  →  ks_ios_gateway.py（宿主机常驻）
                     →  frida RPC  →  frida-server（越狱设备 27042）
                     →  IOHIDEvent 注入上滑  →  App 真实播放并上报
```

---

## 五、返回码对照

| 码 | 含义 |
| :--- | :--- |
| `1` | 成功 |
| `2` | 网关参数 / 会话异常（H5 层通用失败码） |
| `11` | query 缺参数 |
| `50` | 签名验证失败 → 该接口强制 `__NS_sig3`，脚本不该调 |
| `10023` | 伪装成未登录 → 检查 kpn |
| `102006` | 已领取今天奖励（签到幂等，视作「已签」） |
| `90107` | 暂无可领奖励（视频进度卡已领完，正常） |
| `0` | 服务端异常 |

---

## 六、能力边界（诚实版）

| 任务 | 能不能全自动 | 原因 |
| :--- | :---: | :--- |
| 签到 / 宝箱 / 任务卡 / 51 任务上报 | ✅ | 纯 HTTP，Cookie 带 egid 免签 |
| 招财鸭签到 / 喂食 / 领奖 / 饲料 | ✅ | Playwright 跑真实页面 |
| 招财鸭搜索任务 | ⚠️ | 需 frida 深链，App 内行为 |
| 抓鸭子 | 🔶 | 接口通，需当日有次数换真实会话 |
| 看视频赚金币 | ⚠️ | 需网关驱动 App，且金币非实时到账 |
| 浏览金币商城 / 超值好物 | ❌ | 需 sig3，未攻破 |
| 看精彩广告 / 打赏主播 | ❌ | App 内 SDK / 需花钱 |
| 邀请好友 / 分享 | ❌ | 需真人 |

> **金币不是实时到账**：看视频推进进度条，满额后才发奖，所以「刷视频 → 跑 HTTP 脚本」要成对出现，单独跑一个不见钱。

---

## 七、常见问题

**Q：所有接口都回 result=10023？**
A：kpn 不对。网页版 Cookie 的 `KUAISHOU_VISION` 必须改。`ks_nebula_daily.js` 已自动纠偏，老版本要手动改。

**Q：写接口回 result=50？**
A：调了需要 `__NS_sig3` 的接口。看 4.1 节末尾那份「不该调」清单，脚本已经避开。

**Q：签到一直回 102006？**
A：今天已经签过了，这是幂等成功，不是报错。

**Q：招财鸭报找不到浏览器？**
A：没装 playwright 或 chromium。见 3.3 节，或设 `CHROME_PATH`。

**Q：抓鸭子 init 回 100000102？**
A：当日次数用完了，次日 0 点恢复。不是脚本问题。

**Q：看视频跑完金币没涨？**
A：进度条没满不发奖。多跑几轮，或者把 `ks_watch_n` 调大。

**Q：Cookie 多久过期？**
A：STS（`kuaishou.api_st`）有效期不固定，几天到几周。过期表现是所有接口回 10023 或未登录，重抓一次即可。

---

## 八、安全

Cookie 等同登录态：只放本机 / 自己的青龙；不贴群、不进仓库、不写日志。
脚本所有打印与推送都做过打码（Cookie 只显示前后各 4 位），但仍建议不要把 `ks_ck` 放进共享面板截图里。

> 仅供个人学习与技术研究，只对自己有权操作的账号使用。使用本脚本可能违反平台《用户协议》，由此产生的账号受限、金币清零等后果由使用者自负。
