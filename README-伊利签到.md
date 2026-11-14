# 活力伊利 · 每日签到 + 0 元抽奖（青龙版）

> 目标小程序：活力伊利（wx06af0ef532292cd3）
> 主脚本：`yili_daily.js` · 推送版式：对齐龙湖天街（一条消息看完，手机不乱折）
> 逆向细节见本地 `REPORT-伊利逆向.md`（未随仓库发布）

**从仓库下载这两个就够跑：**

```text
yili_daily.js      主脚本（签到 + 抽奖 + 推送）
sendNotify.js      推送模块（青龙自带同名文件时可跳过）
```

token 需要自己抓一次，见第二节。脚本本身零第三方依赖，不需要额外模块。

> 青龙部署：脚本管理新建 `yili_daily.js` → 环境变量 `yili_ck` → 定时任务 `task yili_daily.js` / `20 11 * * *`。

---

## 一、文件结构

   仓库里（平铺在根目录）：
    yili_daily.js          主脚本，上传青龙就跑这个
    sendNotify.js          推送模块（青龙自带，本地需这份副本）
    README-伊利签到.md       本文档

   本地开发工具（未随仓库发布）：
    deploy_yili.py         一键部署到青龙（传脚本 + 配变量 + 建定时 + 试跑）
    ql.py                  青龙 API 小工具（deploy_yili.py 依赖）
    grab_yili_ck.js        从 HAR / cURL 批量提取 token（作者自用，未随仓库发布）
    wxapkg_unpack.js       小程序包解包（同上，排错用）
    REPORT-伊利逆向.md       协议、WAF 绕过、状态语义的验证过程

   ⚠️ 以下为本机运行产物，含登录凭据，切勿提交：
    yili_token.json        token 账本（含 access-token + 手机号）
    主脚本/.yili_ck_seen.json  ck 首次出现时刻（只存哈希前 12 位）

---

## 二、取 access-token（唯一凭证）

只有一步：**抓一次包，把请求头里的** `access-token` **复制下来。**

1. PC 微信打开「活力伊利」小程序，随便点两下（产生请求即可，不用真做操作）；
2. 抓包工具（Charles / Reqable / Fiddler / Stream）筛 `msmarket.msx.digitalyili.com`；
3. 找任意一条 `/gateway/api` 请求，复制请求头里的 `access-token` 整串（约 108 字符 base64）。

拿到之后两种放法，任选：

```bash
# ① 放青龙环境变量（推荐）
yili_ck = 你的access-token

# ② 备注写法，备注会显示在推送里，方便多号区分
yili_ck = 大号#你的access-token
```

> 有效期：数小时～数天。过期表现是脚本报 🔑 token 失效（HTTP 401），重抓一次即可。
>
> access-token 是 80 字节密文，**里面没有可读的 exp**，服务端也不回过期时间 —— 算不出具体哪天过期，只能靠存活时长推测，见 3.2.1。

---

## 三、青龙配置

### 3.1 一键部署（本地工具，需 deploy_yili.py + ql.py）

    cd 脚本所在目录
    python deploy_yili.py --ck "<你的access-token>" 

它会：上传 yili_daily.js + sendNotify.js → 建/更新环境变量 yili_ck → 建定时任务「活力伊利签到」→ 试跑一次。

只更新脚本（不改变量、不改定时）：

    python deploy_yili.py --skip-env --skip-cron

### 3.2 手工配置

| 项 | 值 |
| --- | --- |
| 环境变量 | yili_ck = access-token（多账号换行或 & 分隔，可写「备注#token」） |
| 脚本 | 把 主脚本/yili_daily.js 传到青龙 scripts 目录 |
| 定时 | 20 11 * * * |
| 命令 | task yili_daily.js |
| 任务名 | 活力伊利签到 |

### 3.2.1 ck 有效期怎么判断

- access-token 是 **80 字节密文**，里面**没有可读的 exp**，服务端响应头也不回过期时间 —— 无法提前算出到期时刻；
- 但反编译能看到小程序的兜底规则：`loginTimestamp` 距今 **≥ 432e6 ms（5 天）** 就清空 token 重登
  （`app-service.js`：`(useTimeStamp()-loginTimestamp) >= 432e6` → `wxLogin()`，否则 `reLogin()`），
  即**官方按 5 天窗口**管理登录态；
- 脚本的做法：在 `yili_token.json` 里记下抓包时间 `at`，每次运行头部打印 `ck 已存活 X 小时`；
  超过 **96 小时（4 天）** 终端告警、推送里加一条「建议重抓」；
- 想随时确认有效：`node yili_daily.js --check`（只读，不签到不抽奖，退出码 0=可用 / 2=失效）；
- 青龙侧只有 token 值、没有抓包时间，所以脚本会在同目录落一个 `.yili_ck_seen.json`
  记「第一次见到这个 token 的时刻」，从第二次运行起就能打印存活时长（只存 token 的哈希前 12 位，不存明文）。

### 3.3 环境变量表

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| yili_ck | — | **必填**，access-token，多号换行/&，支持 备注#token |
| yili_activity | 2115990186556080130 | 抽奖活动 ID |
| yili_draw | 5 | 单号最多抽几次（真实上限看活动剩余次数） |
| yili_push | on | on / off / dry（dry = 只打印预览不发） |
| yili_push_style | simple | simple 一条看完 / full 每号一段（排错用） |
| TYpush | on | 推送总开关 |
| yili_delay | 3-8 | 多账号间隔秒数 |
| yili_debug | off | on 时打印每档真实请求路径与 403/WAF |
| yili_check | off | on 时只做 ck 体检（等同于 --check） |

---

## 四、本地运行

    cd 脚本所在目录
    $env:yili_ck="<token>"; node yili_daily.js

没有 yili_ck 时会自动读同目录../yili_token.json。

---

## 五、推送长什么样（按 iPhone 微信气泡排版，34 列内）

    🥛 活力伊利 11-14
    ✅ 1/2 正常 · 🎁 抽 3 次

    ① 迅速的钢铁侠 ⏳
       签到 待落库 +10积分
       抽奖 今日无次数

    ② 干净的钢铁侠 ✅
       签到 +10积分
       5积分 / 66积分 / 谢谢参与

    💰 积分余额 50（本次 +20）

    ⏳ 1 个号待落库，明日复查积分

排版规则（都是从"iPhone 上会怎么折行"倒推出来的）：

- **宽度按 34 半角（≈17 个汉字）**：iOS 微信气泡比安卓窄，42 列在 iPhone 上必折行、看着散；
- **不用长横线分隔**：\`────\` 在 iPhone 上会自己折成两截，改用空行分段；
- **一行一个信息单元**：标题 / 摘要 / 每号名字 / 每号明细 / 积分余额 / 提示，最多 8 行；
- **不重复**：单号时积分只出现在余额行；多号才在每号里带积分；
- **只在要动手时才出现提示行**（失效、异常、待落库、ck 快过期），一切正常就没有这一行；
- **耗时不进推送**，只在终端看；
- **手机号打码**：185****0000；
- yili_push_style=full 时切成"每号一段"的明细版，排错用。

## 六、状态语义（重要）

| 状态 | 含义 | 怎么处理 |
| --- | --- | --- |
| ✅ 签到成功 | sign/status 或签到日历确认已签 | 无需处理 |
| 💤 今日已签 | 跑之前就是已签状态 | 正常 |
| ⏳ 已提交待落库 | 接口回 status:true + 奖励明细，但状态/日历/积分三项都没变 | 次日看积分；详见报告第六节 |
| 🔑 token 失效 | 401，access-token 过期 | 重抓 token，更新 yili_ck |
| ❌ 异常 | 网络/接口报错 | 加 yili_debug=on 重跑看路径 |

> ⏳ 是**如实上报**，不是脚本偷懒：该写接口直连公网时只回预计算奖励、不落库（原因与验证过程见报告 6.2–6.5）。
> 脚本绝不用 status:true 冒充"签到成功"。

---

## 七、常见问题

**Q1 一直 403 / WAF 拦截？**
脚本已内置「末段双斜杠 → 首段双斜杠」两档绕过。若两档都 403，说明厂商修了归一化，需重新找绕法（报告第五节）。

**Q2 抽奖一直"今日无次数"？**
看活动详情 luckyDrawNumber。0 就是真没次数（签到 / 分享才给次数），不是脚本问题。

**Q3 推送没收到？**
yili_push 是否 off、TYpush 是否 off；本地跑要保证主脚本目录下有 sendNotify.js；
没装 sendNotify 时脚本会退化到内置渠道（QYWX_KEY / QYWX_AM / PUSH_PLUS_TOKEN / TG_BOT_TOKEN+TG_CHAT_ID / DD_BOT_TOKEN / SERVERCHAN_KEY）。

**Q4 多账号怎么写？**

    yili_ck = 大号#<token1>
    小号#<token2>

备注会成为推送里的账号名，方便一眼分清。

---

## 八、安全

access-token 等同登录态：只放本机 / 自己的青龙；不贴群、不进仓库、不写日志。
脚本所有打印与推送都做过打码，但仍建议不要把 yili_ck 放进共享面板截图里。
