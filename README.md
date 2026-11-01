### Script Overview · 喜欢请点个 🌟

> 青龙面板自动化脚本合集 · 维护：[Mist](https://github.com/yang7758258)

| # | 项目名称 | 脚本文件 | 环境变量 | 建议定时 | 状态 |
|:-:|:--------|:--------|:--------|:--------|:---:|
| 1 | 中国联通（全功能） | [chinaUnicom.py](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/chinaUnicom.py) | `chinaUnicomCookie` | `0 7,20 * * *` | ✅ |
| 2 | 中国联通（全任务包装器） | [unicom_tasks.py](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/unicom_tasks.py) | — | 被 unicom_signin.js 调用 | ✅ |
| 3 | 中国联通（签到） | [unicom_signin.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/unicom_signin.js) | `unicom` | `45 8 * * *` | ✅ |
| 4 | 中国联通（自动登录） | [unicom_auto_login.py](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/unicom_auto_login.py) | `UNICOM_MOBILE` / `UNICOM_PASSWORD` | 按需 | ✅ |
| 5 | 中国联通（验证码核心） | [cap_solver.py](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/cap_solver.py) | — | 被调用 | ✅ |
| 6 | 中国南方航空 | [csair_signin.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/csair_signin.js) | `CSAIR_CK` / `CSAIR_ACCOUNT` | `22 8 * * *` | ✅ |
| 7 | 顺丰速运+ | [sf_qinglong.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/sf_qinglong.js) | `SfsyUrl` | `0 9 * * *` | ✅ |
| 8 | 麦斯威尔福利社 | [mswefls.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/mswefls.js) | `mswefls` | `10 12 * * *` | ✅ |
| 9 | Keep 奖牌 | [keep.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/keep.js) | `Keep` | `10 12 * * *` | ✅ |
| 10 | 顾家家居 | [gjjj.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/gjjj.js) | `gjjj` | `0 7,17 * * *` | ✅ |
| 11 | 好奇车生活 | [hqcsh.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/hqcsh.js) | `hqcsh` | `0 6,18 * * *` | ✅ |
| 12 | 海天美味馆 | [htmwg.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/htmwg.js) | `htmwg` | `0 9,18 * * *` | ✅ |
| 13 | 健达福利社 | [jdfls.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/jdfls.js) | `jdfls` | `10 11,12 * * *` | ✅ |
| 14 | 富士 instax | [fsinstax.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/fsinstax.js) | `fsinstax` | `10 8 * * *` | ✅ |
| 15 | 仰韶会员俱乐部 | [yshyjlb.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/yshyjlb.js) | `yshyjlb` | `10 10,16 * * *` | ✅ |
| 16 | 毛铺草本荟 | [mpcbh.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/mpcbh.js) | `mpcbh` | `30 8,18 * * *` | ✅ |
| 17 | 雀巢会员俱乐部 | [qchyjlb.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/qchyjlb.js) | `qchyjlb` | `0 9 * * *` | ✅ |
| 18 | 日清体验馆 | [rqtyg.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/rqtyg.js) | `rqtyg` | `30 6 * * *` | ✅ |
| 19 | 冷酸灵牙膏 | [lslyg.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/lslyg.js) | `lslyg` | `0 9 * * *` | ✅ |
| 20 | 爷爷不泡茶 | [yybpc.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/yybpc.js) | `yybpc` | `10 8 * * *` | ✅ |
| 21 | Zippo 芝宝 | [zippo.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/zippo.js) | `zippo` | `0 0,7 * * *` | ✅ |
| 22 | 推送模块 | [sendNotify.js](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/sendNotify.js) | 见文件内注释 | 被调用 | 公共件 |
| 23 | 远程通知 | [Notice.json](https://raw.githubusercontent.com/yang7758258/ohhh_QL-Script/refs/heads/main/Notice.json) | — | 被调用 | 公共件 |

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
export unicom_probe="on"                       # 只探针，不签到
```

### 中国南方航空 `csair_signin.js`

```bash
export CSAIR_CK="cs1246643sso 的值"            # 通道A，多账号换行
export CSAIR_ACCOUNT="手机号#密码#openId#unionId"  # 通道B

export CSAIR_MODE="all"                        # all / sign / probe
export CSAIR_DELAY="6-15"                      # 多账号间隔秒
export CSAIR_NOTIFY="0"                        # 关闭推送
```

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
