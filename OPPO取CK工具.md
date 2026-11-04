# OPPO 商城取 CK 工具

OPPO 商城（hd.opposhop.cn）的登录凭据不好拿 —— 密码登录要过网易易盾风控，
抓包又要装证书。这个工具把「拿凭据」压缩成一条短信的距离。

> **三种形态，功能一样，按需选一个：**
>
> | 形态 | 文件 | 适合 |
> | :--- | :--- | :--- |
> | 便携 exe | `OPPO-Shop-CK-Tool-*.exe`（Release 附件，约 71 MB） | Windows，不想装 Node |
> | 本地网页面板 | `oppo_ck_panel.js` + `oppo_ck_panel.html` | 装了 Node，任何系统 |
> | Electron 源码 | 本地 `oppo_ck_app/` | 想自己改 UI / 重新打包 |

---

## 一、它做什么

```text
输手机号  →  点「获取验证码」  →  手机收到短信  →  输进面板  →  自动校验  →  推送到青龙
```

拿到的是 **能直接用** 的凭据：不是「抓到了就算」，而是先拿它打一次会员信息接口，
接口返回 `"login":true` 才认。所以不会出现凭据塞进青龙、跑任务才发现失效的情况。

## 二、用法

### 2.1 exe 版

1. 从 [Releases](https://github.com/yang7758258/ohhh_QL-Script/releases) 下载 `OPPO-Shop-CK-Tool-*.exe`
2. 双击运行（单文件便携版，不用安装）
3. 点右上角 ⚙ 填青龙信息（**首次是空表，填一次存在本机，程序里不带任何默认值**）

   | 项 | 例子 |
   | :--- | :--- |
   | 面板地址 | `http://192.168.1.10:5700` |
   | 用户名 | 青龙登录名 |
   | 密码 | 青龙登录密码 |
   | 环境变量名 | `oppo_ck`（默认，一般不改） |

4. 输手机号（11 位），点「获取验证码」
5. 程序自动拉起 Chrome 打开 OPPO 商城 → 切到「验证码登录」→ 填手机号 → 点获取验证码
6. 手机上收到 6 位码，填进面板点「登录」
7. 校验通过后显示 **类型 / 账号 / 积分 / 有效期**，点「推送到青龙」

> 那个自动弹出的 Chrome 窗口**不用管它**，全自动操作。嫌碍眼可以设 `OPPO_HEADLESS=1` 隐藏，
> 但第一次用建议留着，卡住时能看到停在哪一步。

### 2.2 网页面板版

```bash
node oppo_ck_panel.js                 # 默认 http://127.0.0.1:7788/
node oppo_ck_panel.js --port 7788 --open
```

同目录需要 `oppo_login.js`（提供 CDP / WS / launchChrome）和 `oppo_ck_panel.html`。

## 三、拿到的是什么

两种凭据，工具会自己挑：

| 类型 | 特征 | 有效期 | 用途 |
| :--- | :--- | :--- | :--- |
| `TOKENSID` | 以 `TOKEN_` 打头，JWT 格式 | 约 **30 天** | 优先，脚本解析 `exp` 算剩余天数 |
| `NEWOPPOSID` | 随机串 | 约 **1 天** | 只有拿不到 TOKENSID 时才用 |

两者都能读写 `hd.opposhop.cn/api/cn/oapi/marketing/**` 的全部接口：

```text
GET  /api/cn/oapi/marketing/member/queryMemberCreditInfo   → login:true，能看积分
POST /api/cn/oapi/marketing/cumulativeSignIn/signIn          → 能签到（写权限也通）
```

**存进青龙的格式带前缀**：

```text
oppo_ck = TOKENSID=TOKEN_xxxxx…      ← 正确
oppo_ck = NEWOPPOSID=eyJpdiI6…        ← 正确
oppo_ck = TOKEN_xxxxx…               ← 也行，主脚本会按内容判类型
```

前缀很重要 —— 主脚本靠它分辨类型，写反了会被当成另一种凭据发出去。工具已经替你带好前缀，
**不要手工去掉**。

## 四、和主脚本的关系

| 场景 | 用什么 |
| :--- | :--- |
| 日常跑 | 主脚本 `oppo_store_daily.js`，配 `oppo_account`（手机号#密码）或 `oppo_ck` |
| 第一次部署，手上没凭据 | 用本工具拿一个，推成 `oppo_ck` 先跑起来 |
| 密码登录被风控 11208 | 用本工具走短信登录，绕开密码链路 |
| TOKENSID 过期懒得抓包 | 用本工具重新拿一个 |

推完之后青龙里会多／更新一个 `oppo_ck`，主脚本下一轮直接用。

> 主脚本的回退顺序：先用 `oppo_account` 登录，失败再用 `oppo_ck`。
> 两个都配 = 自动登录 + 兜底，最稳。

## 五、环境变量（可选）

| 变量 | 默认 | 说明 |
| :--- | :--- | :--- |
| `OPPO_CHROME` | 自动探测 | 指定浏览器 exe。默认依次找 Chrome → Edge |
| `OPPO_BROWSER_PROFILE` | `~/.oppo-store-profile` | 浏览器 profile 目录，**持久化才有会话复用** |
| `OPPO_DEBUG_PORT` | `9333` | CDP 调试端口 |
| `OPPO_HEADLESS` | `0` | 设 `1` 则不弹 Chrome 窗口 |
| `OPPO_PANEL_PORT` | `7788` | 网页面板监听端口（仅 `oppo_ck_panel.js`） |

## 六、原理（一句话版）

登录链里的 `authn/check` 要请求头 `x-euler-const` —— 那是**网易易盾**的静默风控 token，
由页面 SDK 采集环境指纹实时生成，纯 HTTP 合不出来。所以只能开真浏览器。

本工具用的是 **原生 Chrome + `--remote-debugging-port` + `--disable-blink-features=AutomationControlled`**：

- `navigator.webdriver === false`（数据属性），风控认可，登录通过
- Playwright / Puppeteer 默认带 `--enable-automation`，此时 `navigator.webdriver === true`，必被 11208
- **不要**再往页面里注入 `navigator.webdriver` 的伪造 getter —— 会被 SDK 的 `getOwnPropertyDescriptor` 校验识破

营销接口本身不吃签名，只吃 cookie，所以拿到凭据之后主脚本纯 HTTP 就能跑。

## 七、常见问题

**Q：提示「没找到浏览器」**
A：本机没装 Chrome 或 Edge。装一个，或设 `OPPO_CHROME` 指向浏览器 exe。

**Q：卡在「点击登录入口」**
A：商城首页加载慢，或网络到 `www.opposhop.cn` 不通。查网络后重试。

**Q：提示「触发了图形验证」**
A：这个账号／网络被要求人工过滑块。等一段时间再试，或换个网络环境。

**Q：验证码输进去提示不对**
A：短信 5 分钟内有效；超时点「重新获取」。别把上一次的码填进去。

**Q：提示「抓到了 cookie 但接口不认」**
A：说明登录没真正完成。看后面括号里每个候选的失败原因：

```text
TOKENSID ✗ code=5008(saved)     → 这个 token 已过期
NEWOPPOSID ✗ login=false        → 登录态没落稳，重试一次
HTTP 403 非 JSON                → 网络被拦，检查代理
```

重试一次通常就好；连续失败就看那个自动弹出的 Chrome 窗口停在哪一页。

**Q：推送青龙失败「错误的用户名密码」**
A：青龙账号密码填错了，点右上角 ⚙ 改。改完记得和其他脚本里的青龙变量保持一致。

**Q：exe 打不开／一闪就没**
A：如果系统环境里设了 `ELECTRON_RUN_AS_NODE=1`，Electron 会当纯 Node 跑然后崩。
清掉这个变量，或从资源管理器双击。

## 八、安全说明

- 程序**不含任何默认地址或账号**，青龙连接信息全部由使用者本机填写
- 凭据只在本机内存和青龙环境变量之间流转，不上传任何第三方服务器（校验请求直连 `hd.opposhop.cn`）
- 本机配置文件存在你自己的用户目录下，删掉即清除
- 拿到的是你自己的登录凭据，**等同于账号密码的部分权限**，别贴到群里或截图发出去

## 九、自己重新打包

```powershell
cd 附带脚本/oppo_ck_app
npm install
npx electron-builder --win portable \
  --config.electronDist=./node_modules/electron/dist \
  --config.win.signAndEditExecutable=false
# 产物：dist/OPPO商城取CK.exe
```

改 UI 就改 `ui.html`；改逻辑就改 `panel.js`；`core.js` 是主脚本 `oppo_login.js` 的副本。

---

> 仅供学习研究，请合理使用，风险自负。