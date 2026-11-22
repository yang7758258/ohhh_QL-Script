# 麦门认证机 · 麦当劳 MCP 每日闭环（青龙 / 本地）

> 按 `chuiziyao/maimen-certification`（麦门认证机）里定义的三个转化环节做成的无人值守脚本，
> 写法沿用 `miniso_signin.js` 那一套：单文件 Node、无第三方依赖、`--dry` 巡检、`sendNotify` 推送、青龙直接跑。

**从仓库下载这两个就够跑：**

~~~text
maimen_signin.js      主入口：领券闭环 / 抽奖彩蛋 / 活动钩子 / 推送
sendNotify.js         推送模块（青龙自带同名文件时可跳过）
~~~

> Token 需要自己拿一次，见第一节。脚本零第三方依赖。

| 功能 | 走法 | 本脚本做的事 |
| --- | --- | --- |
| 🎫 领券闭环 | `available-coupons` → `auto-bind-coupons` → `query-my-coupons` | 数可领券 → 一键领 → 回读卡包对账，顺带临期券预警 |
| 🎁 抽奖彩蛋 | `query-lottery-info` → `draw-lottery` | 先读 `drawDecision` 决策，过门槛才抽，可设积分保留下限 |
| 📣 活动钩子 | `campaign-calendar`（+ `now-time-info` 餐段） | 抓今日活动档期 + 下一档，拼成一行钩子文案 |

## 一、准备

1. 打开 <https://open.mcd.cn/mcp>，手机号登录 → 控制台 → 激活 → 复制 MCP Token（**不是**麦当劳 APP 账号密码）。
2. Token 放到两处之一：

~~~text
# 方式 A：环境变量（推荐，青龙就用这个）
MAIMEN_MCP_TOKEN=你的Token

# 方式 B：项目根 maimen_mcp.json
[ { "name": "主号", "token": "你的Token" } ]
~~~

多账号：`Token1&Token2` 或换行分隔，脚本会逐个跑并合并推送。
`maimen_mcp.json` 属敏感文件，勿外传、勿提交。

## 二、本地跑

~~~powershell
cd 脚本所在目录
node maimen_signin.js --dry      # 只读巡检：不领券、不抽奖
node maimen_signin.js            # 真跑：领券 + 抽奖 + 活动
~~~

只看不推：`$env:MAIMEN_PUSH="off"`（PowerShell）/ `MAIMEN_PUSH=off node ...`（bash）。

## 三、环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `MAIMEN_MCP_TOKEN` | — | 麦当劳 MCP Token，多账号 `&` 分隔（也认 `MAIMEN_TOKEN` / `MCD_MCP_TOKEN`） |
| `MAIMEN_COUPON` | on | 领券闭环开关 |
| `MAIMEN_LOTTERY` | on | 抽奖彩蛋开关 |
| `MAIMEN_LOTTERY_MAX` | 1 | 单账号单次最多抽几次（上限 5，保守默认 1） |
| `MAIMEN_POINT_FLOOR` | 0 | 抽奖后保留的最低积分，防止抽空 |
| `MAIMEN_CAMPAIGN` | on | 活动钩子开关 |
| `MAIMEN_CAMPAIGN_LIMIT` | 3 | 活动钩子展示几条标题 |
| `MAIMEN_EXPIRING` | 3 | 临期券预警阈值（天），0 = 关闭 |
| `MAIMEN_PUSH` | on | 推送开关（off 关闭） |
| `MAIMEN_MCP_URL` | 官方端点 | 覆盖 MCP 地址，默认 `https://mcp.mcd.cn/mcp-servers/mcd-mcp` |

## 四、输出样例（青龙实跑，2026-11-22 20:49）

~~~text
+-- 麦门认证机 · MCDx****pQ3z ---------------
| 餐段          2026-11-22 20:49 · 晚餐
| ✓ 活动钩子    2026年11月22日 今日 12 场：随心配1+1上麦香鸡3件套，经典又超值 ／ … ｜ 下一档 2026年11月23日 1 场
| · 领券闭环    暂无可领券 · 卡包 9 张
| ✓ 抽奖彩蛋    抽 1 次 · 消耗 24 分 · 中奖 麦辣鸡腿堡11.9元券 · 余 70.7 分 · 奖池 下单立减3元券、…
| 积分余额      70.7 麦享会积分
+--------------------------------------------------
~~~

### 推送长这样（一行一条，手机一屏看完）

~~~text
🍔 麦门认证机
🎫 领券 +7 张 · 卡包 9
⏰ 临期 人气麦旋风买一送一 剩 1 天 等 2 张
🎁 抽奖 1 次 · 中 麦辣鸡腿堡11.9元券 · 余 70.7
📣 活动 今日 12 场 · 随心配1+1上麦香鸡…
💰 积分 70.7 · 过期 9.8
~~~

推送排版规则：

- 结构固定为「图标 + 2 字短标签 + 一句话」，**不画表格线、不缩进、不加【】、不用冒号**（微信比例字体下这些都会错位）；
- 活动标题截 14 字、券名截 12 字、临期只留最近 1 张 + 「等 N 张」；
- 无内容的行直接不出现（例如无临期券就少一行），常态 4–5 行、每行 ≤ 30 字；
- **控制台仍保留完整表格**（餐段 / 奖池 / 卡包变更都在），推送只留结论——想细看进青龙日志。

## 五、青龙部署

### 5.1 手动（只用仓库里的文件）

1. 脚本管理 → 新建 → 文件名 `maimen_signin.js` → 粘贴全文；
2. 同目录再放一份 `sendNotify.js`（青龙自带可跳过）；
3. 环境变量 `MAIMEN_MCP_TOKEN` = 你的 Token；
4. 定时任务：名称「麦门认证机」，命令 `task maimen_signin.js`，`10 8 * * *`。

### 5.2 一键部署（本地工具，未随仓库发布）

~~~powershell
cd 脚本所在目录\附带脚本
node deploy_maimen.js --url http://<青龙地址>:5700 --user <账号> --pass <密码> --run
~~~

它会：上传 `maimen_signin.js` + `sendNotify.js` → 建/更环境变量 `MAIMEN_MCP_TOKEN` →
建/更定时任务 `task maimen_signin.js`（默认 `10 8 * * *`）→ 启用 → 试跑并回读日志。

- 只想看日志：`--log`
- 只预览不写：`--dry`
- 改时间：`--schedule "30 7 * * *"`
- 面板账号没脚本写权限时，脚本自动降级为「定时任务引导写入」，命令里塞 base64 自解压。

定时建议：`10 8 * * *` —— 早上 8:10 跑能赶在「早餐券 05:00–10:29」场次内领券。

## 六、常见问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `HTTP 401 当前鉴权码不存在或已失效` | Token 过期/写错/被重置 | 重新到 open.mcd.cn/mcp 控制台复制，更新 `MAIMEN_MCP_TOKEN` |
| `暂无可领券 · 卡包 N 张` | 麦麦省当日券已领完或未放券 | 正常，脚本不改任何东西 |
| `– 抽奖彩蛋  积分不足（余 0 / 单次 24 分）` | 积分不够 | 正常；脚本不抽，只打印奖池 |
| `– 抽奖彩蛋  低于积分保留下限` | `MAIMEN_POINT_FLOOR` 卡住 | 调小保留下限或攒积分 |
| 活动钩子只有「下一档」 | 当日无活动排期 | 正常，钩子会退化为下一档播报 |
| 推送没收到 | `sendNotify.js` 未同目录 / 没配推送变量 | 青龙里把 `sendNotify.js` 与主脚本平铺在同一目录，并配 `QYWX_AM` 等 |

限频：官方 600 次/分钟/Token。本脚本单账号一轮约 7–9 次调用，远低于限额。

## 七、文件清单

**仓库里（平铺在根目录）：**

~~~text
maimen_signin.js         主入口：领券闭环 / 抽奖彩蛋 / 活动钩子 / 推送
sendNotify.js            推送模块（与主脚本同目录，青龙平铺上传）
README-麦门认证机签到.md   本文档
~~~

**本地开发工具（未随仓库发布）：**

~~~text
deploy_maimen.js         一键部署青龙（上传 + 环境变量 + 定时任务 + 试跑回读）
_selftest_maimen.js      离线自检：假应答覆盖三条链路，20 项断言，0 联网
REPORT-麦门认证机逆向.md   协议与接口分析全过程
~~~

**⚠️ 本机运行产物，含凭据，切勿提交：**

~~~text
maimen_mcp.json          MCP Token 清单（多账号时用）
~~~
