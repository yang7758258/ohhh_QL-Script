/* ---------------------------------------------------------------------------
 *  项目名称：顾家家居
 *  脚本文件：gjjj.js
 *  更新说明：
 *    2026-11-01  Mist  仓库整理：统一项目标识、清理隐私信息
 * ---------------------------------------------------------------------------
 */
/**
 * 顾家家居 签到、任务
 * Gjjj
 * Author: Mist
 * 群组：https://t.me/Mist154
 * 频道：https://t.me/Mist153
 * Date: 2024-07-14
 * cron "0 7,17 * * *" gjjj.js
 * export gjjj= identityValue&openid&unionid 多账号换行或者#分隔
 */
// ============================================================================================================
const $ = new Env('顾家家居') 
const axios = require('axios')
const md5 = require('md5')
const env_name = 'gjjj' //环境变量名字
const env = process.env[env_name] || '' 
const Notify = 1
const debug = 0
let scriptVersionNow = "1.0.0";
let msg = "";
// ==================================异步顺序==============================================================================
!(async () => {
    await getNotice();
    await getVersion("yang7758258/ohhh154@main/gjjj.js");
    await main();
    //await SendMsg(msg);

})()
    .catch((e) => $.logErr(e))
    .finally(() => $.done());
//==================================脚本入口函数main()==============================================================

async function main() {
    if (env == '') {
        //没有设置变量,直接退出
        console.log(`没有填写变量,请查看脚本说明: ${env_name}🚳`)
        return
    }
    let user_ck = env.split('\n')
    DoubleLog(`\n========= 共找到 ${user_ck.length} 个账号 =========`);
    let index = 1 //用来给账号标记序号, 从1开始
    for (let ck of user_ck) {
        if (!ck) continue //跳过空行
        let ck_info = ck.split('&')
        let identityValue = ck_info[0] 
        let openId = ck_info[1]
        let unionId = ck_info[2]
        let user = {
            index: index,
            identityValue, 
            openId,
            unionId,
        }
        index = index + 1 //每次用完序号+1
        //开始账号任务
        let Run = new run(user);
        await Run.userTask(user)
        //每个账号之间等1~5秒随机时间
        let rnd_time = Math.floor(Math.random() * 4000) + 1000
        console.log(`随机等待${rnd_time / 1000}秒...`)
        await $.wait(rnd_time)
    }
}
// ======================================开始任务=========================================
class run {
    constructor(user) {
        this.memberId = "";
        this.token = "";
    }
async  userTask(user) {
    console.log(`\n========= 账号[${user.index}]开始任务 =========`)
    await this.Login(user)
    await wait(1)
    await this.sign(user)
    await this.articleList(user)
    await wait(1)
    await this.Like_Share(user,'/club-server/front/postOrder/like',`{"id":${this.articleId}}`)//点赞
    await this.Like_Share(user,'/club-server/front/member/likeSendPoint',`{"postOrderId":${this.articleId},"triggerType":1,"content":"点赞"}`)//领取奖励
    await this.Like_Share(user,'/club-server/front/postOrder/like',`{"id":${this.articleId}}`)//取消点赞
    await this.Like_Share(user,'/club-server/front/postOrder/collect',`{"id":${this.articleId}}`)//收藏
    await this.Like_Share(user,'/club-server/front/member/likeSendPoint',`{"postOrderId":${this.articleId},"triggerType":2,"content":"收藏"}`)//领取奖励
    await this.Like_Share(user,'/club-server/front/postOrder/collect',`{"id":${this.articleId}}`)//取消收藏
    await this.Like_Share(user,'/club-server/front/postOrder/share',`{"id":${this.articleId}}`)//
    await this.Like_Share(user,'/club-server/front/member/likeSendPoint',`{"postOrderId":${this.articleId},"triggerType":3,"content":"微信好友转发","forwardType":2}`)//
    await this.account(user)
}
// =============================================================================================================================
//登入
async  Login(user) {
    try {
        DoubleLog(`🕊账号[${user.index}] 去登入...`);
        await this.getsign({
            "identityType":"mobile",
            "identityValue":user.identityValue,
            "type2":"wechat-unionid",
            "value2":"",
            "source":"顾家小程序",
            "contentName":"",
            "openid":user.openId,
            "unionid":user.unionId})
        let urlObject = {
            method: 'post',
            url: `https://mc.kukahome.com/club-server/member/automaticLogin`,
            headers: {
                'Connection': 'keep-alive',
                'parameterSign': this.parameterSign,
                'content-type': 'application/json',
                'timestamp': this.tmie,
                'xweb_xhr': '1',
                'brandCode': 'K001',
                'appid': '667516',
                'sign': this.Sign,
                'X-Customer': this.memberId,
                'AccessToken': this.token,
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 MicroMessenger/6.8.0(0x16080000) NetType/WIFI MiniProgramEnv/Mac MacWechat/WMPF MacWechat/3.8.7(0x13080712) XWEB/1191',
                'accept': '*/*',
                'Sec-Fetch-Site': 'cross-site',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'Referer': `https://servicewechat.com/wx0770280d160f09fe/196/page-frame.html`,
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'zh-CN,zh;q=0.9',
            },
            data: {"identityType":"mobile",
                "identityValue":user.identityValue,
                "type2":"wechat-unionid",
                "value2":"",
                "source":"顾家小程序",
                "contentName":"",
                "openid":user.openId,
                "unionid":user.unionId}
        }
        //console.log(urlObject);
        let { data: result} = await axios.request(urlObject)
        //console.log(result);
        if (result?.msg == '成功') {
            DoubleLog(`🕊账号[${user.index}] 登入成功🎉`);
            this.token = result.data.AccessToken
            this.memberId = result.data.membership.id
        }else{
            DoubleLog(`🕊账号[${user.index}] 登入失败:${result.msg}⛔`)
        }
    } catch (e) {
        console.log(e);
    }
}
//签到
async  sign(user) {
    try {
        DoubleLog(`🕊账号[${user.index}] 开始签到任务...`);
        await this.getsign({"scene":"sign","memberId":this.memberId,"brandCode":"K001"})
        let urlObject = {
            method: 'post',
            url: `https://mc.kukahome.com/integral-server/scenePoint/scene/point`,
            headers: {
                'Connection': 'keep-alive',
                'parameterSign': this.parameterSign,
                'content-type': 'application/json',
                'timestamp': this.tmie,
                'xweb_xhr': '1',
                'brandCode': 'K001',
                'appid': '667516',
                'sign': this.Sign,
                'X-Customer': this.memberId,
                'AccessToken': this.token,
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 MicroMessenger/6.8.0(0x16080000) NetType/WIFI MiniProgramEnv/Mac MacWechat/WMPF MacWechat/3.8.7(0x13080712) XWEB/1191',
                'accept': '*/*',
                'Sec-Fetch-Site': 'cross-site',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'Referer': `https://servicewechat.com/wx0770280d160f09fe/196/page-frame.html`,
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'zh-CN,zh;q=0.9',
            },
            data: {
                "scene":"sign",
                "memberId":this.memberId,
                "brandCode":"K001"
            }
        }
            //console.log(urlObject);
        let { data: result} = await axios.request(urlObject)
            //console.log(result);
        if (result?.code == 0) {
                //打印签到结果
                DoubleLog(`🕊账号[${user.index}] 签到成功：获得[${result.data}]积分🎉`);
                this.mist = result.data.spanSumDays
        }else{
                DoubleLog(`🕊账号[${user.index}] 签到失败:${result.message}⛔`)
        }
    } catch (e) {
        console.log(e);
    }
}
//获取文章列表
async  articleList(user) {
    try {
        DoubleLog(`🕊账号[${user.index}] 获取文章列表...`);
        await this.getsign({"pageNum":1,"pageSize":6,"source":1})
        let urlObject = {
            method: 'post',
            url: `https://mc.kukahome.com/club-server/applet/waterfall/newWaterfall`,
            headers: {
                'Connection': 'keep-alive',
                'parameterSign': this.parameterSign,
                'content-type': 'application/json',
                'timestamp': this.tmie,
                'xweb_xhr': '1',
                'brandCode': 'K001',
                'appid': '667516',
                'sign': this.Sign,
                'X-Customer': this.memberId,
                'AccessToken': this.token,
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 MicroMessenger/6.8.0(0x16080000) NetType/WIFI MiniProgramEnv/Mac MacWechat/WMPF MacWechat/3.8.7(0x13080712) XWEB/1191',
                'accept': '*/*',
                'Sec-Fetch-Site': 'cross-site',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'Referer': `https://servicewechat.com/wx0770280d160f09fe/196/page-frame.html`,
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'zh-CN,zh;q=0.9',
            },
            data: {"pageNum":1,"pageSize":6,"source":1}
        }
        //console.log(urlObject);
        let { data: result} = await axios.request(urlObject)
        //console.log(result);
        if (result?.code == 0) {
                //打印签到结果
                DoubleLog(`🕊账号[${user.index}] 文章获取成功🎉`);
                this.index = Math.floor(Math.random() * result.data.length);
                this.articleId = result.data[this.index].id
        }else{
                DoubleLog(`🕊账号[${user.index}] 文章获取失败:${result.message}⛔`)
        }
    } catch (e) {
        console.log(e);
    }
}
//点赞、分享
async  Like_Share(user,urR,body) {
    try {
        DoubleLog(`🕊账号[${user.index}] 去完成相关任务...`);
        await this.getsign(body)
        let urlObject = {
            method: 'post',
            url: `https://mc.kukahome.com${urR}`,
            headers: {
                'Connection': 'keep-alive',
                'parameterSign': this.parameterSign,
                'content-type': 'application/json',
                'timestamp': this.tmie,
                'xweb_xhr': '1',
                'brandCode': 'K001',
                'appid': '667516',
                'sign': this.Sign,
                'X-Customer': this.memberId,
                'AccessToken': this.token,
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 MicroMessenger/6.8.0(0x16080000) NetType/WIFI MiniProgramEnv/Mac MacWechat/WMPF MacWechat/3.8.7(0x13080712) XWEB/1191',
                'accept': '*/*',
                'Sec-Fetch-Site': 'cross-site',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'Referer': `https://servicewechat.com/wx0770280d160f09fe/196/page-frame.html`,
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'zh-CN,zh;q=0.9',
            },
            data: body,
        }
        //console.log(urlObject);
        let { data: result} = await axios.request(urlObject)
        //console.log(result);
        if (result?.code == 0) {
                //打印签到结果
                DoubleLog(`🕊账号[${user.index}] 相关任务${result.message}🎉`);
        }else{
                DoubleLog(`🕊账号[${user.index}] 任务失败:${result.message}⛔`)
        }
    } catch (e) {
        console.log(e);
    }
}

//查询
async  account(user) {
    try {
        DoubleLog(`🕊账号[${user.index}] 开始查询...`);
        await this.getsign()
        let urlObject = {
            method: 'get',
            url: `https://mc.kukahome.com/club-server/front/member/userCenterScore`,
            headers: {
                'Connection': 'keep-alive',
                'parameterSign': this.parameterSign,
                'content-type': 'application/json',
                'timestamp': this.tmie,
                'xweb_xhr': '1',
                'brandCode': 'K001',
                'appid': '667516',
                'sign': this.Sign,
                'X-Customer': this.memberId,
                'AccessToken': this.token,
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 MicroMessenger/6.8.0(0x16080000) NetType/WIFI MiniProgramEnv/Mac MacWechat/WMPF MacWechat/3.8.7(0x13080712) XWEB/1191',
                'accept': '*/*',
                'Sec-Fetch-Site': 'cross-site',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'Referer': `https://servicewechat.com/wx0770280d160f09fe/196/page-frame.html`,
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'zh-CN,zh;q=0.9',
            },
        }
        //console.log(urlObject);
        let { data: result} = await axios.request(urlObject)
        //console.log(result);
        if (result?.code == 0) {
            //打印签到结果
            DoubleLog(`🕊账号[${user.index}] 查询成功:总积分[${result.data.point}]🎉`);
            
        }else {
            DoubleLog(`🕊账号[${user.index}] 查询失败:${result.message}⛔`)
        }
        } catch (e) {
        console.log(e);
        }
    }
//获取sign
async  getsign(body) {
    let time = new Date().getTime();
    let sign = md5(`667516FH3yRrHG2RfexND8${time}`);
    //console.log(sign);
    let r = String(time).substring(4, 10);
    if (body) {
        let parameterSign = md5(md5(objToStr(body)) + r);
        this.tmie = time;
        this.Sign = sign;
        this.parameterSign = parameterSign;
        //console.log(parameterSign);
    } else {
        this.tmie = time;
        this.Sign = sign;
        this.parameterSign = '';
    }
}

}
async function objToStr(obj) {
    return JSON.stringify(obj);
}
/**
 * =========================================================发送消息=============================================
 */
async function SendMsg(message) {
    if (!message) return;
    if (Notify > 0) {
        if ($.isNode()) {
            var notify = require("./sendNotify");
            await notify.sendNotify($.name, message);
        } else {
            // $.msg(message);
            $.msg($.name, '', message)
        }
    } else {
        console.log(message);
    }
}
/**
 * =====================================================双平台log输出==========================================
 */
function DoubleLog(data) {
    if ($.isNode()) {
        if (data) {
            console.log(`${data}`);
            msg += `\n${data}`;
        }
    } else {
        console.log(`${data}`);
        msg += `\n${data}`;
    }

}
/**
* ======================================================等待 X 秒============================================
*/
function wait(n) {
    return new Promise(function (resolve) {
        setTimeout(resolve, n * 1000);
    });
}
/**
* ======================================================随机等待 1-5 秒============================================
*/
function sjwait() {
    return new Promise(function (resolve) {
        let waitTime = Math.floor(Math.random() * 4000 + 1000);
        setTimeout(resolve, waitTime);
    });
}
// ==========================================================13位时间戳=====================================================
function getTimestamp() {
    return new Date().getTime();
}
//===============================================网络请求httpRequest=========================================
function httpRequest(options, timeout = 1 * 1000) {
    method = options.method ? options.method.toLowerCase() : options.body ? "post" : "get";
    return new Promise(resolve => {
        setTimeout(() => {
            $[method](options, (err, resp, data) => {
                try {
                    if (err) {
                        console.log(JSON.stringify(err));
                        $.logErr(err);
                    } else {
                        try { data = JSON.parse(data); } catch (error) { }
                    }
                } catch (e) {
                    console.log(e);
                    $.logErr(e, resp);
                } finally {
                    resolve(data);
                }
            })
        }, timeout)
    })
}
//==============================================Debug模式===============================================
function debugLog(...args) {
    if (debug) {
        console.log(...args);
    }
}
//===============================================获取远程通知========================================
async function getNotice() {
    try {
        const urls = [
            "https://gitee.com/ohhhooh/jd_haoyangmao/raw/master/Notice.json",
            
        ];
        let notice = null;
        for (const url of urls) {
            const options = { url, headers: { "User-Agent": "" }, };
            const result = await httpRequest(options);
            if (result && "notice" in result) {
                notice = result.notice.replace(/\\n/g, "\n");
                break;
            }
        }
        if (notice) { $.DoubleLog(notice); }
    } catch (e) {
        console.log(e);
    }
}
//==============================================获取远程版本=================================================
function getVersion(scriptUrl, timeout = 3 * 1000) {
    return new Promise((resolve) => {
        const options = { url: `https://fastly.jsdelivr.net/gh/${scriptUrl}` };
        $.get(options, (err, resp, data) => {
            try {
                const regex = /scriptVersionNow\s*=\s*(["'`])([\d.]+)\1/;
                const match = data.match(regex);
                const scriptVersionLatest = match ? match[2] : "";
                DoubleLog(`\n当前版本:[${scriptVersionNow}]>>>>>云端☁️版本:[${scriptVersionLatest}]`);
            } catch (e) {
                $.logErr(e, resp);
            }
            resolve();
        }, timeout);
    });
}

//===============================================================================================================================================
//================================================固定API===============================================================================================
function Env(t, e) { class s { constructor(t) { this.env = t } send(t, e = "GET") { t = "string" == typeof t ? { url: t } : t; let s = this.get; return ("POST" === e && (s = this.post), new Promise((e, a) => { s.call(this, t, (t, s, r) => { t ? a(t) : e(s) }) })) } get(t) { return this.send.call(this.env, t) } post(t) { return this.send.call(this.env, t, "POST") } } return new (class { constructor(t, e) { this.userList = []; this.userIdx = 0; (this.name = t), (this.http = new s(this)), (this.data = null), (this.dataFile = "box.dat"), (this.logs = []), (this.isMute = !1), (this.isNeedRewrite = !1), (this.logSeparator = "\n"), (this.encoding = "utf-8"), (this.startTime = new Date().getTime()), Object.assign(this, e), this.log("", `🔔${this.name},开始!`) } getEnv() { return "undefined" != typeof $environment && $environment["surge-version"] ? "Surge" : "undefined" != typeof $environment && $environment["stash-version"] ? "Stash" : "undefined" != typeof module && module.exports ? "Node.js" : "undefined" != typeof $task ? "Quantumult X" : "undefined" != typeof $loon ? "Loon" : "undefined" != typeof $rocket ? "Shadowrocket" : void 0 } isNode() { return "Node.js" === this.getEnv() } isQuanX() { return "Quantumult X" === this.getEnv() } isSurge() { return "Surge" === this.getEnv() } isLoon() { return "Loon" === this.getEnv() } isShadowrocket() { return "Shadowrocket" === this.getEnv() } isStash() { return "Stash" === this.getEnv() } toObj(t, e = null) { try { return JSON.parse(t) } catch { return e } } toStr(t, e = null) { try { return JSON.stringify(t) } catch { return e } } getjson(t, e) { let s = e; const a = this.getdata(t); if (a) try { s = JSON.parse(this.getdata(t)) } catch { } return s } setjson(t, e) { try { return this.setdata(JSON.stringify(t), e) } catch { return !1 } } getScript(t) { return new Promise((e) => { this.get({ url: t }, (t, s, a) => e(a)) }) } runScript(t, e) { return new Promise((s) => { let a = this.getdata("@chavy_boxjs_userCfgs.httpapi"); a = a ? a.replace(/\n/g, "").trim() : a; let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout"); (r = r ? 1 * r : 20), (r = e && e.timeout ? e.timeout : r); const [i, o] = a.split("@"), n = { url: `http://${o}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: r }, headers: { "X-Key": i, Accept: "*/*" }, timeout: r, }; this.post(n, (t, e, a) => s(a)) }).catch((t) => this.logErr(t)) } loaddata() { if (!this.isNode()) return {}; { (this.fs = this.fs ? this.fs : require("fs")), (this.path = this.path ? this.path : require("path")); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), a = !s && this.fs.existsSync(e); if (!s && !a) return {}; { const a = s ? t : e; try { return JSON.parse(this.fs.readFileSync(a)) } catch (t) { return {} } } } } writedata() { if (this.isNode()) { (this.fs = this.fs ? this.fs : require("fs")), (this.path = this.path ? this.path : require("path")); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), a = !s && this.fs.existsSync(e), r = JSON.stringify(this.data); s ? this.fs.writeFileSync(t, r) : a ? this.fs.writeFileSync(e, r) : this.fs.writeFileSync(t, r) } } lodash_get(t, e, s) { const a = e.replace(/\[(\d+)\]/g, ".$1").split("."); let r = t; for (const t of a) if (((r = Object(r)[t]), void 0 === r)) return s; return r } lodash_set(t, e, s) { return Object(t) !== t ? t : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), (e.slice(0, -1).reduce((t, s, a) => Object(t[s]) === t[s] ? t[s] : (t[s] = Math.abs(e[a + 1]) >> 0 == +e[a + 1] ? [] : {}), t)[e[e.length - 1]] = s), t) } getdata(t) { let e = this.getval(t); if (/^@/.test(t)) { const [, s, a] = /^@(.*?)\.(.*?)$/.exec(t), r = s ? this.getval(s) : ""; if (r) try { const t = JSON.parse(r); e = t ? this.lodash_get(t, a, "") : e } catch (t) { e = "" } } return e } setdata(t, e) { let s = !1; if (/^@/.test(e)) { const [, a, r] = /^@(.*?)\.(.*?)$/.exec(e), i = this.getval(a), o = a ? ("null" === i ? null : i || "{}") : "{}"; try { const e = JSON.parse(o); this.lodash_set(e, r, t), (s = this.setval(JSON.stringify(e), a)) } catch (e) { const i = {}; this.lodash_set(i, r, t), (s = this.setval(JSON.stringify(i), a)) } } else s = this.setval(t, e); return s } getval(t) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.read(t); case "Quantumult X": return $prefs.valueForKey(t); case "Node.js": return (this.data = this.loaddata()), this.data[t]; default: return (this.data && this.data[t]) || null } } setval(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.write(t, e); case "Quantumult X": return $prefs.setValueForKey(t, e); case "Node.js": return ((this.data = this.loaddata()), (this.data[e] = t), this.writedata(), !0); default: return (this.data && this.data[e]) || null } } initGotEnv(t) { (this.got = this.got ? this.got : require("got")), (this.cktough = this.cktough ? this.cktough : require("tough-cookie")), (this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar()), t && ((t.headers = t.headers ? t.headers : {}), void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar)) } get(t, e = () => { }) { switch ((t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"], delete t.headers["content-type"], delete t.headers["content-length"]), this.getEnv())) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && ((t.headers = t.headers || {}), Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.get(t, (t, s, a) => { !t && s && ((s.body = a), (s.statusCode = s.status ? s.status : s.statusCode), (s.status = s.statusCode)), e(t, s, a) }); break; case "Quantumult X": this.isNeedRewrite && ((t.opts = t.opts || {}), Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then((t) => { const { statusCode: s, statusCode: a, headers: r, body: i, bodyBytes: o, } = t; e(null, { status: s, statusCode: a, headers: r, body: i, bodyBytes: o, }, i, o) }, (t) => e((t && t.error) || "UndefinedError")); break; case "Node.js": let s = require("iconv-lite"); this.initGotEnv(t), this.got(t).on("redirect", (t, e) => { try { if (t.headers["set-cookie"]) { const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), (e.cookieJar = this.ckjar) } } catch (t) { this.logErr(t) } }).then((t) => { const { statusCode: a, statusCode: r, headers: i, rawBody: o, } = t, n = s.decode(o, this.encoding); e(null, { status: a, statusCode: r, headers: i, rawBody: o, body: n, }, n) }, (t) => { const { message: a, response: r } = t; e(a, r, r && s.decode(r.rawBody, this.encoding)) }) } } post(t, e = () => { }) { const s = t.method ? t.method.toLocaleLowerCase() : "post"; switch ((t.body && t.headers && !t.headers["Content-Type"] && !t.headers["content-type"] && (t.headers["content-type"] = "application/x-www-form-urlencoded"), t.headers && (delete t.headers["Content-Length"], delete t.headers["content-length"]), this.getEnv())) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && ((t.headers = t.headers || {}), Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient[s](t, (t, s, a) => { !t && s && ((s.body = a), (s.statusCode = s.status ? s.status : s.statusCode), (s.status = s.statusCode)), e(t, s, a) }); break; case "Quantumult X": (t.method = s), this.isNeedRewrite && ((t.opts = t.opts || {}), Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then((t) => { const { statusCode: s, statusCode: a, headers: r, body: i, bodyBytes: o, } = t; e(null, { status: s, statusCode: a, headers: r, body: i, bodyBytes: o, }, i, o) }, (t) => e((t && t.error) || "UndefinedError")); break; case "Node.js": let a = require("iconv-lite"); this.initGotEnv(t); const { url: r, ...i } = t; this.got[s](r, i).then((t) => { const { statusCode: s, statusCode: r, headers: i, rawBody: o, } = t, n = a.decode(o, this.encoding); e(null, { status: s, statusCode: r, headers: i, rawBody: o, body: n }, n) }, (t) => { const { message: s, response: r } = t; e(s, r, r && a.decode(r.rawBody, this.encoding)) }) } } time(t, e = null) { const s = e ? new Date(e) : new Date(); let a = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds(), }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let e in a) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? a[e] : ("00" + a[e]).substr(("" + a[e]).length))); return t } queryStr(t) { let e = ""; for (const s in t) { let a = t[s]; null != a && "" !== a && ("object" == typeof a && (a = JSON.stringify(a)), (e += `${s}=${a}&`)) } return (e = e.substring(0, e.length - 1)), e } msg(e = t, s = "", a = "", r) { const i = (t) => { switch (typeof t) { case void 0: return t; case "string": switch (this.getEnv()) { case "Surge": case "Stash": default: return { url: t }; case "Loon": case "Shadowrocket": return t; case "Quantumult X": return { "open-url": t }; case "Node.js": return }case "object": switch (this.getEnv()) { case "Surge": case "Stash": case "Shadowrocket": default: { let e = t.url || t.openUrl || t["open-url"]; return { url: e } } case "Loon": { let e = t.openUrl || t.url || t["open-url"], s = t.mediaUrl || t["media-url"]; return { openUrl: e, mediaUrl: s } } case "Quantumult X": { let e = t["open-url"] || t.url || t.openUrl, s = t["media-url"] || t.mediaUrl, a = t["update-pasteboard"] || t.updatePasteboard; return { "open-url": e, "media-url": s, "update-pasteboard": a, } } case "Node.js": return }default: return } }; if (!this.isMute) switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: $notification.post(e, s, a, i(r)); break; case "Quantumult X": $notify(e, s, a, i(r)); break; case "Node.js": }if (!this.isMuteLog) { let t = ["", "==============📣系统通知📣==============",]; t.push(e), s && t.push(s), a && t.push(a), console.log(t.join("\n")), (this.logs = this.logs.concat(t)) } } log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator)) } logErr(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: this.log("", `❗️${this.name},错误!`, t); break; case "Node.js": this.log("", `❗️${this.name},错误!`, t.stack) } } wait(t) { return new Promise((e) => setTimeout(e, t)) } DoubleLog(d) { if (this.isNode()) { if (d) { console.log(`${d}`); msg += `\n ${d}` } } else { console.log(`${d}`); msg += `\n ${d}` } } async SendMsg(m) { if (!m) return; if (Notify > 0) { if (this.isNode()) { var notify = require("../sendNotify"); await notify.sendNotify(this.name, m) } else { this.msg(this.name, "", m) } } else { console.log(m) } } done(t = {}) { const e = new Date().getTime(), s = (e - this.startTime) / 1e3; switch ((this.log("", `🔔${this.name},结束!🕛${s}秒`), this.log(), this.getEnv())) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: $done(t); break; case "Node.js": process.exit(1) } } })(t, e) }
//Env rewrite:smallfawn Update-time:23-6-30 newAdd:DoubleLog & SendMsg