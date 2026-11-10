# 雨云（rainyun）每日签到 · 使用说明

> 站点：<https://app.rainyun.com> · 任务：积分任务「每日签到」（+500 积分 + 1 张抽奖券）
> 主脚本：`rainyun_signin.js`（Node） + `rainyun_cap.py`（腾讯 TCaptcha 点选识别）
> 状态：**已跑通**，2026-11-09 23:30 在青龙容器内实测签到成功（积分 500 → 1000）。

**从仓库下载这三个：**

```text
rainyun_signin.js      主脚本（必需）
rainyun_cap.py         验证码识别模块（必需，脚本会调用它）
sendNotify.js          推送模块（青龙自带同名文件时可跳过）
```

> 三者必须**平铺**在同一目录（`/ql/data/scripts/`），不要建子目录 —— 脚本用 `path.join(__dirname, ...)` 找它们。

---

## 一、它做了什么

~~~text
① HTTP 登录 api.v2.rainyun.com（手机号 + 密码，自动缓存 7 天会话）
② GET /user/reward/tasks 查「每日签到」状态（1=可领取 / 2=已领取）
③ 状态 1 → POST /user/reward/tasks 提交，服务端必然返回 10004「验证码校验失败」
④ 自动拉起 chrome-headless-shell 打开腾讯验证码（TCaptcha，aid=2039519451）
⑤ 抓验证码自己的题面图（672×480 背景 + 170×50 提示字条）→ Python 识别点击顺序
⑥ CDP 真实鼠标点击 3 个目标字 + 「确定」→ 拿到 ticket/randstr
⑦ 带票重新提交 → 签到成功，读回最新积分，推送通知
~~~

多账号、失败重试（每轮最多 3 次换题）、7 天会话复用、已签到自动跳过，均已实现。

---

## 二、环境变量（青龙面板「环境变量」新建）

| 变量名 | 必填 | 说明 |
| --- | --- | --- |
| `rainyun_account` | ✅ | 账号，格式 `手机号#密码`；多账号用 `&` 或换行分隔 |
| `rainyun_push` | ⬜ | 填任意值（如 `1`）即开启推送，走 `sendNotify.js`（读 `QYWX_AM` 等） |
| `rainyun_captcha` | ⬜ | `auto`（默认）/ `off`。`off` 只跑免票通道（服务端要求验证码时会失败） |
| `rainyun_debug` | ⬜ | `1` 打印识别细节；`force` 已领取也强制提交一次（排错用） |
| `YZ_CHROME` | ⬜ | 浏览器路径，青龙已内置（`/ql/scripts/chrome/chrome-headless-shell-linux64/chrome-headless-shell`） |
| `RY_PYTHON` | ⬜ | 指定 python3 路径，默认自动探测 |

> ⚠️ 青龙新建环境变量的 API/表单要求 `value` 为**数组**（多值），单值时填一行即可。

---

## 三、青龙部署（已配置好，附复现步骤）

1. 上传 3 个文件到 `/ql/data/scripts/`（**平铺**，不要建子目录）：

~~~text
rainyun_signin.js     主入口
rainyun_cap.py        验证码识别模块
sendNotify.js         推送模块（脚本用 path.join(__dirname,'sendNotify.js') 查找）
~~~

2. 环境变量：`rainyun_account=手机号#密码`、`rainyun_push=1`
3. 定时任务（脚本幂等，已签到会自动跳过，可放心双保险）：

   | 名称 | 命令 | 定时 | 说明 |
   | --- | --- | --- | --- |
   | `雨云签到` | `task rainyun_signin.js` | `10 0 * * *` | 每天 00:10 主跑 |
   | `雨云签到·补` | `task rainyun_signin.js` | `30 8 * * *` | 每天 08:30 补跑（验证码失败兜底） |
4. 首次运行会自动装 Python 依赖（ddddocr / pillow / numpy，走阿里云镜像），约 20–40 秒

> 命令必须用 `task` 前缀：青龙只有通过 `task xxx.js` 才会把 `/ql/data/dep_cache` 加进
> `NODE_PATH`，否则脚本 `require('puppeteer-core')` 会失败。

### 依赖

| 依赖 | 说明 |
| --- | --- |
| Node ≥ 18 | 青龙自带（实测 v20.20.2） |
| puppeteer-core | 青龙依赖缓存自带（实测 25.14.0），无需安装 |
| chrome-headless-shell | 青龙自带（`YZ_CHROME` 已指向） |
| python3 + ddddocr + pillow + numpy | 脚本自动 pip 安装 |

---

## 四、本地运行

~~~powershell
cd "(脚本目录)"
$env:rainyun_account="手机号#密码"
$env:rainyun_push="1"
node rainyun_signin.js
~~~

本地（Windows）需要有 Chrome：脚本按 `YZ_CHROME` → `C:\Program Files\Google\Chrome\Application\chrome.exe` → 常见 Linux 路径 顺序查找。

---

## 五、输出示例（青龙实测日志）

~~~text
[23:30:18] ℹ️  账号 1 个 · 推送 开 · 验证码 auto
[23:30:18] ━━━ 账号1 185****0000 ━━━
[23:30:18] ℹ️  用户 88888888 · ID 100000 · 积分 500
[23:30:18] ⚠️  服务端要求验证码（验证码校验失败），转浏览器取票
[23:30:20] ℹ️  浏览器就绪：chrome-headless-shell
[23:30:21] ℹ️  验证码尝试 1/3
[23:30:23] ℹ️  提示字 [["l","1"],["守","占","A","a","觉"],["2"]]
           · 背景字 [["I","1"],["e","占",")","觉"],["2","名"]] · 置信 1
[23:30:27] ✅ 取得票据 ticket=tr03rIuhxghplG...
[23:30:27] ✅ 签到成功 +500 分 · 当前 1000
[23:30:27] 📊 成功 1 · 已签 0 · 失败 0
[23:30:27] 📮 推送完成
~~~

第二次运行（幂等）：

~~~text
[23:31:45] ℹ️  用户 88888888 · ID 100000 · 积分 1000
[23:31:45] ✅ 今日已签到（Status=2），直接跳过
[23:31:45] 📊 成功 0 · 已签 1 · 失败 0
~~~

---

## 六、常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| `未找到 puppeteer-core` | 没用 `task` 前缀运行 |
| `未找到 chrome / chrome-headless-shell` | 设 `YZ_CHROME` 指向浏览器可执行文件 |
| `识别失败：候选不足` / `验证码三轮未通过` | 题目太难或验证码被风控降级；脚本会自动换题重试，次日再来即可 |
| 登录返回 `10004` | 登录也被要求验证码（IP 风控）。脚本已内置「带票登录」分支，会先取票再登录 |
| 日志目录名奇怪（如 `rainyun_signin`、`node`） | 青龙按命令**首词**建日志目录，属正常现象 |
| 会话缓存位置 | 青龙容器 `~/.ry_signin/session.json`（不含密码，仅 `rain-session` / `X-CSRF-Token`） |

---

## 七、文件清单

**仓库里（平铺在根目录）：**

~~~text
rainyun_signin.js     主入口（登录 / 任务 / 浏览器取票 / 提交 / 推送）
rainyun_cap.py        腾讯 TCaptcha 点选识别（提示切分 + 候选检测 + 双通道打分）
sendNotify.js         推送模块副本
README-雨云签到.md     本文档
~~~

**本地开发工具（未随仓库发布）：**

~~~text
_test_cap.py          单独测识别器（拉一张新题 → 打印识别结果）
_ry_widget_probe.js   验证码 iframe DOM 探针（结构变了用它重查）
_ry_clickprobe.js     点击落点探针（验证 CDP 点击是否生效）
REPORT-雨云逆向.md     逆向细节与识别算法原理
~~~

逆向细节、验证码难点与识别算法原理见本地 `REPORT-雨云逆向.md`（未随仓库发布）。
