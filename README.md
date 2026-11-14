### Script Overview · 喜欢请点个 🌟

> 青龙面板自动化脚本合集 · 维护：[Mist](https://github.com/yang7758258)

| # | 项目名称 | 脚本文件 | 环境变量 | 建议定时 | 状态 |
|:-:|:--------|:--------|:--------|:--------|:---:|
| 1 | 中国联通（全功能） | [chinaUnicom.py](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/chinaUnicom.py) | `chinaUnicomCookie` | `0 7,20 * * *` | ✅ |
| 2 | 中国联通（全任务包装器） | [unicom_tasks.py](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/unicom_tasks.py) | — | 被 unicom_signin.js 调用 | ✅ |
| 3 | 中国联通（签到） | [unicom_signin.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/unicom_signin.js) | `unicom` | `45 8 * * *` | ✅ |
| 4 | 中国联通（自动登录） | [unicom_auto_login.py](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/unicom_auto_login.py) | `UNICOM_MOBILE` / `UNICOM_PASSWORD` | 按需 | ✅ |
| 5 | 中国联通（验证码核心） | [cap_solver.py](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/cap_solver.py) | — | 被调用 | ✅ |
| 6 | 中国联通（云盘活动） | [unicom_cmf.py](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/unicom_cmf.py) | `unicom_cmf` | 被 unicom_signin.js 调用 | ✅ |
| 7 | 中国联通（项目说明） | [README-中国联通签到.md](https://github.com/yang7758258/ohhh_QL-Script/blob/main/README-%E4%B8%AD%E5%9B%BD%E8%81%94%E9%80%9A%E7%AD%BE%E5%88%B0.md) | — | 文档 | ✅ |
| 8 | 中国南方航空 | [csair_signin.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/csair_signin.js) | `CSAIR_CK` / `CSAIR_ACCOUNT` | `22 8 * * *` | ✅ |
| 9 | OPPO 商城（签到） | [oppo_store_daily.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/oppo_store_daily.js) | `oppo_account` / `oppo_ck` | `10 9 * * *` | ✅ |
| 10 | OPPO 商城（取 CK 面板） | [oppo_ck_panel.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/oppo_ck_panel.js) | 见 [说明](https://github.com/yang7758258/ohhh_QL-Script/blob/main/README-OPPO%E5%8F%96CK%E5%B7%A5%E5%85%B7.md) | 手动运行 | ✅ |
| 11 | OPPO 商城（登录核心） | [oppo_login.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/oppo_login.js) | `OPPO_CHROME` 等 | 被调用 | ✅ |
| 12 | OPPO 商城（面板界面） | [oppo_ck_panel.html](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/oppo_ck_panel.html) | — | 被面板加载 | ✅ |
| 13 | 龙湖天街（签到） | [longhu_signin.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/longhu_signin.js) | `longhu_token` | `10 8 * * *` | ✅ |
| 14 | 龙湖天街（指纹模块） | [longhu_dxrisk.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/longhu_dxrisk.js) | — | 被主脚本 require | ✅ |
| 15 | 龙湖天街（取 Token 工具） | [龙湖取Token.exe](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/%E9%BE%99%E6%B9%96%E5%8F%96Token.exe) | — | 手动运行 | ✅ |
| 16 | 龙湖天街（项目说明） | [README-龙湖天街签到.md](https://github.com/yang7758258/ohhh_QL-Script/blob/main/README-%E9%BE%99%E6%B9%96%E5%A4%A9%E8%A1%97%E7%AD%BE%E5%88%B0.md) | — | 文档 | ✅ |
| 17 | 雨云（签到） | [rainyun_signin.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/rainyun_signin.js) | `rainyun_account` | `10 0 * * *` | ✅ |
| 18 | 雨云（验证码识别） | [rainyun_cap.py](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/rainyun_cap.py) | — | 被主脚本调用 | ✅ |
| 19 | 雨云（项目说明） | [README-雨云签到.md](https://github.com/yang7758258/ohhh_QL-Script/blob/main/README-%E9%9B%A8%E4%BA%91%E7%AD%BE%E5%88%B0.md) | — | 文档 | ✅ |
| 20 | 活力伊利（签到 + 抽奖） | [yili_daily.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/yili_daily.js) | `yili_ck` | `20 11 * * *` | ✅ |
| 21 | 活力伊利（取 ck 工具） | [grab_yili_ck.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/grab_yili_ck.js) | `QL_URL` / `QL_USER` / `QL_PASS` | 手动运行 | ✅ |
| 22 | 活力伊利（解包工具） | [wxapkg_unpack.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/wxapkg_unpack.js) | — | 排错用 | ✅ |
| 23 | 活力伊利（项目说明） | [README-伊利签到.md](https://github.com/yang7758258/ohhh_QL-Script/blob/main/README-%E4%BC%8A%E5%88%A9%E7%AD%BE%E5%88%B0.md) | — | 文档 | ✅ |
| 24 | 顺丰速运+ | [sf_qinglong.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/sf_qinglong.js) | `SfsyUrl` | `0 9 * * *` | ✅ |
| 25 | 麦斯威尔福利社 | [mswefls.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/mswefls.js) | `mswefls` | `10 12 * * *` | ✅ |
| 26 | Keep 奖牌 | [keep.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/keep.js) | `Keep` | `10 12 * * *` | ✅ |
| 27 | 顾家家居 | [gjjj.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/gjjj.js) | `gjjj` | `0 7,17 * * *` | ✅ |
| 28 | 好奇车生活 | [hqcsh.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/hqcsh.js) | `hqcsh` | `0 6,18 * * *` | ✅ |
| 29 | 海天美味馆 | [htmwg.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/htmwg.js) | `htmwg` | `0 9,18 * * *` | ✅ |
| 30 | 健达福利社 | [jdfls.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/jdfls.js) | `jdfls` | `10 11,12 * * *` | ✅ |
| 31 | 富士 instax | [fsinstax.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/fsinstax.js) | `fsinstax` | `10 8 * * *` | ✅ |
| 32 | 仰韶会员俱乐部 | [yshyjlb.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/yshyjlb.js) | `yshyjlb` | `10 10,16 * * *` | ✅ |
| 33 | 毛铺草本荟 | [mpcbh.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/mpcbh.js) | `mpcbh` | `30 8,18 * * *` | ✅ |
| 34 | 雀巢会员俱乐部 | [qchyjlb.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/qchyjlb.js) | `qchyjlb` | `0 9 * * *` | ✅ |
| 35 | 日清体验馆 | [rqtyg.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/rqtyg.js) | `rqtyg` | `30 6 * * *` | ✅ |
| 36 | 爷爷不泡茶 | [yybpc.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/yybpc.js) | `yybpc` | `10 8 * * *` | ✅ |
| 37 | Zippo 芝宝 | [zippo.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/zippo.js) | `zippo` | `0 0,7 * * *` | ✅ |
| 38 | 推送模块 | [sendNotify.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/sendNotify.js) | 见文件内注释 | 被调用 | 公共件 |
| 39 | 远程通知 | [Notice.json](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/Notice.json) | — | 被调用 | 公共件 |

---

## 一、快速开始（青龙面板）

```bash
# 1. 拉库
ql repo https://github.com/yang7758258/ohhh_QL-Script.git "js$|py$" "" "sendNotify"

# 2. 装依赖（Python 脚本需要）
pip3 install requests pycryptodome
```

也可以手动：**脚本管理 → 新建脚本** → 粘贴代码 → **环境变量** 按上表填写。

---

## 二、环境变量速查

### 中国联通 `chinaUnicom.py`（全功能版）

```bash
# 三选一，多账号用 & 或换行分隔
export chinaUnicomCookie="手机号#登录密码"     # 自动取 Token，推荐
export chinaUnicomCookie="Token#AppId"        # 免密模式
export chinaUnicomCookie="Token"              # 仅 Token

# 可选
export UNICOM_PROXY_API="代理提取链接"
export UNICOM_PROXY_TYPE="socks5"             # http / socks5
export UNICOM_GRAB_AMOUNT="5"                 # 抢兑面额
export UNICOM_TEST_MODE="query"               # 只查资产不跑任务
```

覆盖模块：首页签到 / 联通祝福 / 天天领现金 / 权益超市 / 安全管家 / 联通云盘 / 联通阅读 / 联通爱听 / 沃云手机 / 区域专区。

### 中国联通 `unicom_tasks.py`（全任务包装器）

不需要单独配置。`unicom_signin.js` 完成签到后会自动调用它，复用已拿到的 `ecs_token` 跳过登录链，跑 `chinaUnicom.py` 的 10 个模块。

```bash
export unicom_all="on"           # 扩展任务总开关，默认 on
export unicom_all_skip="enable_woread,enable_aiting"   # 跳过指定模块
export unicom_woread="off"       # 单独关闭阅读
```

> 前提：`chinaUnicom.py`、`unicom_tasks.py`、`unicom_signin.js` 三个文件在同一目录。

### 中国联通 `unicom_signin.js`

```bash
export unicom="手机号:登录密码"                # 推荐，全自动
export unicom="主号#手机号:登录密码"           # 带备注
export unicom="手机号:登录密码"                # 多账号换行分隔

export unicom_pwd="登录密码"                   # 单独提供密码
export unicom_ck="ecs_token"                   # 已有 token 时的兜底
export unicom_tasks="on"                       # 任务中心开关
export unicom_monthsign="on"                   # 月签有礼
export unicom_cmf="on"                         # 云盘乘风破浪2026（需 unicom_cmf.py + lt_cmf2026.py）
export unicom_probe="on"                       # 只探针，不签到

# 推送排版：simple 一账号一行（默认）/ full 旧版逐条明细
export unicom_push_style="simple"

# 设备指纹：同一账号永远同一台设备，改 seed 等于换一台「新手机」
export unicom_device_seed="mist-2026"
export unicom_device_os="17.6.1"
```

> 完整说明（环境变量全表、推送样式、自动续期三种落地方式、常见问题）：
> [README-中国联通签到.md](https://github.com/yang7758258/ohhh_QL-Script/blob/main/README-%E4%B8%AD%E5%9B%BD%E8%81%94%E9%80%9A%E7%AD%BE%E5%88%B0.md)

### 中国南方航空 `csair_signin.js`

```bash
export CSAIR_CK="cs1246643sso 的值"            # 通道A，多账号换行
export CSAIR_ACCOUNT="手机号#密码#openId#unionId"  # 通道B

export CSAIR_MODE="all"                        # all / sign / probe
export CSAIR_DELAY="6-15"                      # 多账号间隔秒
export CSAIR_NOTIFY="0"                        # 关闭推送
```

### OPPO 商城 `oppo_store_daily.js`

```bash
# 二选一，也可以都配（oppo_account 优先，oppo_ck 作兜底）
export oppo_account="手机号#密码"        # 推荐，自动登录，多账号换行
export oppo_ck="TOKEN_eyJhbGciOi..."     # 兜底，TOKENSID 约 30 天 / 也接受 NEWOPPOSID=xxx

# 可选
export oppo_push="on"                    # on / off / dry（dry 只打印不发送）
export oppo_delay="3-8"                  # 多账号间隔秒
export oppo_browse="on"                  # 任务前真去 GET 一次落地页
export oppo_raffle_max="20"              # 单活动最多抽几次
export oppo_activities=""                # 追加任务活动 ID，逗号分隔
export oppo_raffles=""                   # 追加抽奖活动 ID，逗号分隔
export oppo_sign_activity="2116078703745441792"
export oppo_login_off="off"              # on = 跳过密码登录，只用 oppo_ck
export oppo_debug="off"                  # on = 打印原始响应
```

密码登录需要本机有浏览器（自动探测 Chrome / Edge）：

```bash
export OPPO_CHROME=""                    # 浏览器可执行文件路径
export OPPO_BROWSER_PROFILE="~/.oppo-store-profile"   # 持久化才有会话复用
export OPPO_HEADLESS="1"                 # 0 = 有头，本地排错用
export OPPO_DEBUG_PORT="9333"            # CDP 端口
export OPPO_SMS_CODE=""                  # 触发短信二次验证时用
export OPPO_SMS_FILE=""                  # 短信验证码文件（脚本轮询）
```

> 三个文件要一起放：`oppo_store_daily.js` + `oppo_login.js` + `sendNotify.js`。

### OPPO 商城取 CK 面板 `oppo_ck_panel.js`

没有凭据时用它：输手机号 → 收短信 → 拿凭据 → **先校验可用** → 一键写进青龙 `oppo_ck`。

> 2026-11-04 起，抓到的 cookie 会先拿去打一次会员信息接口，接口认了才收下 ——
> 不会出现「塞进青龙才发现不能用」。候选里有 TOKENSID（约 30 天）就优先用它，
> 只有 NEWOPPOSID（约 1 天）时才退回短凭据。

```bash
node oppo_ck_panel.js                    # 默认起本地面板，自动开浏览器
node oppo_ck_panel.js --port 7788 --open
```

同目录需要 `oppo_login.js` + `oppo_ck_panel.html`。

**不想装 Node？用打包好的 exe（需下载，不进仓库）：**

> 📦 [OPPO-Shop-CK-Tool-v1.2.exe](https://github.com/yang7758258/ohhh_QL-Script/releases/download/v1.2/OPPO-Shop-CK-Tool-v1.2.exe) · 约 71 MB · 单文件便携版，双击即用
>
> SHA256 `4deea086f241c4d38d37d916a758aae85f780313ce2fbe84ad47ccff40391cc6`
> 完整说明：[README-OPPO取CK工具.md](https://github.com/yang7758258/ohhh_QL-Script/blob/main/README-OPPO%E5%8F%96CK%E5%B7%A5%E5%85%B7.md) · 全部 Release：[releases](https://github.com/yang7758258/ohhh_QL-Script/releases)

### 龙湖天街 `longhu_signin.js`

```bash
export longhu_token="主号#a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6#pixel7"   # token，多账号换行
export longhu_app="auto"            # APP 入口：auto 真签 / manual 只查 / off 关
export longhu_push="on"             # on / off / dry（只打印不发）
export longhu_push_style="simple"   # simple 紧凑一条 / full 每号一段（排错用）
export longhu_delay="5-15"          # 多账号随机间隔（秒）
```

| 变量 | 必需 | 默认 | 说明 |
| :--- | :---: | :--- | :--- |
| `longhu_token` | ✅ | — | 三种写法：`token` / `备注#token` / `备注#token#机型`，多账号换行 |
| `longhu_dx` | ⬜ | 空 | 真机 App 指纹，一般不用填（脚本自动签发） |
| `longhu_dx_profile` | ⬜ | `pixel7` | pixel7 / xiaomi14 / oneplus12 / vivo_x100 / samsung_s24 |
| `longhu_dx_fresh` | ⬜ | `off` | on = 丢缓存重签指纹（换机或被打风控后用） |
| `longhu_app` | ⬜ | `auto` | APP 入口模式 |
| `longhu_push` | ⬜ | `on` | 推送开关 |
| `longhu_push_style` | ⬜ | `simple` | 推送版式 |
| `longhu_delay` | ⬜ | `5-15` | 多账号间隔 |
| `longhu_debug` | ⬜ | `off` | on 打印原始报文 |

> token 有效期 30 天且滑动续期，拿一次就够。取 token 用 `龙湖取Token.exe`（手机号 + 短信验证码）
> 或 `grab_longhu_token.js`（从 HAR / cURL 抠）。完整说明：[README-龙湖天街签到.md](https://github.com/yang7758258/ohhh_QL-Script/blob/main/README-%E9%BE%99%E6%B9%96%E5%A4%A9%E8%A1%97%E7%AD%BE%E5%88%B0.md)

> ⚠️ 同目录的 `longhu_dx_cache.json` / `longhu_token.json` / `取Token-设置.json` / `取Token-指纹.json` 是本机运行产物，含 token、手机号、青龙密码，**不要提交不要外传**。

### 雨云 `rainyun_signin.js`

```bash
export rainyun_account="手机号#密码"      # 多账号用 & 或换行
export rainyun_push="1"                  # 填任意值即开启推送
export rainyun_captcha="auto"            # auto / off（off 只跑免票通道）
export rainyun_debug="1"                 # 1 打印识别细节 / force 已领取也强制提交
```

| 变量 | 必需 | 说明 |
| :--- | :---: | :--- |
| `rainyun_account` | ✅ | `手机号#密码`，多账号 `&` 或换行分隔 |
| `rainyun_push` | ⬜ | 填任意值开启推送（走 `sendNotify.js`） |
| `rainyun_captcha` | ⬜ | `auto`（默认）/ `off` |
| `rainyun_debug` | ⬜ | `1` 识别细节 / `force` 强制重提交 |
| `YZ_CHROME` | ⬜ | 浏览器路径，青龙已内置 |
| `RY_PYTHON` | ⬜ | 指定 python3，默认自动探测 |

> 三个文件（`rainyun_signin.js` + `rainyun_cap.py` + `sendNotify.js`）必须平铺在同一目录。
> 命令要带 `task` 前缀（`task rainyun_signin.js`），否则 NODE_PATH 不带依赖缓存，require 会失败。
> 完整说明：[README-雨云签到.md](https://github.com/yang7758258/ohhh_QL-Script/blob/main/README-%E9%9B%A8%E4%BA%91%E7%AD%BE%E5%88%B0.md)
### 活力伊利 `yili_daily.js`

```bash
export yili_ck="大号#access-token"     # 必填，多账号换行或 & 分隔
export yili_draw="5"                  # 单号最多抽几次（真实上限看活动剩余）
export yili_push="on"                 # on / off / dry（只打印不发）
export yili_push_style="simple"       # simple 一条看完 / full 每号一段
export yili_delay="3-8"               # 多账号间隔秒数
```

| 变量 | 必需 | 默认 | 说明 |
| :--- | :---: | :--- | :--- |
| `yili_ck` | ✅ | — | access-token，多号换行或 `&`，支持 `备注#token` |
| `yili_activity` | ⬜ | 活动 ID | 抽奖活动 ID，一般不改 |
| `yili_draw` | ⬜ | `5` | 单号最多抽几次 |
| `yili_push` | ⬜ | `on` | on / off / dry |
| `yili_push_style` | ⬜ | `simple` | 推送版式 |
| `yili_delay` | ⬜ | `3-8` | 多账号间隔 |
| `yili_debug` | ⬜ | `off` | on 打印真实请求路径与 403/WAF |
| `yili_check` | ⬜ | `off` | on 只做 ck 体检（等同 `--check`） |

> access-token 只有 80 字节密文，**没有可读的 exp**，服务端也不回过期时间 —— 脚本按官方 5 天窗口推，
> 超过 96 小时会在终端告警、推送里加「建议重抓」。随时手动体检：`node yili_daily.js --check`（退出码 0=可用 / 2=失效）。

> 状态里有个 `⏳ 已提交待落库` —— 接口回 `status:true` 且有奖励明细，但状态/日历/积分三项都没变。
> 这是如实上报，脚本不用 `status:true` 冒充签到成功。完整说明：[README-伊利签到.md](https://github.com/yang7758258/ohhh_QL-Script/blob/main/README-%E4%BC%8A%E5%88%A9%E7%AD%BE%E5%88%B0.md)
### 顺丰速运+ `sf_qinglong.js`

```bash
export SfsyUrl="suuid=xxx; sessionId=xxx; _login_mobile_=xxx"   # 必填
export sfck="suuid"                            # 单填 suuid 时的补充
export sfsess="sessionId"                      # 单填 sessionId 时的补充
export sfcheck="1"                             # 自检模式
export sfkeep="1"                              # 保活模式
export sf_tasks="off"                          # 跳过任务只签到
```

### 其余微信小程序脚本

统一格式 `export <变量名>= <凭证>`，多账号换行或 `#` 分隔。变量名见上表，每个脚本头部注释里也写了抓包位置。

---

## 三、更新说明

| 日期 | 内容 |
|:---|:---|
| **2026-11-14** | 🥛 **新增活力伊利**：`yili_daily.js`（每日签到 + 0 元抽奖 + 积分回显，签到状态/签到/日历三路交叉确认，403/WAF 两档绕过，推送按 iPhone 气泡 34 列排版）<br>🔧 `grab_yili_ck.js` 从 HAR / cURL 一键抠 access-token，`wxapkg_unpack.js` 解 V1MMWX 加密包<br>📄 [README-伊利签到.md](https://github.com/yang7758258/ohhh_QL-Script/blob/main/README-%E4%BC%8A%E5%88%A9%E7%AD%BE%E5%88%B0.md) 含 ck 寿命推算与状态语义说明<br>🔒 隐私清理：取 ck 工具不内置青龙地址/账号/密码，连接信息只从环境变量读；文档手机号与本机路径全部脱敏 |
| **2026-11-10** | 🏬 **新增龙湖天街**：`longhu_signin.js`（小程序 + APP 双入口签到、token 滑动续期 30 天、顶象设备指纹、紧凑推送）+ `longhu_dxrisk.js`（XXTEA 指纹签发模块）+ `龙湖取Token.exe`（手机号 + 验证码直接换 token，附 `TakeToken.cs` 源码可自行编译）<br>☁️ **新增雨云**：`rainyun_signin.js`（签到 +500 积分、腾讯点选验证码自动过、7 天会话复用）+ `rainyun_cap.py`（提示切分 + 候选检测 + 双通道打分）<br>📄 两份项目说明一并发布<br>🔒 隐私清理：取 Token 工具与抓包脚本不内置任何青龙地址/账号/密码，连接信息只从环境变量读；文档中的手机号、用户 ID、本机路径全部脱敏 |
| **2026-11-07** | 📮 **中国联通** `unicom_signin.js` v1.3：推送新增**紧凑排版**（`unicom_push_style` = simple/full），一账号一行、扩展任务压一行，full 保留旧版逐条明细<br>📖 补全接口与坑位说明：鉴权最小集（43 → 1 个 cookie）、密码登录四步、失效码字典、token 寿命实测 25.5h<br>🧩 新增 `unicom_cmf.py` 云盘活动包装器（乘风破浪2026），复用 ecs_token 走二级缓存登录<br>📄 新增 [README-中国联通签到.md](https://github.com/yang7758258/ohhh_QL-Script/blob/main/README-%E4%B8%AD%E5%9B%BD%E8%81%94%E9%80%9A%E7%AD%BE%E5%88%B0.md) 完整说明<br>🔒 隐私清理：移除作者本机绝对路径，UA 系统版本改由环境变量控制 |
| **2026-11-04** | 🎈 **OPPO 取 CK 工具 v1.2**：抓到凭据后**先校验再用**——逐个候选打会员信息接口，接口认了才收，失败会打印每个候选的原因（`code=5008` 过期 / `login=false` 登录没落稳 / `HTTP 403` 被拦）<br>🔧 **凭据优选** TOKENSID（约 30 天）＞ NEWOPPOSID（约 1 天）<br>🖥 面板显示校验结果：类型 / 账号名 / 积分 / 有效期<br>📄 新增 [README-OPPO取CK工具.md](https://github.com/yang7758258/ohhh_QL-Script/blob/main/README-OPPO%E5%8F%96CK%E5%B7%A5%E5%85%B7.md) 完整说明<br>📦 [v1.2 exe](https://github.com/yang7758258/ohhh_QL-Script/releases/tag/v1.2) 已发布 |
| **2026-11-03** | 🐞 **中国联通** 修复「设备登录过多」：设备码改为按账号确定性派生（`unicom_auto_login.py` 去掉写死常量、`unicom_signin.js` 不再每次随机、`chinaUnicom.py` 的 uuid / sdkuuid / 云盘设备号统一派生），同一账号永远同一台设备<br>🔒 UA 去掉真机型号（iPhone17,1 / iOS 26.6.1），改为中性机型，可用 `unicom_device_model` / `unicom_device_os` / `unicom_device_seed` 覆盖 |
| **2026-11-02** | 📄 **新增** OPPO 商城四件套：`oppo_store_daily.js`（签到 + 日常任务 + 活动任务 + 抽奖 v1.1）、`oppo_login.js`（账号密码登录 / 取 CK 核心）、`oppo_ck_panel.js` + `oppo_ck_panel.html`（短信登录取 CK 面板）<br>🔧 统一「项目名称 + 更新说明」头部标识，修正头部版本号与运行时横幅不一致 |
| **2026-11-01** | 🔧 **中国联通** `unicom_signin.js` v1.3：补齐 token 失效自动续期链路<br>🔧 **中国联通** `unicom_auto_login.py`：验证码服务地址改为环境变量，移除硬编码<br>📦 **仓库整理**：全脚本补充「项目名称 + 更新说明」头部标识<br>🧹 **隐私清理**：清除脚本内的手机号、内网 IP、个人信息<br>🗂️ **结构清理**：移除废弃目录，README 重写并修正全部链接<br>📄 **新增** `unicom_auto_login.py` / `cap_solver.py`<br>📄 **新增** `chinaUnicom.py`（全功能 v1.0.5）+ `unicom_tasks.py`（全任务包装器），扩展任务链路打通 |
| 2026-10-20 | 顺丰速运+ v3 抓包实证版 |
| 2026-02-06 | Keep 奖牌新增 |
| 2026-02-05 | 麦斯威尔福利社优化浇水逻辑 |
| 2024-06-18 | 仓库初始版本 |

---

## 四、常见问题

**Q：提示「未登录 / 0001」？**  
Token 过期。重新抓包更新环境变量；联通 `unicom_signin.js` 配了密码会自动续期。

**Q：签到成功但没到账？**  
看脚本日志里的返回码。`0002` 是今天已签到（幂等，不是错误），`0329` 是任务失败（软失败，可跳过）。

**Q：多个账号怎么写？**  
换行，或用 `#` / `&` 分隔（各脚本头注释里注明了该脚本支持的分隔符）。

**Q：脚本跑完没推送？**  
把 `sendNotify.js` 一起放到同目录，并配置推送环境变量。

---

### [群组直达 | 我与我周旋久，宁做我](https://t.me/Mist154)
### [频道直达 | 夜色四合，平安喜樂](https://t.me/Mist153)

### See You.

---

## 声明

- 这里的脚本只是自己学习的一个实践。
- 仅用于测试和学习研究，禁止用于商业用途，不能保证其合法性、准确性、完整性和有效性，请根据情况自行判断。
- 仓库内所有资源文件，禁止任何公众号、自媒体进行任何形式的转载、发布。
- `Mist` 对任何脚本问题概不负责，包括但不限于由任何脚本错误导致的任何损失或损害。
- 间接使用脚本的任何用户，包括但不限于建立 VPS 或在某些行为违反国家/地区法律或相关法规的情况下进行传播，`Mist` 对于由此引起的任何隐私泄漏或其他后果概不负责。
- 如果任何单位或个人认为该项目的脚本可能涉嫌侵犯其权利，则应及时通知并提供身份证明、所有权证明，我们将在收到认证文件后删除相关脚本。
- 任何以任何方式查看此项目的人或直接或间接使用该 Script 项目的任何脚本的使用者都应仔细阅读此声明。`Mist` 保留随时更改或补充此免责声明的权利。一旦使用并复制了任何相关脚本或 Script 项目的规则，则视为您已接受此免责声明。
- 您必须在下载后的 24 小时内从计算机或手机中完全删除以上内容。
