# README · OPPO 商城取 CK 工具（exe）

> **v1.2** · 单文件便携版，双击即用，约 71 MB
>
> | 形态 | 文件 | 适合 |
> | :--- | :--- | :--- |
> | 便携 exe | [OPPO-Shop-CK-Tool-v1.2.exe](https://github.com/yang7758258/ohhh_QL-Script/releases/download/v1.2/OPPO-Shop-CK-Tool-v1.2.exe) | Windows，不想装 Node |
> | 网页版 | `oppo_ck_panel.js` + `oppo_ck_panel.html` | 装了 Node，任何系统 |
> | Electron 源码 | 本地 `oppo_ck_app/` | 想改 UI / 自己重新打包 |
>
> SHA256 `4deea086f241c4d38d37d916a758aae85f780313ce2fbe84ad47ccff40391cc6`

---

## 零、版本

| 版本 | 日期 | 变更 |
| :--- | :--- | :--- |
| v1.2 | 2026-11-04 | 候选池 + 逐个校验；TOKENSID 优先；面板显示类型/账号/积分/有效期 |
| v1.1 | 2026-11-02 | 带上 `NAME=` 前缀写入，修主脚本判型失败 |
## 一、它是干什么的

**手机号 + 短信验证码登录 OPPO 商城 → 自动抓 `NEWOPPOSID` → 一键写进青龙环境变量。**

不用抓包，不用 App，不用记 token。

```text
输手机号  →  点「获取验证码」  →  手机收到短信  →  输进面板  →  拿到凭据  →  推送到青龙
```

## 二、怎么用

1. 双击 `OPPO商城取CK.exe`
2. 点右上角 ⚙ 填青龙信息（**第一次用是空表，填一次就存在本机**，程序里不带任何默认值）：

   | 项 | 例子 |
   | --- | --- |
   | 面板地址 | `http://1.2.3.4:5700` |
   | 用户名 | 青龙登录名 |
   | 密码 | 青龙登录密码 |
   | 环境变量名 | `oppo_ck`（默认值，一般不用改） |

3. 输手机号（11 位），点「获取验证码」
4. 它会自己拉起一个 Chrome 窗口，打开 OPPO 商城 → 切到「验证码登录」 → 填手机号 → 点获取验证码
5. 手机上收到 6 位码，填进面板点「登录」
6. 成功后显示凭据，点「推送到青龙」

> 面板里那个 Chrome 窗口**不用管它**，全自动操作。嫌它碍眼可以用 `OPPO_HEADLESS=1` 隐藏（见第五节）。

## 三、拿到的是什么

OPPO 商城有两套凭据，都能读写 `hd.opposhop.cn` 全部营销接口，**工具会自己判断抓到的是哪种、并当场校验**：

| 类型 | 长相 | 有效期 | 说明 |
| --- | --- | --- | --- |
| `TOKENSID` | `TOKEN_<b64>.<b64>.<b64>` | 约 30 天 | App 侧令牌，**优先选它**，最省心 |
| `NEWOPPOSID` | `eyJpdiI6...`（base64 的 `{"iv","value","mac"}`） | 约 1 天 | Web 登录一定有 |

**写进青龙的格式永远是「类型=值」**，不会给你裸值：

```text
TOKENSID=TOKEN_eyJhbGciOi...
NEWOPPOSID=eyJpdiI6...
```

### 3.1 抓到之后会先校验

不是抓到就算完 —— 拿到候选 cookie 后立刻打一次：

```text
GET https://hd.opposhop.cn/api/cn/oapi/marketing/member/queryMemberCreditInfo
```

只有回 `code:200` 且 `data.login === true` 才认。界面上会直接显示**凭据类型 / 账号昵称 / 积分 / 有效期**，你能一眼确认抓的是不是自己那个号、还能用多久。校验不过就换下一个候选，全都不行就报错，不会把废凭据推进青龙。

### 3.2 之前为什么抓出来「不对」

三个坑，现在都堵上了：

| # | 坑 | 现在怎么处理 |
| --- | --- | --- |
| 1 | 只取**第一个** `NEWOPPOSID`。同一条 cookie 可能同时躺在 `.opposhop.cn` 和 `www.opposhop.cn`，profile 持久化后上次的旧值还在 → 抓到的可能是早已失效的那条 | 先把所有 OPPO 域 cookie 全捞出来做候选池，**逐个拿去问接口**，谁认用谁 |
| 2 | 存青龙时**没带 `NAME=` 前缀**。主脚本靠前缀判类型，裸值会掉进 `TOKENSID=<那一串>` 分支 → 必然 `login:false` | 一律输出 `类型=值`；推送接口再兜底补一次前缀 |
| 3 | **没校验**，抓错了也显示成功，等跑任务才发现 | 见 3.1 |

顺带主脚本也做了兼容：直接贴裸 `NEWOPPOSID` 现在也能认（靠 `eyJpdiI6` 特征识别），三种写法随便贴。

## 四、和主脚本的关系

| 场景 | 用什么 |
| --- | --- |
| 日常跑 | 主脚本 `oppo_store_daily.js`，配 `oppo_account` 或 `oppo_ck` |
| 密码登录被风控 11208 | 用本工具走短信登录，把结果推成 `oppo_ck`，主脚本立刻能用 |
| 第一次部署没凭据 | 用本工具拿一个，推成 `oppo_ck` 先跑起来 |

推完之后青龙里会多/更新一个 `oppo_ck`，主脚本下一轮就会用它。

## 五、环境变量（可选）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `OPPO_CHROME` | 自动探测 | 指定浏览器 exe。默认找 Chrome → Edge |
| `OPPO_BROWSER_PROFILE` | `~/.oppo-store-profile` | 浏览器 profile 目录 |
| `OPPO_DEBUG_PORT` | `9333` | CDP 调试端口 |
| `OPPO_HEADLESS` | `0` | 设 `1` 则不弹 Chrome 窗口 |

## 六、原理（一句话版）

登录链里的 `authn/check` 要请求头 `x-euler-const` —— 那是网易易盾的静默风控 token，
由页面 SDK 采集环境指纹实时生成，纯 HTTP 合不出来。所以只能开真浏览器。
本工具用的是**原生 Chrome + `--remote-debugging-port` + `--disable-blink-features=AutomationControlled`**，
`navigator.webdriver === false`（数据属性），能过风控；Playwright/Puppeteer 默认带 `--enable-automation`，必被 11208。

完整攻关路径见 `REPORT-OPPO商城逆向.md` 第七章。

## 七、常见问题

**Q：提示「没找到浏览器」**
A：本机没装 Chrome 或 Edge。装一个，或设 `OPPO_CHROME` 指向浏览器 exe。

**Q：卡在「点击登录入口」**
A：商城首页加载慢或者网络到 `www.opposhop.cn` 不通。检查网络后重试。

**Q：提示「触发了图形验证」**
A：这个账号/网络被要求人工过滑块。等一段时间再试，或换个网络环境。

**Q：验证码输进去提示不对**
A：短信 5 分钟内有效；超时点「重新获取」。注意别把上次的码填进去。

**Q：推送失败「错误的用户名密码」**
A：青龙账号密码填错了，点右上角 ⚙ 改。

**Q：exe 打不开 / 一闪就没**
A：如果系统环境里设了 `ELECTRON_RUN_AS_NODE=1`，Electron 会当纯 Node 跑然后崩。
   在启动前清掉这个变量，或者用 `start ""` 从资源管理器双击。

## 八、重新打包

```powershell
cd "D:\Desktop\工作区\脚本\OPPO商城\附带脚本\oppo_ck_app"
npm install
npx electron-builder --win portable --config.electronDist=./node_modules/electron/dist --config.win.signAndEditExecutable=false
# 产物：dist\OPPO商城取CK.exe
```

改 UI 就改 `ui.html`；改逻辑就改 `panel.js`；`core.js` 是 `主脚本/oppo_login.js` 的副本。
