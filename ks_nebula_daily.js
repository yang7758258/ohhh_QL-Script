/* -------------------------------------------------------------------------
 *  项目名称：快手极速版（NEBULA · 签到 / 宝箱 / 任务卡）
 *  脚本文件：ks_nebula_daily.js
 *  更新说明：
 *    2026-11-22  Mist  仓库首发：签到 + 开宝箱 + 任务卡领奖 + 51 任务上报，纯 HTTP 零依赖
 * -------------------------------------------------------------------------
 *  Author : Mist
 *  声明   : 仅供个人学习与技术研究，仅用于自己有权操作的账号，风险自负
 * -------------------------------------------------------------------------
 */

'use strict';

const https = require('https');
const http = require('http');
const zlib = require('zlib');
const { URL } = require('url');

// ============================================================================
// 一、配置
// ============================================================================

const ENV_CK = 'ks_ck';                 // 必需：Cookie 整串，多账号换行
const ENV_CK_ALT = 'KS_CK';             // 同名大写容错
const ENV_ACCOUNT = 'ks_account';       // 选填：手机号#密码（仅记录，密码登录已被风控封死）
const ENV_DELAY = 'ks_delay';           // 账号间隔，形如 5-15
const ENV_PUSH = 'ks_push';             // on/off
const ENV_TY_PUSH = 'TYpush';           // 与有赞脚本共用的总开关
const ENV_BOX_WAIT = 'ks_box_wait';     // on/off：是否等冷却连开宝箱
const ENV_BOX_MAX = 'ks_box_max';       // 单次最多开几个宝箱
const ENV_DEBUG = 'ks_debug';           // on/off：打印原始响应
const ENV_MODE = 'ks_mode';             // full/light：light 跳过 60 个任务的点击上报
const ENV_SIG_GW = 'ks_sig_gw';         // 选填：sig3 签名网关地址（真机 Frida 桥），例如 http://127.0.0.1:8899
const ENV_SIG_GW_TIMEOUT = 'ks_sig_gw_timeout'; // 选填：网关超时秒，默认 10

/** 网关主机（H5 容器） */
const HOST_NEBULA = 'https://nebula.kuaishou.com';
const HOST_ENCOURAGE = 'https://encourage.kuaishou.com';

/** 任务中心来源标识，抓包里就是这几个 */
const SOURCE = 'cash';

// ---- __NS_sig3 签名参数（还原自 nebula 主包 chunks/main-*.js）------------
/** 签名协议版本，真实前端固定为 1 */
const SIG_CAT_VER = 1;
/** 参与签名的 Cookie 字段白名单（其余一律不进签名串） */
const SIG_COOKIE_KEYS = [
    'kpn', 'kpf', 'userId', 'did', 'c', 'appver', 'language', 'mod',
    'did_tag', 'egid', 'oDid', 'androidApiLevel', 'newOc',
    'browseType', 'socName', 'ftt', 'abi', 'userRecoBit',
    'device_abi', 'grant_browse_type', 'iuid', 'rdid',
];

/** 默认 UA：照抄抓包里 ksNebula 的 WebView UA，别改 */
const UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Mobile/15E148 ksNebula/14.9.21.4453 ISLP/0 KDT/PHONE ' +
    'NetType/WIFI locale/zh-Hans WebViewType/WK';

/** 返回码 */
const R = {
    OK: 1,
    NET: 2,
    NO_PARAM: 11,
    SIG_FAIL: 50,
    SIGNED_TODAY: 102006,
    NO_MORE_REWARD: 90107,
};

/** 宝箱冷却上限（服务端一般给 300s，留点余量） */
const BOX_COOLDOWN_MAX = 600;
/** 宝箱两次开之间最小间隔 */
const BOX_MIN_GAP = 3;
/** 单个宝箱最多重试等几轮，防死循环 */
const BOX_WAIT_ROUNDS = 40;

// ============================================================================
// 二、小工具
// ============================================================================

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const line = (n) => '─'.repeat(n);
const now = () => {
    const d = new Date(Date.now() + 8 * 3600e3);
    return d.toISOString().replace('T', ' ').slice(0, 19);
};

function env(name, dflt) {
    const v = process.env[name];
    return v === undefined || v === '' ? dflt : String(v).trim();
}
/**
 * 运行模式：full / light
 *
 * 青龙上要跑两个条目，共用同一个脚本文件，靠命令行参数区分：
 *   task ks_nebula_daily.js          → full  （每天首轮，做 60 个任务的点击上报）
 *   task ks_nebula_daily.js light    → light （白天高频，只领取，不发点击上报）
 *
 * 优先级：命令行参数 > 环境变量 ks_mode > 默认 full
 */
function runMode() {
    const arg = String((process.argv || []).slice(2).join(' ') || '').toLowerCase();
    if (/\blight\b/.test(arg)) return 'light';
    if (/\bfull\b/.test(arg)) return 'full';
    return /^light$/i.test(env(ENV_MODE, 'full')) ? 'light' : 'full';
}
function on(name) {
    return /^(on|1|true|yes|开)$/i.test(env(name, ''));
}
function clip(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n) + '…' : s;
}
/** 去掉接口文案里的 <font> 之类标签 */
function plain(s) {
    return String(s == null ? '' : s).replace(/<[^>]+>/g, '');
}

// ============================================================================
// 三、HTTP（零依赖，自带 br/gzip/deflate 解压 + 重定向）
// ============================================================================
// 二、__NS_sig3 签名引擎（本次逆向的核心突破）
// ============================================================================
//
// 快手 2025 年把 H5 赚钱页的写操作全部加上了 __NS_sig3 签名，未签名的请求一律返回
//     {"result":50,"error_msg":"签名验证失败！"}
// 一开始以为这是 native 算法（libksxgs.so），实际上它就在 nebula 赚钱页的 JS chunk 里：
//
//   chunks_main-*.js 内嵌了一个 js-interpreter 沙箱（函数 tm），
//   沙箱里跑的是编译成字节码的 Jose 模块，对外暴露唯一方法 $encode(input) -> sig3
//
// 调用点是：
//   function ki(e){ return new Promise((t,n)=>{ xi.call("$encode",[e,{suc:t,err:n}]) }) }
//
// 两套签名模式（实测确认）：
//   模式 A（ztReportTask / ztExpandReportTask）：
//        sig3 = $encode( JSON.stringify(body) )
//        URL  → ?__NS_sig3=<sig3>
//        适用于 /rest/wd/zt/task/report、/rest/wd/ug/encourage/task/report、
//               /rest/wd/usergrowth/encourage/matrix/resource/action
//   模式 B（axios 拦截器 rI，带 sigCatVer）：
//        sig3 = $encode( 排序拼接(sigCatVer + Cookie白名单 + query) + JSON.stringify(body) )
//        URL  → ?__NS_sig3=<sig3>&sigCatVer=1
//
// 本脚本内置的是模式 A 的沙箱本体（从官方 chunk 原样抠出来的 23KB，非重新实现），
// 所以算法与服务端完全一致，不需要还原 $encode 内部的盐/摘要。
//
// 注意：沙箱里带时间因子，同一个输入每次结果不同，但服务端都能验过 —— 不要做缓存。
//
/** 沙箱里的 $encode 实现本体（原样搬运，勿改） */
function tm(e){(function(n,o){n.Jose=o()})(e,function(){return o={},t.m=n=[function(s,r){(function(){var a=function(d){return d.constructor.prototype},u=Object.create,i=function(d,p){return Object.prototype.hasOwnProperty.call(d,p)},c=Array.isArray,l=function(d,p,v){return Object.defineProperty(d,p,v)};r.prototypeOf=a,r.create=u,r.hasProp=i,r.isArray=c,r.defProp=l}).call(this)},function(s,r){(function(){function a(u){this.elements=u,this.index=0}a.prototype.next=function(){if(this.index>=this.elements.length)throw new Error("array over");return this.elements[this.index++]},r.ArrayIterator=a}).call(this)},function(s,r,a){function u(i){return(u=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(l){return typeof l}:function(l){return l&&typeof Symbol=="function"&&l.constructor===Symbol&&l!==Symbol.prototype?"symbol":typeof l})(i)}(function(){var i={}.hasOwnProperty,c=a(0).isArray,l=(f.prototype.run=function(){for(var E=this.callStack[this.depth],I=E.error;0<=this.depth&&E&&!this.paused;)if((E=I?this.unwind(I):E).run(),(I=E.error)instanceof Error&&this.injectStackTrace(I),E.done()){if(E.guards.length){var R=E.guards.pop();if(R.finalizer){E.ip=R.finalizer,E.exitIp=R.end,E.paused=!1;continue}}!E.construct||(R=u(this.rv))!=="object"&&R!=="function"&&(this.rv=E.scope.get(0)),(E=this.popFrame())&&!I&&(E.evalStack.push(this.rv),this.rv=void 0)}else I=(E=this.callStack[this.depth]).error;if(this.timedOut()&&(I=new Error(this),this.injectStackTrace(I)),I)throw I},f.prototype.unwind=function(E){for(var I=this.callStack[this.depth];I;){I.error=E;var R=I.ip-1,N=I.guards.length;if(N&&(N=I.guards[N-1],N.start<=R&&R<=N.end)){if(N.handler!==null)if(R<=N.handler)I.evalStack.push(E),I.error=null,I.ip=N.handler;else{if(!(N.finalizer&&I.ip<=N.finalizer)){I=this.popFrame();continue}I.ip=N.finalizer}else I.ip=N.finalizer;return I.paused=!1,I}I=this.popFrame()}throw E},f.prototype.injectStackTrace=function(E){var I,R,N,M,x,m,g,S=[],D=0;for(this.depth>this.maxTraceDepth&&(D=this.depth-this.maxTraceDepth),R=N=x=this.depth,m=D;x<=m?N<=m:m<=N;R=x<=m?++N:--N)(M=(I=this.callStack[R]).script.name)==="<anonymous>"&&I.fname&&(M=I.fname),S.push({at:{name:M,filename:I.script.filename},line:I.line,column:I.column});if(E.trace){for(g=E.trace;c(g[g.length-1]);)g=g[g.length-1];g.push(S)}else E.trace=S;return E.stack=E.toString()},f.prototype.pushFrame=function(E,I,R,N,M,x,m){if(x==null&&(x="<anonymous>"),m==null&&(m=!1),this.checkCallStack())return R=new A(R,E.localNames,E.localLength),R.set(0,I),m=new d(this,E,R,this.realm,x,m),M&&m.evalStack.push(M),N&&m.evalStack.push(N),this.callStack[++this.depth]=m},f.prototype.checkCallStack=function(){return this.depth!==this.maxDepth||(this.callStack[this.depth].error=new Error("maximum call stack size exceeded"),this.pause(),!1)},f.prototype.popFrame=function(){var E=this.callStack[--this.depth];return E&&(E.paused=!1),E},f.prototype.pause=function(){return this.paused=this.callStack[this.depth].paused=!0},f.prototype.resume=function(E){if(this.timeout=E!=null?E:-1,this.paused=!1,this.callStack[this.depth].paused=!1,this.run(),!this.paused)return this.rexp},f.prototype.timedOut=function(){return this.timeout===0},f.prototype.send=function(E){return this.callStack[this.depth].evalStack.push(E)},f.prototype.done=function(){return this.depth===-1},f);function f(E,I){this.realm=E,this.timeout=I!=null?I:-1,this.maxDepth=1e3,this.maxTraceDepth=50,this.callStack=[],this.evalStack=null,this.depth=-1,this.yielded=this.rv=void 0,this.paused=!1,this.r1=this.r2=this.r3=null,this.rexp=null}var d=(p.prototype.run=function(){for(var E=this.script.instructions;this.ip!==this.exitIp&&!this.paused&&this.fiber.timeout!==0;)this.fiber.timeout--,E[this.ip++].exec(this,this.evalStack,this.scope,this.realm);this.fiber.timeout===0&&(this.paused=this.fiber.paused=!0);var I=this.evalStack.len();if(!this.paused&&!this.error&&I!==0)throw new Error("Evaluation stack has "+I+" items after execution")},p.prototype.done=function(){return this.ip===this.exitIp},p.prototype.setLine=function(E){this.line=E},p.prototype.setColumn=function(E){this.column=E},p);function p(E,I,R,N,M,x){this.fiber=E,this.script=I,this.scope=R,this.realm=N,this.fname=M,this.construct=x!=null&&x,this.evalStack=new v(this.script.stackSize,this.fiber),this.ip=0,this.exitIp=this.script.instructions.length,this.paused=!1,this.finalizer=null,this.guards=[],this.rv=void 0,this.line=this.column=-1}var v=(_.prototype.push=function(E){if(this.idx===this.array.length)throw new Error("maximum evaluation stack size exceeded");return this.array[this.idx++]=E},_.prototype.pop=function(){return this.array[--this.idx]},_.prototype.top=function(){return this.array[this.idx-1]},_.prototype.len=function(){return this.idx},_.prototype.clear=function(){return this.idx=0},_);function _(E,I){this.fiber=I,this.array=new Array(E),this.idx=0}var A=(w.prototype.get=function(E){return this.data[E]},w.prototype.set=function(E,I){return this.data[E]=I},w.prototype.name=function(E){var I,R=this.names;for(I in R)if(i.call(R,I)&&R[I]===E)return parseInt(I);return-1},w);function w(E,I,R){this.parent=E,this.names=I,this.data=new Array(R)}var P=(b.prototype.get=function(E){return this.object[E]},b.prototype.set=function(E,I){return this.object[E]=I},b.prototype.has=function(E){return E in this.object},b);function b(E,I){this.parent=E,this.object=I}r.Fiber=l,r.Scope=A,r.WithScope=P}).call(this)},function(s,r,a){a=new(a(4)),a.eval('["<script>",0,[[21]č75ċ,falseĒď4,1,nullĝ16]ĝĀĂĄĆĈĊāanonymousĉč[Ĕ,28ėęěĝ3ČČ43ħĝĿ27ŃĚĜčŇĖ42Ōēĕ26őŅŔň,4đčŤľśĕĘŒņš40řŧŀğŪş[ŕČ39ŰŎ3ŞœŶš38Żś2žŬĖ3ĩťōśġŴſŷ,3ŘƌŚŀČƐƈŸŦŦĿ19ƇŠƉůƖű1łƚƣČ2źƦƟŐƪƀĖŁƄĠŝƲƒŏƶ1ũńƑšŜƼųƿƛŀ5ƼŽƹǁ4ƼƆǋƴƕ[ƞĕ1ƏǅƫŀƝƍĠƙǘƳƬƥǓǜơǐČƠƶƩǟƒƨƶƱǫš17ƶƸǰĖĨƶƾūǙƽƶǄǻǠĠǍƯĕǊǶǧŋȄŀƢȁ1ǒǔĠȌǬǛƗǞȀǬǢŦ2Ȗŵ7ňĝƭǷȠƋȁȉǓȤȡǧǢȞ,"$encode"ȠơŸħƝșȦ1ȃďǳťȨȸƓȤȬȮȰĄyćȶčȩƓȺħȼħȿƻɂȷŖƞČȮȴɊɌɘȹťȻħȽɕɁȧōġǢƒȿǸēġŦƒǈɗɯŀǆȤɮľġȦƒɧɹȬĨ1049478ƃēČ-3562Ů48ȿȬĐŊ0ƭƊɆʋƠ6ƽ80ʂʛ,-893Ŋʂ5ǒȬ-ƨʄ985ǲōʜ2ʐ5ʈʪʵʤț3ĨʺƵēğʉľʋȞ6Ŋ9ƽɚʤĨʃ7ƭʦȦʀʠƂʈʹ˅ʭʂˋ07Ơțʼ1Ɣ8Đʇ0˔ʜ5ŗ66ʃ˨ʼʮ5˟Ź097ʣǲƂˉˋʷō˄˿ɶǙ˅ɿǧȤƒƮɨʊĠǖ6ʍʐ0˚ǧʦʅʆ4ţʼŇʄƔʨ˟̙9Đ0˶˳˩,9ʞʱ˟̎ˢ5̑˷˶ʧʼʸƊʍ7ʒ̲8Ȟ˸ƔĐ̙ʏŊ8ʂʠ̙ʪʱŮˍˮˑ2ʫʇˢˬʺ̩ˢ̠̭ʇ˗̲ĨțʇțʣŜȾʈ́˰̋Ɣʒʷ͋̓͢8ʍ˵͇ʼŮͥʐ7̶̲ˉ̝˞̒,ˮʒ˞ʏͷͱʘ55ʱ̥Ȏʄƽʡ˾̋ƽ΀̑Ĩ̧̠͒0˼8͜΀ŗțʈʬƬ˥ƨʨʨ̉ʕ9ʫ9̧ʠͷƔʂʿƊ̞͢3Ɗ˳ƨˋ̙ʹ4ʫ̹ǖˢˣ̠6Σ̥έ˥ţʦɳˆ͸˭Ňˑ0ςȬͱ̏ΣȎˢƭʆ̤ˑˢŹʞ˥ƭˍ΍ʳͩȞȫǧʱ˭ʞψˍ˦ȞŜʍϞŲʎΡˮ3ɧʕ7̚ʲ̠Ϥ˥˨ʘţˍƔ΁ϱ̢̙̑ʨ˳ˉͱϺʳˮ6ʹʴ͢ˮ˨εʃͭ˶δ˟9˶̲Ĕŗέ̗ͭŇʷϋʔČ̭λʒʞʣЈДˮ΀ʣʈŹ˷̹ϯČΡ́ŹίϔʷϗĐͷƽϮ̢͛΃̶ʇϱͱΟϟ΀ʎ̲ͯϸʂʒǽ̋ͥϋʃʫ̲ƊƨʫŗПŲŁŊЃїŏʎϱπЯƓțŮʿʆуƓƔʧ͋˒́ˉǆ2Ƚĩīāăąćļ"rĊĎț,truſȬǢɏȚ̇ǁħ˹ɠĠȣǆѱĝł҄ɄǒȡġʐȠğġ"kɍȁȏɃƴɘɰɕҙȭpҝɬ҉ʼҒȑ˅ǂťɓ̋"slicȵȠĕɛҴҶҸǙςɹɏɕɄςҕĠӅğƆ"AҨšɸҠČҠҖӈȑ"bҝӆȾҘӕҧǆɭҊɎơġҮɸұσҳҵҷӘҺȭҼӪǆӀӐŢҋӅӢӇӛӊӌɷҪɵɫšɾʣҬӑҍ̋ѿҁҢŀ̉ʐȋ"zӍĖԀɩċǆ̄Ӓ,ɧɏ˅ȦŊԔӼďӶӃĖԚĝԜ̃Ԟ˟ҌӡȑȦүďĝ6ŐΎƯȪӾĖ̉ɿҖԈԬȨԯŐʂȔσʂԵȪԧǧԒҔӶȽɣťɥԄ[ԥǓՍɎԑԪаʼƲӆƭӸȭԎҋԣčՐƒԕҋʂ՗ǟՙԊӉ՜ӘɄ՟ՏɼšգՕԗ՞ņԤհԢԞέȭDatȵԓɎŽɫŽ"ստĊșӦɇparěӫӜ֎֐ˢ̢Ǣ4ʣ՘Ӷ՚ɎժԍլչŔշԝɴɺɐճծաձԧġԡČ֩ո֯ԞԙԈώ֝ӕdԏǧƝӲη֨նՠֱ,ղԟׅ֡ɰȚҥ"gֺ׃ֳխҋȽ֋ġӅǕĢĤĦ֥˭ƘǒǬҟդՈƉɒɤԒȨזģĥԞȸĪčĝרlחĥױװ"aınıtıր"oıvıfıcıuıѺīȎĠʧˎל׬ʦč"ıst֎tupRĳdom؃Ĺn׺ȭʡ֖Ղı֖֖ؓu؄ȭer؈׭ցĬѵįѸ׌ĽѽԆ҂ȟճ҆ҎԧğՃӳ֥ɏԬՉ׉ӕE׍ӱʼ"lȰgth֠РՎʀԤ֮,Ӆ҇ĖӏҫǆՔׅČѡَِْٖٔٚՆՠȿʹԯłʞҋԘӄՎɏȤ5نԐĝٸ̲΀ٻס٣ҋɭՋՑɔȠ١ɏɾȏς̘ǙɾħӀԯŝԭכʳҋӲٳŖɑҰפťɦ׏ښԪɻҔ׊IҝǍĝ׮ט׳ڬѹı׶ȭ׸ȭآ"Ҿ[ĒʨرڷزѴĮѷıֹظČغٟؽՎƒҏճٹɻوҚيӞՅزɲۑقٞճʣ٥nّٓڂՎٮč6łՐٶ۝ɎΔςёճςԛׂٌۗħڋԤɱӎŰьǣ۠ŝЊ[כέӴٽςˮԽŢ˅ڕҮٴՠقۮՁ۾ׁ֢Ӱڠٕэپč۩ȁ܊ɏӵȑˣӛҚ؂Ԥ׬ڻ[ׯڬܣڮȭڰ"ڲ"׺کŀŐܡĒǢڽѶİȭ؂ۂѾҀػز҅ۇƁ֬ےŭܐ֧σǢʎ܂Ňבˢٷ܄ԾΟɪڒƘԒϙӲגڝӧtoSѿi֑ۚҚݙݛąݞ֣Ǚӟݑ۽ɵם݂لɄȿڨںܣݲګܦ׵ҝĒǲؑاا0ݷڼĭܴѸҧܸۄ̋Ԃԩďٜɡ̊Ձ˂Ŷօݢݝط֊ݗɇfr؝Ch֎Cȳڶ͋ӕޗޙޛrޝȴ٨ɼݥȥۑۙۛި٪كՏ͜ުҩݭڡׇ̦Ԥ̇օMվٓزեՌٍҷilݟȭ߄߆܏̶֥݁ٝ۔٠Űډ܌[۟ۻłΊ́އڙԃɢף߂ڞڇߐԦƦִڢ޹ܔ܄ߘδٲʼѮՠܙֲ̋ݯڌٹދ߁څҲcޤަeAܬɎז"߻ޜޞ߿ҝʕݯ܆ٺ̋߯Տ߱׎߳Ԥߵˢުمߟ߹ӧࠄޥࠆࠀďࠂ߽ࠛࠇ݋Ԥ˅ږճѡࠎֿ߬ࠒ߰ުʕࠖɄݖߠࠚ߼ࠝ߇ࠃ࠶ȴࠣ̋˅̷ܔȚɄࠩߴյ࠭ࠏ࠯ދۣ࠲࠘ܛߺ࠺߾ࠞޠҚࠡ࠷ٻࡁ׆ߓۯۦڛǓӦӚՓ݃̄۱ՠ۳׆Ɲڑ۸ٚ܄۹ʍ߭ťࡣՏࡥځƦ۶ŦכŗݑȾωɛُۚ٧࡛݊ߧѧࡄ܎Ή٘ǆԷӲѧ࠾ࡻ̂σƔņ޼޾։ࡌ̥"pow֑ӊ࢚࢘޺ԈѧǒК۪ࠕ٬ڗՎ־࡝ݗ࡟ɀڠġࢡࢇࢤࢆࢦ࡚މۇ࢒٧߀֋ɛflooذࠟޡࢾࣀ֠ࢯ̲ࢱ٢٩ࢳՏٙȨɸڄࡍǓڟ޶Ֆ࠽ࠓͭϐ̧ˑΡٿࢠࢥ࣍ߔٗࢴ࣏࣊࡜߸࣒ࢬɖތۤՠܠڪײݳײݵܨܪڴ׼׾ȭ؀ܭǖłܰݿشڿȭӌބܺۅ࣊ؾǙۉ܋ۆࢁȁݧ˃ߎܑތɇࡽޮࢀࢶǼۖ݅ǆࢬࡗǧٙɹߖۡƓϓކझࡨईܙࣇߩٯֽٚࠐ࣪ࡋऎԭ҅ࠐӀ࣑Ւࢭࣕӷ࡯ڐ۲न۵ऩכ֜ۻŝ֘ࣟǼऩश߮٭ߪĠ̽ؽࢍࢢٙٛԈˡַҚM٨۶ϊࣉܘՎࡊǷࢍ۶ࢣ࣊ॖߧǨख़ȭ؞࠱ॣࠤࣤॠऎॢǧषࣧ࡞ࣔऔŉࣚ԰ƭऱॶߞڜ࠴࣪ٷȏऺ࣫ӁɄࡵࡰڍȍऩࡵݑ΁ࡹࢩ҃ۥङȁछࣣ࣊ɕފմߌƬখԭբۑ߶ޱঢšࢉͭডঝࣨʣࠐজझּ߮ফझן̋ߜদবऋকॊߒঊࢍࠎणłʐڀĠথ߸әҮ׊yڧেއࢩ҅סҖوސ্դफŀԻ८ॵߔԭ֪ǷڈɄԖۺԋҚ࢞ࢵ࡙࣊ࠋҖڤƓռ৖Ǽׄ৑झऋ҅ࡲॐ݃߸ȓ݃ԊঊɧՐȬŗʅࣛॾࣞǼșӲԚন݃ɧণ़ঝৡৠդ࠾̥ਂʄॽࣝܔݫߏ़ঋिࡤुࡴृ۹ࠎॄ࢐धճরࢵ਀ॻਃਘۨΙܼݮॷࢫॹ̅ވӂٵࡂࡈŢॼࣜਰ࣠ਹঁࢪঃਸ਼޳਩਺׆ਬ਽ਮਿਆσ৅ڃ࢕چࡠট݄ੂগɏ̉ੋਖ਄ਙߕ਱থ੒ং࠙࣪١ਁ঴ؽ֗ਕਾਅਚপੈ੃ࣨই੧ओ੘वঊŦੜ੭੟ܕȬয਴੅ߢ੖Ӳਪईࢢ੬੍੮੠঳ੱǓह੔ऻॺঞছ੉Ȉ਼੝ਯ੏फ़઎ࢩੳઑঈֽɭঌ৷ञਟ۷ॆŀǒۼʏখݰܡࣲװܥѺܧ׷׹׻ıࣹ"؀ܶ؃؅ıiı޿َؓıط"ֹࣼߍࣿܲހصگѻďۃआਨईܾע੖टਸঝশ࣊৅Ȧ̭ҋ੡૟ࣉ࠿ߕ੺࣯č઱ڭࣁݸġૌĝܳ૏ȭ࢚अԇ૕ܽऎۈۑ૤३Ȩ֞׶ϔघә૿Ԍଁܔ̥Έ࣊ۋƷ՛ݶٻԛ૩ܢګ૫ڮࣼŽ૰ؑ૎ं"ৌ૶ܻ৏૗߷ХଃӶӁ଀ࠈֻଥܚଅӊଇߕଉࠐଌଧଆҝټ࣮ܭଓࣱଔݴ૭৆ںܱ૱ଛܵ"؞ଟइૹগૻ੖সଳଭવˢࠋދ଄଎ଯଷଋ̙ٻ݆଑ହ૫ળݾ؊ଙسھୄज़େ૸ঊଢ݄਷৤ळ޸଴ମ଩؋ଫɰ୏ଏଈघʀ݆୛ܟଢ଼଼଻ࣳାୡܭ્ँୄS૑ع૔जऍ୊ܿ૙դ୪ऐ੐஑ૺšܗ୮੘ܕࠗ܈ߔܕୗયࣰલ୿״઴ݶڱୠƆୢ૲ଜDஉ૓૷஌૖஖૘ઓ૚उएૼகஎĖ஘வச૽१੏ୗ੷܇ઌ୸ସݱத૬ૐநࣼğ஫ୃѸҜ୧ல୉ধவɹґԒقׄߍق঩૕޵નक٦ۜۊ୪ɸডৢٻॏĨઅघટࡎࠅ࠻ࡑࠠࡏ࠼ܖ݃।ގणԾʄ࣢ǡ૦௾৆৅ࢍ΀ƭ݌Ƞ܂ૡߥெ੿џȿٱ۠Ծ̑খֶǓڌ৷ɭધ਷ЈٸӲ।ʘૠ਱߸૦௅௙ࢻ߈௸௶ӕࡔ௵୲ʂѰ௃੺ۭૼŮఁĠ࠾̉ࠧލ୒࣋ލԤѧ̫੯ࡀϏిীూ߮తࡖేహౄே૧ҋԷపࢗĺ௧ࣂğౖsౘɹכˣϤҗࢲుՠ఼ϙގॲσȤఀࠍౌెΉ౨ఏӑ౮౒ճ౔ޕɛp౗֑օ౺౜ҝ౞۹૦ʀԲூࠍొ౯ా౏౴ఽਗ਼੓Ҳ౾ౘޠ࢜౻Ԟ౟݇ౣಎ੤࣒֌ಕࠁӜಞ࣬ਲ਼ाťచېਢŰॄࡶ۹ಘல௣ˍޭࡿ౶୪ڏ઎৩ূƘ૚ٙԊ޻ȭޑݞࢺ౸ܶޘmޚ௴ޟࠂޢ೅ࡏ٨ְ֤ಢ޷ఘ॥ఛू಩۹ͲࡩƠ૚࠾ݑț̉ȘպօEدࣅܼփōĝ׫୾஀ண஁்ܩષحહ׿؇ҝľƘğʮƘźĒʱݺ஄ୂஆѸӗ௕়ள஼ଣ௜ಧઓ܉Żࡼ௦ޯழࡳન౩ಷॏϱঢ়ஙԖ࣫৥ȭ؆೏਷ەഎȭखಲ৪୪Էࢧಳभٰ۠থਉࢷಾݜೀޔ࠴ޖೄೆࠜާҹޡസೌখ۬ഋউਜǓતӻನƦબ঑থӀെҿೕ൉೗ݑ౐੘஡૪ோୟવநڳસȭ઺ࣻرʿ೿رஅ୤ѸجѼரଠ஻௘ഉऑقஓആۓ़।ٻ̉त঍ஜಆσࢌ୚ۿ੏കಣએಏ࣓ઃ೐ओ೒ದ൏ൈન౟ફŝʿમ଒୞ଽ೯׸ࣼơ௑ംિഅؼഇ൭୫Ɇفൂʣశఎ஽इఓߗŢথൌʼൽܔϩ͋ੀ͢ߔ०੘ઞॸආൃඈঌਛඈఝࡹඏѨඒ೫೭෇ȭ஦ࣵݾѽක൦ıxயܹறആௗঝ঻ඣݦߣ௺൴୙ܔ൷ۢ૚ථࣗ࠮නൿ౅ൻමઐߡ੕ඇీඉीඋનঐ೙සඑ઎ൖ଺෈൙஧೰඘ୀऀාիඝਲȢഒඡੁ୩ง൱ݐෲɿෙঘ݃ఒŐ͋୴ŀ৊ӕෑേތۼއଌജ׊ടǙঙඞɽ਌ٍഥಒ௬ऎಸ঒ࠨപਖ਼ଦԬ׊ܞౣുฎژ۰ધ঍ฦඌಫහࡩ౬ൻ෹ඔ೮൚೰൜ೲܭԋĀݾ൥ށೱ൩ී൫஍ච৵୮ʀಽࢗ֓eIء࢔ַ࢜๜๞ࠞಯੇӧษ഑গ࠰ՠЪࣘŔࢸ޿വ࠙֌࢙࢛Ҧ๶ߋ෮ॕࣈ๭࣠०܁ఔɅݑ൹ං౩०๦ළொ೬ௌ็඗رʷ฀๏૳"يคଡงෘऒޱഡ๺඼ీ௥ࡾสிఊഭŢ૚॓௱ౕsubؔࣁಓӭອຯࣆƓ҄׊ࡑං௲ӧ಑࠸ຽ஺ึ޴஗ೖ৸ࡩݩક௉ર൘ඕຎ෌Č෎๐ȭڦທ൬෗݀൰ෛ൳෮ࢍಱຣ୓ລණॴీൺԭʕܓ౑әำޡ׍छ່࣭Ŷໂ೑డฺಥ෱ොෳਣ໅઩໇ൕඓ໋ๆ෽ࣶୠ඙ؒഀଚඛ൛๒ޅ௖ชഈจ࣌ූඤ๽ඟ૜Ԟ௛௨ߧԖࡸ๡ȭBًـປฤथʍ̠Д˫ॗธҚบࢵົɇȲȱվ࠸༯c༱ป਷ਧ޸व׊؄ะ༭ɛ༳༵ಟࡓĵ༴๥۴ߌญ޸෷Ğى٨ӥೂࠃངཁࣂགྷ༰ཆൄ਷Ů˷ॗଅࡓཎ඄༮དྷభཕཅ໬ۑජਸห੄๴༿ར༲཮༶ԖϯɰٻȤ԰׃ǢכͩՇ༒ಶԠືӕqີ౨׊༫ࣥའ཭བ཯ྊཱԈωҙ༽ౕཀལ߈཰ร௻Ԉస५"ྂ༨ܜȭ྆໮༾ྕྌགྤཥྍҲ๩ঢ়ഛ༩ྠཟಛ࢖ྒྷྋྨྗෝ༬ྒྖཔྦྷནƒ໭ཪɏȏד੗קטಖಬׂ਑ഓ࿁འ഼֭ġׯתԓෆܤ໌෽ࣷ೵؉௿೹ɰټĒϱؑب࿢࿣ب3ı˫֘ıѩ1dέa-̗e7࿰7f࿳aʞ2ʌʡʳ4aaʂc8تجڵد๎ഁข"Zි་෕།๖ެྫ༘༎ஓ੘ջӋدaଞ҄Ž৷܊൲ཇ෮௰ബ໡সݕྈఫೇ௹ࡒဪഺࡐྰൻඹਵරӲɸൎฑ฾ࡹ൷ඐসڌ໾ຌ෼෋൜๋ଘ༆ୣ໑"jဍ஋໦๚AယလȠသƈɻੵປ๗வ၎௭मກ୘ේ੖ਊඨྷ൅฻඿෯ધ൸಺࣠఍໯চܕཷƊඩွ̟Θ̠Ƃ٭ׂஓ౟৽޷໤Չɾ෫අ෭ຟȽးୋ໸ໄြٚů࿔କ්શ๋ŝ໐ດྂ໔๕໖़ȦࠎԨ݆ྲྀԾතࡹဨߧƂྟဋ׍൱ʜພۘဓ໯ච༢ق਑ၖ࢑ഞnȴfݝeہ႞݈ఒၴႤթĖ၊ಀԁഠരࢵಸदധಶਐ྘ฯை੐໧஛ႀખຠ߲ߕ୼ุࡅၥ໵ਠߤႉ൑Ţཹŝભౣྚலၭไ໿஥ඖೱڵೳܭƔؑຯޒဈ༇ညր༊၍ඞ༑ऊۑஷஒເ༔ႫҐزʕႡྱٍӮೈӕᄋີ༚৭ӊ༞ྩ྇ౣ༭ཉိ࿑ךे۫ӿวᄖ࿃Ț࿅ש֥೪຋෻࿖၃ܫ࿙ĽݹƊ؍߬ĒѰჳث׻ဇ၇஬ୄ༞႗ᄃჾஐ႘ཽ࢏ʸ̑̎೟ǧเઓϢͩ˷˸ၕƓႩ਽ўʦʠᅆԫாŉఋຂตƯཉຉྪഐ੩໷୬ఆႴ"޽ࢹ๳ಜɛmaྡś६ᅭҨօၐrရ๠ďၔྶഌߑ़ှၜ຦ᅍ୨ࠌႮཏശ༿బ༲ᆈ࡮ᄕඃᄉ෬઒ຟڊ฻৷ವఙໄैࡩ˭इ฽໛ᆋੋఘಸʢᆋ໮੸ၣ࣊৿യઁ੥੆ᆋ෰პȁᆕכ7ႋʱᆛᄞᅽੰߕ௮ಭӆ໇Ȭ࠾ిѡݯᆩฬࡥɻၙɻїᇀᆋ੨ࢅᆌԭఽŕᇉࢮƓࢍᇋ჏σᇃะᇐᇆᇕᄟნᆖᆯᆜࡧໄ˜ࡹᆘ༌ԫૠ႟Ʒ฿Ĩї̭ͣΓŹᅎ໇ຝႤ٭ᇬ΍ࡹ჊ȬᅊŹͱٜᇓ੖Ҭɻۨᇺͱࡹͧᇙ͋԰ᅓЕƣሆ༠௝໙ᆷ෮٤Ⴍ໤໠तĐথ୍੉֭໪ҚF٨স̄ႂ੦ᇟᆮࡱᅼඍ۹Γೝψმც၁ᄩશ้ჯ൞ݾ̠ؑks-ěႺჶ၈ດሤᄼჽޫ੖ʖ̶ϜᇨᅞՁ˞Ϯπಭ໚਷ŜʓʍδၢߝઓቋʒƊʆር୬ቑ̶ƨళჟቖۡŊ˫໧̈ૼȾቌበቛǝতʷȎ͋ʆၧઞʣͮЈʿʓق೒ჅǼᇈᅏၬቺဖՉ൵෨ǬဠลǱ྿Ƿ๮ဥतˌୈՉ΃௃ɧཷ̧Ժኙ෦ᇘܕᇒᅈᇷཊኋ౑˳܂ཻႤኧၭಚ౑ኣ࡭ሄਡผŝ੟ᆽࠐӠიଐנ్ሑᇞᄿ঎࿇৆ԡᇇখၯკई݆ᇝᇶኃཊїŦடኛԾଊᆽዐൾࠬኰᅇʨሕǷၻ࡬ዅኆౣወኼؽዑዌᅐથ኉ǷኟՏిल९აᇑǱၙ̆໴ᇡሬचᆗႋȾᄈईૠׂድ݄ሴᄨༀᄪ࿘ሺࣺ؁ાഞીૂı߆ӭݾˉຒܠๅ״ુȭૃൟጐૅȭC೵ȭેہ"ܷࢗıऄ෽૵ଝı୆ᅦıஈ৯ȭ$ı௔Ӗጌ"؆ྯฃᄫȭຖ"໓"PıQıRሷ"Tıဌȭ။ȭ႖ሹ"ᄻ"ሤଗଘ"ʡŇı1ı4z˷PawDݛZkTQcે࿨5ဈହĒௐഀ'),s.exports=a},function(s,r,a){(function(u){var i=a(5),c=a(6),l=a(2).Fiber;function f(d){this.realm=new i(d),this.realm.global.startupRandom=Date.parse(new Date)/1e3,this.realm.global.count=100}f.prototype.eval=function(d,p){return d=function(v){var _,A={},w=v.split(""),P=w[0],b=w[0],E=[P],I=256;for(v=1;v<w.length;v++)_=(_=w[v].charCodeAt(0))<256?w[v]:A[_]||b+P,E.push(_),P=_.charAt(0),A[I]=b+P,I++,b=_;return E.join("")}(d),this.run(f.fromJSON(JSON.parse(d)),p)},f.prototype.run=function(d,p){if(p=this.createFiber(d,p),p.run(),!p.paused)return p.rexp},f.prototype.call=function(d,p){return this.realm.global[d].apply(this,p)},f.prototype.createFiber=function(d,p){return p=new l(this.realm,p),p.pushFrame(d,this.realm.global),p},f.fromJSON=c.fromJSON,s.exports=f}).call(this)},function(s,r,a){function u(i){return(u=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(l){return typeof l}:function(l){return l&&typeof Symbol=="function"&&l.constructor===Symbol&&l!==Symbol.prototype?"symbol":typeof l})(i)}(function(){var i={}.hasOwnProperty,p=a(0),c=p.prototypeOf,l=p.hasProp,p=a(1),f=p.ArrayIterator,d=p.StopIteration,p=(v.prototype.inv=function(_){return-_},v.prototype.lnot=function(_){return!_},v.prototype.not=function(_){return~_},v.prototype.inc=function(_){return _+1},v.prototype.dec=function(_){return _-1},v.prototype.add=function(_,A){return A+_},v.prototype.sub=function(_,A){return A-_},v.prototype.mul=function(_,A){return A*_},v.prototype.div=function(_,A){return A/_},v.prototype.mod=function(_,A){return A%_},v.prototype.shl=function(_,A){return A<<_},v.prototype.sar=function(_,A){return A>>_},v.prototype.shr=function(_,A){return A>>>_},v.prototype.or=function(_,A){return A|_},v.prototype.and=function(_,A){return A&_},v.prototype.xor=function(_,A){return A^_},v.prototype.ceq=function(_,A){return A==_},v.prototype.cneq=function(_,A){return A!=_},v.prototype.cid=function(_,A){return A===_},v.prototype.cnid=function(_,A){return A!==_},v.prototype.lt=function(_,A){return A<_},v.prototype.lte=function(_,A){return A<=_},v.prototype.gt=function(_,A){return _<A},v.prototype.gte=function(_,A){return _<=A},v);function v(_){var A,w,P={window:typeof window>"u"?{}:window,undefined:void 0,Object,Function,Number,Boolean,String,Array,Date,RegExp,Error,StopIteration:d,Math,JSON,console,encodeURIComponent,unescape,Uint8Array,parseInt,escape,decodeURIComponent};for(A in P.global=P,this.has=function(b,E){return b!=null&&(!!l(b,E)||this.has(c(b),E))},this.get=function(b,E){if(b!=null)return l(b,E)||typeof b=="string"&&typeof E=="number"||E==="length"?b[E]:this.get(c(b),E)},this.set=function(b,E,I){var R=u(b);return(R==="object"||R==="function")&&(b[E]=I),I},this.del=function(b,E){var I=u(b);return I!=="object"&&I!=="function"||delete b[E]},this.instanceOf=function(b,E){var I;return E!=null&&((I=u(E))==="object"||I==="function")&&E instanceof b},this.enumerateKeys=function(b){var E,I=[];for(E in b)E!=="__mdid__"&&I.push(E);return new f(I)},_)i.call(_,A)&&(w=_[A],P[A]=w);this.global=P}s.exports=p}).call(this)},function(s,r,a){(function(){var u=a(7),i=function p(v){for(var _=c(v[2]),A=[],w=v[3],P=0;P<w.length;P++){var b=w[P];A.push(p(b))}for(var E=v[4],I=E.length,R=[],N=v[5],M=0;M<N.length;M++){var x=N[M];R.push({start:x[0]!==-1?x[0]:null,handler:x[1]!==-1?x[1]:null,finalizer:x[2]!==-1?x[2]:null,end:x[3]!==-1?x[3]:null})}for(var m=v[6],g=v[7],S=[],D=v[8],H=0;H<D.length;H++){var V=D[H];S.push(l(V))}return new f(null,null,_,A,E,I,R,m,g,S,null)},c=function(v){for(var _=[],A=0;A<v.length;A++){for(var w=v[A],P=u[w[0]],b=[],E=1,I=1,R=w.length;1<=R?I<R:R<I;E=1<=R?++I:--I)b.push(w[E]);P=new P(b.length?b:null),_.push(P)}return _},l=function(v){var A=v.lastIndexOf("/"),_=v.slice(0,A),A=v.slice(A+1);return new RegExp(_,A)},f=(d.fromJSON=i,d);function d(p,v,_,A,w,P,b,E,I,R,N){this.filename=p,this.name=v,this.instructions=_,this.scripts=A,this.localNames=w,this.localLength=P,this.guards=b,this.stackSize=E,this.strings=I,this.regexps=R,this.source=N}s.exports=f}).call(this)},function(s,r,a){function u(i){return(u=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(l){return typeof l}:function(l){return l&&typeof Symbol=="function"&&l.constructor===Symbol&&l!==Symbol.prototype?"symbol":typeof l})(i)}(function(){var i,c,l=a(1).StopIteration,A=a(0),f=(A.defProp,A.hasProp),A=a(2),d=A.Fiber,p=A.Scope,v=A.WithScope,_=(i=0,function(m,g,S){var D;return D=function(V){V&&(this.args=V)},Object.defineProperty(D,"name",{writable:!0,value:m}),D.prototype.id=i++,D.prototype.name=m,D.prototype.exec=g,D.prototype.calculateFactor=S||function(){return 2},D}),A=[new(c=function(g,S,D){return _(g,S,D)})("",function(m,g,S){return N(m)}),new c("",function(m,g,S){return g.pop()}),new c("",function(m,g,S){return g.push(g.top())}),new c("",function(m,g,S){var D=g.pop(),H=g.pop();return g.push(D),g.push(H)}),new c("",function(m,g,S){return m.fiber.rv=g.pop(),N(m)}),new c("",function(m,g){return m.paused=!0}),new c("",function(m,g){return m.fiber.yielded=g.pop(),m.fiber.pause()}),new c("",function(m,g,S){return M(m,g.pop())}),new c("",function(m){return m.guards.push(m.script.guards[this.args[0]])}),new c("",function(m){var g=m.guards[m.guards.length-1];if(m.script.guards[this.args[0]]===g)return m.guards.pop()}),new c("",function(m,g,S){return m.fiber.r1=g.pop()}),new c("",function(m,g,S){return m.fiber.r2=g.pop()}),new c("",function(m,g,S){return m.fiber.r3=g.pop()}),new c("",function(m,g,S){return g.push(m.fiber.r1)}),new c("",function(m,g,S){return g.push(m.fiber.r2)}),new c("",function(m,g,S){return g.push(m.fiber.r3)}),new c("",function(m,g,S){return g.fiber.rexp=g.pop()}),new c("",function(m,g,S){return w(m,0,"iterator",g.pop())}),new c("",function(m,g,S,D){return g.push(D.enumerateKeys(g.pop()))}),new c("",function(m,g,S){if(w(m,0,"next",g.pop()),m.error instanceof l)return m.error=null,m.paused=!1,m.ip=this.args[0]}),new c("",function(m,g,S){if(S.set(1,g.pop()),g=g.pop(),this.args[0])return S.set(2,g)}),new c("",function(m,g,S,D){return g.push(D.global)}),new c("",function(m,g,S,D){var H=this.args[0],V=this.args[1],se=S.get(1);if(H<se.length)return S.set(V,Array.prototype.slice.call(se,H))}),new c("",function(m,g,S){return P(m,this.args[0],g.pop(),null,null,!0)}),new c("",function(m,g,S){return P(m,this.args[0],g.pop(),null,this.args[1])}),new c("",function(m,g,S){return w(m,this.args[0],g.pop(),g.pop(),this.args[1])}),new c("",function(m,g,S,D){var H=g.pop(),V=g.pop();return H==null?M(m,new Error("Cannot read property '"+V+"' of "+H)):g.push(D.get(H,V))}),new c("",function(m,g,S,D){var H=g.pop(),V=g.pop(),se=g.pop();return H==null?M(m,new Error("Cannot set property '"+V+"' of "+H)):g.push(D.set(H,V,se))}),new c("",function(m,g,S,D){var H=g.pop(),V=g.pop();return H==null?M(m,new Error("Cannot convert null to object")):g.push(D.del(H,V))}),new c("",function(m,g,S){for(var D=this.args[0],H=this.args[1],V=S;D--;)V=V.parent;return g.push(V.get(H))}),new c("",function(m,g,S){for(var D=this.args[0],H=this.args[1],V=S;D--;)V=V.parent;return g.push(V.set(H,g.pop()))}),new c("",function(m,g,S,D){for(var H,V=this.args[0];S instanceof v;){if(S.has(V))return g.push(S.get(V));S=S.parent}for(;S instanceof p;){if(0<=(H=S.name(V)))return g.push(S.get(H));S=S.parent}return f(D.global,V)||this.args[1]?g.push(D.global[V]):M(m,new Error(V+" is not defined"))}),new c("",function(m,g,S,D){for(var H,V=this.args[0],se=g.pop();S instanceof v;){if(S.has(V))return g.push(S.set(V,se));S=S.parent}for(;S instanceof p;){if(0<=(H=S.name(V)))return g.push(S.set(H,se));S=S.parent}return g.push(D.global[V]=se)}),new c("",function(m,g,S,D){return f(D.global,this.args[0])||this.args[1]?g.push(D.global[this.args[0]]):M(m,new Error(this.args[0]+" is not defined"))}),new c("",function(m,g,S,D){return g.push(D.global[this.args[0]]=g.pop())}),new c("",function(m){return m.scope=new p(m.scope,m.script.localNames,m.script.localLength)}),new c("",function(m){return m.scope=m.scope.parent}),new c("",function(m,g){return m.scope=new v(m.scope,g.pop())}),new c("",function(m,g,S,D){return g.push(D.inv(g.pop()))}),new c("",function(m,g,S,D){return g.push(D.lnot(g.pop()))}),new c("",function(m,g,S,D){return g.push(D.not(g.pop()))}),new c("",function(m,g,S,D){return g.push(D.inc(g.pop()))}),new c("",function(m,g,S,D){return g.push(D.dec(g.pop()))}),new c("",function(m,g,S,D){return g.push(D.add(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.sub(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.mul(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.div(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.mod(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.shl(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.sar(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.shr(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.or(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.and(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.xor(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.ceq(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.cneq(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.cid(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.cnid(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.lt(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.lte(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.gt(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.gte(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.has(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(D.instanceOf(g.pop(),g.pop()))}),new c("",function(m,g,S,D){return g.push(u(g.pop()))}),new c("",function(m,g){return g.pop(),g.push(void 0)}),new c("",function(m,g,S){return m.ip=this.args[0]}),new c("",function(m,g,S){if(g.pop())return m.ip=this.args[0]}),new c("",function(m,g,S){if(!g.pop())return m.ip=this.args[0]}),new c("",function(m,g){return g.push(void 0)}),new c("",function(m,g,S){return g.push(this.args[0])}),new c("",function(m,g,S){return g.push(m.script.strings[this.args[0]])}),new c("",function(m,g,S,D){return g.push(new RegExpProxy(m.script.regexps[this.args[0]],D))}),new c("",function(m,g,S,D){for(var H=this.args[0],V={};H--;)D.set(V,g.pop(),g.pop());return g.push(V)}),new c("",function(m,g,S,D){for(var H=this.args[0],V=new Array(H);H--;)V[H]=g.pop();return g.push(V)}),new c("",function(m,g,S,D){var H=this.args[0];return g.push(b(m.script.scripts[H],S,D,this.args[1]))}),new c("",function(m){return m.setLine(this.args[0])}),new c("",function(m){return m.setColumn(this.args[0])}),new c("",function(m,g,S){return x()})],w=function(g,S,D,H,V){var se=g.evalStack,Y=g.realm;if(H==null)return M(g,new Error("Cannot call method '"+D+"' of "+(H===void 0?"undefined":"null")));var W=H.constructor.name||"Object",Y=Y.get(H,D);return Y instanceof Function?P(g,S,Y,H):Y==null?(se.pop(),M(g,new Error("Object #<"+W+"> has no method '"+D+"'"))):(se.pop(),M(g,new Error("Property '"+D+"' of object #<"+W+"> is not a function")))},P=function(g,S,D,H,V,se){if(typeof D!="function")return M(g,new Error("object is not a function"));for(var W=g.evalStack,Y=g.fiber,pe=g.realm,_e={length:S,callee:D};S;)_e[--S]=W.pop();H=H||pe.global,_e=Array.prototype.slice.call(_e);try{var B=se?R(D,_e):D.apply(H,_e);if(!Y.paused)return W.push(B)}catch(Z){M(g,Z)}},b=function(g,S,D,H){return function V(){var se,W,Y,pe=!1;if((W=V.__fiber__)?(W.callStack[W.depth].paused=!0,V.__fiber__=null,se=V.__construct__,V.__construct__=null):(W=new d(D),pe=!0),Y=V.__callname__||g.name,V.__callname__=null,W.pushFrame(g,this,S,arguments,V,Y,se),pe)return W.run(),W.rv}},E=function(g){return g.length===1&&(0|g[0])===g[0]?new Array(g[0]):g.slice()},I=function(g){return g.length===1?new RegExp(g[0]):new RegExp(g[0],g[1])},R=function(g,S){var D;return g===Array?E(S):g===Date?new Date:g===RegExp?I(S):g===Number?new Number(S[0]):g===Boolean?new Boolean(S[0]):g===Uint8Array?new Uint8Array(S[0]):((D=function(){return g.apply(this,S)}).prototype=g.prototype,new D)},N=function(g){return g.evalStack.clear(),g.exitIp=g.ip},M=function(g,S){return g.error=S,g.paused=!0},x=function(){};s.exports=A}).call(this)}],t.c=o,t.d=function(s,r,a){t.o(s,r)||Object.defineProperty(s,r,{enumerable:!0,get:a})},t.r=function(s){typeof Symbol<"u"&&Symbol.toStringTag&&Object.defineProperty(s,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(s,"__esModule",{value:!0})},t.t=function(s,r){if(1&r&&(s=t(s)),8&r||4&r&&typeof s=="object"&&s&&s.__esModule)return s;var a=Object.create(null);if(t.r(a),Object.defineProperty(a,"default",{enumerable:!0,value:s}),2&r&&typeof s!="string")for(var u in s)t.d(a,u,function(i){return s[i]}.bind(null,u));return a},t.n=function(s){var r=s&&s.__esModule?function(){return s.default}:function(){return s};return t.d(r,"a",r),r},t.o=function(s,r){return Object.prototype.hasOwnProperty.call(s,r)},t.p="",t(t.s=3);function t(s){if(o[s])return o[s].exports;var r=o[s]={i:s,l:!1,exports:{}};return n[s].call(r.exports,r,r.exports,t),r.l=!0,r.exports}var n,o})}

/** $encode 对外封装；未初始化时返回 null，调用方自行降级 */
let __JOSE = null;
function sig3Engine() {
    if (__JOSE) return __JOSE;
    try {
        const box = {};
        tm(box);
        __JOSE = box.Jose || null;
    } catch (e) {
        __JOSE = null;
    }
    return __JOSE;
}

/**
 * 计算 __NS_sig3
 * @param {string} input 签名输入串（模式 A 就是 JSON.stringify(body)）
 * @returns {Promise<string|null>} 失败返回 null，调用方降级为不签名
 */
function sig3(input) {
    return new Promise((resolve) => {
        const jose = sig3Engine();
        if (!jose) return resolve(null);
        let done = false;
        const finish = (v) => {
            if (done) return;
            done = true;
            resolve(v == null ? null : String(v));
        };
        try {
            jose.call('$encode', [
                String(input == null ? '' : input),
                { suc: (v) => finish(v), err: () => finish(null) },
            ]);
        } catch (e) {
            finish(null);
        }
        setTimeout(() => finish(null), 8000); // 沙箱卡死兜底
    });
}

/**
 * 从真机签名网关取 68 位 __NS_sig3
 *
 * 背景：网页侧 $encode 只能产 56 位，服务端只认 App 原生的 68 位。
 * 网关（ks_sig_gateway.py）把平板上的 Frida 桥暴露成 HTTP，这里直接要真值。
 *
 * @param {string} input signInput 串
 * @returns {Promise<string|null>}
 */
let __GW_WARNED = false;
function sig3Remote(input) {
    return new Promise((resolve) => {
        const gw = env(ENV_SIG_GW, '').replace(/\/+$/, '');
        if (!gw) return resolve(null);
        const payload = JSON.stringify({ input: String(input == null ? '' : input) });
        const body = Buffer.from(payload, 'utf8');
        const timeout = Math.max(3, Number(env(ENV_SIG_GW_TIMEOUT, '10')) || 10) * 1000;
        let done = false;
        const finish = (v) => { if (!done) { done = true; resolve(v == null ? null : String(v)); } };

        let u;
        try { u = new URL(gw + '/sign'); } catch (e) { return finish(null); }
        const mod = u.protocol === 'https:' ? https : http;
        const req = mod.request({
            protocol: u.protocol,
            hostname: u.hostname,
            port: u.port || (u.protocol === 'https:' ? 443 : 80),
            path: u.pathname + (u.search || ''),
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
            timeout,
        }, (res) => {
            const cs = [];
            res.on('data', (c) => cs.push(c));
            res.on('end', () => {
                const t = decompress(Buffer.concat(cs), res.headers['content-encoding']).toString('utf8');
                try {
                    const j = JSON.parse(t);
                    if (j && j.sig3) {
                        const s = String(j.sig3);
                        if (s.length !== 68 && !__GW_WARNED) {
                            __GW_WARNED = true;
                            console.log(`      ⚠️ 网关返回 ${s.length} 位（期望 68），锁定的签名函数可能不对，看 /candidates`);
                        }
                        return finish(s);
                    }
                    if (!__GW_WARNED) {
                        __GW_WARNED = true;
                        console.log(`      ⚠️ 网关签名失败：${t.slice(0, 160)}`);
                    }
                } catch (e) { }
                finish(null);
            });
        });
        req.on('timeout', () => { req.destroy(); finish(null); });
        req.on('error', (e) => {
            if (!__GW_WARNED) {
                __GW_WARNED = true;
                console.log(`      ⚠️ 签名网关不可达（${gw}）：${e.message}`);
            }
            finish(null);
        });
        req.write(body);
        req.end();
    });
}

/**
 * 写接口是否值得挂签名
 * 只有配了网关（能拿到 68 位真值）才给写接口挂 sig3；
 * 没配网关时保持原行为（不签名，直接吃 result=50），避免白等本地沙箱 8 秒。
 */
function sigReady() {
    return !!env(ENV_SIG_GW, '').replace(/\s/g, '');
}

/** 签名总入口：网关优先（68 位真值），无网关时降级本地 56 位 */
async function signFor(input) {
    const viaGw = await sig3Remote(input);
    if (viaGw) return viaGw;
    const local = await sig3(input);
    if (local && on(ENV_DEBUG)) {
        console.log(`      [debug] 本地 sig3 长度 ${local.length}（56=网页侧降级实现，服务端会 result=50）`);
    }
    return local;
}

// ============================================================================

function decompress(buf, enc) {
    enc = String(enc || '').toLowerCase();
    try {
        if (enc.includes('br')) return zlib.brotliDecompressSync(buf);
        if (enc.includes('gzip')) return zlib.gunzipSync(buf);
        if (enc.includes('deflate')) return zlib.inflateSync(buf);
        // 头里没写就靠魔数猜
        if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) return zlib.gunzipSync(buf);
        if (buf.length > 1 && buf[0] === 0x78) return zlib.inflateSync(buf);
        return buf;
    } catch (e) {
        return buf;
    }
}

function request(opts, depth = 0) {
    return new Promise((resolve, reject) => {
        if (depth > 4) return reject(new Error('重定向过多'));
        const u = new URL(opts.url);
        const isHttps = u.protocol === 'https:';
        const mod = isHttps ? https : http;
        const body = opts.data === undefined || opts.data === null
            ? null
            : Buffer.isBuffer(opts.data)
                ? opts.data
                : Buffer.from(typeof opts.data === 'string' ? opts.data : JSON.stringify(opts.data), 'utf8');

        const headers = Object.assign(
            {
                'User-Agent': UA,
                Accept: 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                Referer: HOST_NEBULA + '/nebula/task/cash?layoutType=4',
                Origin: HOST_NEBULA,
                Connection: 'keep-alive',
            },
            opts.headers || {}
        );
        if (body) headers['Content-Length'] = body.length;

        const req = mod.request(
            {
                protocol: u.protocol,
                hostname: u.hostname,
                port: u.port || (isHttps ? 443 : 80),
                path: u.pathname + (u.search || ''),
                method: opts.method || 'GET',
                headers,
                timeout: opts.timeout || 30000,
            },
            (res) => {
                // 重定向
                if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && depth < 4) {
                    res.resume();
                    const next = new URL(res.headers.location, opts.url).toString();
                    return resolve(request(Object.assign({}, opts, { url: next }), depth + 1));
                }
                const chunks = [];
                res.on('data', (c) => chunks.push(c));
                res.on('end', () => {
                    const raw = decompress(Buffer.concat(chunks), res.headers['content-encoding']);
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        text: raw.toString('utf8'),
                    });
                });
            }
        );
        req.on('timeout', () => req.destroy(new Error('请求超时')));
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

// ============================================================================
// 四、快手 H5 客户端
// ============================================================================

class KsClient {
    constructor(cookie, label) {
        this.cookie = String(cookie || '').replace(/^\s*cookie\s*:\s*/i, '').replace(/\s+/g, ' ').trim();
        this.label = label || '账号';
        this.jar = {};
        this.cookie.split(';').forEach((p) => {
            const i = p.indexOf('=');
            if (i > 0) this.jar[p.slice(0, i).trim()] = p.slice(i + 1).trim();
        });

        // ---- 渠道号纠偏（实测必踩的坑）------------------------------------
        // kpn 是渠道标识。极速版是 nebula 渠道，只有 nebula 系 kpn 才认这份 Cookie。
        // 从网页版/主站抓来的 Cookie 带的是 kpn=KUAISHOU_VISION（主站），
        // 原样发到 nebula 接口会被按错误渠道解析会话，直接返回
        //   result=10023（未登录），表现就像「Cookie 失效」，其实一个字节都没坏。
        //
        //   实测：不带 kpn          -> 1
        //         kpn=KUAISHOU_NEBULA -> 1
        //         kpn=NEBULA          -> 1
        //         kpn=KUAISHOU_VISION -> 10023   <- 网页版抓包默认值
        //         kpn=KUAISHOU        -> 10023
        //
        // 处理：非 nebula 渠道一律改成 KUAISHOU_NEBULA。
        if (this.jar.kpn && !/NEBULA/i.test(this.jar.kpn)) {
            this.jar.kpn = 'KUAISHOU_NEBULA';
        }

        this.ud = this.jar.ud || this.jar.userId || '';
        this.name = this.ud ? 'ud_' + this.ud : '未知账号';

        // ---- Cookie 来源判定（决定能力上限）--------------------------------
        // App 包（真机/模拟器抓包）有 egid + kuaishou.api_st；
        // 网页包只有 kuaishou.web.api_st，没有 egid。
        // 实测差异（同一账号、同一接口）：
        //   treasureBox/report  App 包 -> result:1 真到账   网页包 -> result:50
        // 所以这里提前告诉用户手上这份是哪种，省得排查半天。
        this.isApp = !!this.jar.egid && !!this.jar['kuaishou.api_st'];
        this.hasEgid = !!this.jar.egid;
    }

    /** 拼 Cookie：原始串 + 服务端 Set-Cookie 回写 */
    cookieHeader() {
        const merged = Object.assign({}, this.jar);
        return Object.keys(merged).map((k) => `${k}=${merged[k]}`).join('; ');
    }

    /**
     * 构造 __NS_sig3 的签名输入串（模式 B，sigCatVer=1）
     *
     * 还原自 nebula 主包 chunks/main-*.js：
     *   const ad = ["kpn","kpf","userId","did","c","appver","language","mod",
     *               "did_tag","egid","oDid","androidApiLevel","newOc",
     *               "browseType","socName","ftt","abi","userRecoBit",
     *               "device_abi","grant_browse_type","iuid","rdid"];
     *   → 只从 Cookie 里取上面这些字段（非空）
     *   → 混合 { sigCatVer:1, ...cookie白名单, ...query参数 }
     *   → 每项变成 "k=v"，跳过 __NS 开头的键
     *   → 按整串做字典序排序 → 空分隔拼接
     *   → 非 GET 再拼 body 原文
     */
    signInput(params, method, bodyStr) {
        const bag = Object.assign({}, this.jar);
        const picked = {};
        SIG_COOKIE_KEYS.forEach((k) => {
            if (bag[k] !== undefined && bag[k] !== '') picked[k] = bag[k];
        });
        const merged = Object.assign({ sigCatVer: SIG_CAT_VER }, picked, params || {});

        const parts = Object.keys(merged)
            .filter((k) => !k.startsWith('__NS'))
            .map((k) => {
                const v = merged[k];
                return `${k}=${v && typeof v === 'object' ? '' : v}`;
            })
            .sort((a, b) => (a === b ? 0 : a < b ? -1 : 1))
            .join('');

        const m = String(method || 'GET').toUpperCase();
        const isBodyless = m === 'GET' || m === 'HEAD' || m === 'OPTIONS';
        return isBodyless ? parts : parts + (bodyStr || '');
    }

    absorbSetCookie(headers) {
        const sc = headers['set-cookie'];
        if (!sc) return;
        (Array.isArray(sc) ? sc : [sc]).forEach((one) => {
            const kv = String(one).split(';')[0];
            const i = kv.indexOf('=');
            if (i > 0) this.jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
        });
    }

    /**
     * 发一个 H5 请求
     * @param {string} path   /rest/... 路径
     * @param {object} o      {method, params, body, host, referer, form}
     */
    async call(path, o) {
        o = o || {};
        const host = o.host || HOST_NEBULA;
        let url = host + path;
        if (o.params && Object.keys(o.params).length) {
            const q = Object.keys(o.params)
                .filter((k) => o.params[k] !== undefined && o.params[k] !== null)
                .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(o.params[k])}`)
                .join('&');
            if (q) url += (url.includes('?') ? '&' : '?') + q;
        }

        const headers = {
            Cookie: this.cookieHeader(),
            Referer: o.referer || HOST_NEBULA + '/nebula/task/cash?layoutType=4',
        };
        const method = (o.method || 'GET').toUpperCase();
        let data;
        if (method !== 'GET' && method !== 'HEAD') {
            if (o.form) {
                data = Object.keys(o.body || {})
                    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(o.body[k])}`)
                    .join('&');
                headers['Content-Type'] = 'application/x-www-form-urlencoded';
            } else {
                data = JSON.stringify(o.body || {});
                headers['Content-Type'] = 'application/json';
            }
        }

        // 需要 __NS_sig3 的接口 —— 模式 B（sigCatVer=1）
        // 真实算法从 nebula web 主包 chunks/main-*.js 还原：
        //   SIG_COOKIE_KEYS 白名单取值 + sigCatVer + query 参数
        //   → 按 "k=v" 字符串字典序排序 → 直接拼接（分隔符为空）
        //   → POST 再拼上 body 原文 → $encode() 得 sig3
        // 见文件头「签名链」章节。
        if (o.sig3) {
            const sg = await signFor(this.signInput(o.params, method, data));
            if (sg) {
                url += (url.includes('?') ? '&' : '?') + '__NS_sig3=' + encodeURIComponent(sg)
                     + '&sigCatVer=' + SIG_CAT_VER;
            } else if (on(ENV_DEBUG)) {
                console.log(`      [debug] sig3 引擎未产出结果，${path} 将不带签名`);
            }
        }

        const res = await request({ url, method, headers, data, timeout: o.timeout || 30000 });
        this.absorbSetCookie(res.headers);

        let json = null;
        try {
            json = JSON.parse(res.text);
        } catch (e) {
            /* 非 JSON */
        }
        if (on(ENV_DEBUG)) {
            console.log(`      [debug] ${method} ${path} → ${res.status} ${clip(res.text, 300)}`);
        }
        return { status: res.status, text: res.text, json, raw: res };
    }

    /** result 是不是 1 */
    ok(r) {
        return !!(r && r.json && Number(r.json.result) === R.OK);
    }
    /** 人类可读的失败原因 */
    why(r) {
        if (!r) return '无响应';
        if (r.json) {
            const code = r.json.result;
            let msg = plain(r.json.error_msg || r.json.msg || r.json.message || '');
            if (Number(code) === R.SIG_FAIL) {
            msg = '__NS_sig3 签名未通过 —— 该接口要求 App 侧签名（详见文件头「签名链」说明）';
        }
            if (Number(code) === R.NET) msg = '网关会话异常（Cookie 可能已失效或参数不合规）';
            return `result=${code}${msg ? ' ' + msg : ''}`;
        }
        return `HTTP ${r.status} 非 JSON 响应`;
    }

    // ---- 具体业务 ----

    /** 余额 + 昵称 */
    async basicInfo() {
        const r = await this.call('/rest/n/nebula/activity/earn/overview/basicInfo');
        if (!this.ok(r)) return { ok: false, why: this.why(r) };
        const d = r.json.data || {};
        if (d.userName) this.name = String(d.userName);
        if (d.userId) this.ud = String(d.userId);
        return {
            ok: true,
            coin: Number(d.totalCoin == null ? 0 : d.totalCoin) || 0,
            cash: d.totalCash != null ? d.totalCash : d.balance,
            raw: d,
        };
    }

    /** 签到日历，返回今日状态 */
    async signInDetail() {
        const r = await this.call('/rest/wd/encourage/unionTask/signIn/detail', {
            referer: HOST_ENCOURAGE + '/kwai/calendar?layoutType=4&source=card',
        });
        if (!this.ok(r)) return { ok: false, why: this.why(r) };
        const d = r.json.data || {};
        let today = null;
        (d.signInMonthInfoList || []).forEach((m) => {
            (m.signInDayInfoList || []).forEach((it) => {
                if (it.today) today = it;
            });
        });
        // status: 2 = 今日已签并已发奖；1 = 待签；3/4/5 = 未签/过期/灰色
        const signed = !!(today && Number(today.status) === 2);
        return {
            ok: true,
            signed,
            status: today ? Number(today.status) : null,
            amount: today && today.amountText ? Number(today.amountText) : 0,
            continuous: plain((d.specialAreaInfo || {}).subtitle || ''),
            cancelBasicSignIn: !!d.cancelBasicSignIn,
        };
    }

    /** 执行签到（幂等：已签回 102006） */
    async signInReport() {
        const r = await this.call('/rest/wd/encourage/unionTask/signIn/report', {
            method: 'GET',
            params: { source: SOURCE },
            referer: HOST_ENCOURAGE + '/kwai/calendar?layoutType=4&source=card',
            sig3: sigReady(),   // 网关在线时挂 68 位签名；否则保持原行为
        });
        if (!r.json) return { ok: false, why: `HTTP ${r.status} 非 JSON` };
        const code = Number(r.json.result);
        if (code === R.OK) {
            const d = r.json.data || {};
            const rr = d.reportRewardResult || {};
            const toast = rr.awardToast || {};
            const amt = toast.amount || (toast.title && toast.title.rewardCount) || rr.awardAmount || '';
            return { ok: true, already: false, amount: amt, msg: plain(toast.subTitle || toast.title || d.toast || '') };
        }
        if (code === R.SIGNED_TODAY) return { ok: true, already: true, msg: plain(r.json.msg || r.json.error_msg) };
        return { ok: false, why: this.why(r) };
    }

    /** 宝箱状态 */
    async boxInfo() {
        const r = await this.call('/rest/wd/encourage/unionTask/treasureBox/info');
        if (!this.ok(r)) return { ok: false, why: this.why(r) };
        const d = r.json.data || {};
        // appTimerReportInfo 是「本轮开箱进度任务」：
        //   null            -> 没有进度任务，宝箱直接可开
        //   {reportCount:n, stageCompleteAmount:300}
        //                   -> 必须先攒满 300 点进度才能开
        // 实测（2026-11-01）：这个进度只能由 App 原生定时器
        //（bridge: growth.startTreasureBoxTimeReportTask）推进，
        // 纯 HTTP 无论等多久、调多少次 report，reportCount 都不会涨。
        // 原生真正的上报口是
        //   POST https://apissl.ksapisrv.com/rest/n/encourage/unionTask/treasureBox/report
        // 但它要 App 侧 __NS_sig3，HTTP 拿不到。
        const ti = d.appTimerReportInfo || null;
        const need = ti ? Number(ti.stageCompleteAmount || 0) : 0;
        const have = ti ? Number(ti.reportCount || 0) : 0;
        return {
            ok: true,
            remain: Number(d.remainSeconds == null ? 0 : d.remainSeconds),
            status: d.status,
            stageIndex: d.stageIndex,
            reward: Number(d.rewardCount || 0),
            needFill: !!ti && have < need,
            fillHave: have,
            fillNeed: need,
        };
    }

    /** 开宝箱 */
    async boxReport() {
        const r = await this.call('/rest/wd/encourage/unionTask/treasureBox/report', {
            method: 'POST',
            body: {},
            sig3: sigReady(),
        });
        if (!r.json) return { ok: false, why: `HTTP ${r.status} 非 JSON` };
        const code = Number(r.json.result);
        if (code !== R.OK) return { ok: false, why: this.why(r) };
        const d = r.json.data || {};
        const title = d.title || {};
        // type: 1 = 奖励到账；2 = 倒计时未到；其它 = 各种限制
        const hit = Number(d.type) === 1;
        return {
            ok: true,
            hit,
            type: d.type,
            text: plain(title.text || ''),
            reward: Number(title.rewardCount || 0),
            prefix: (title.rewardUnit || ''),
        };
    }

    /** 任务卡列表 */
    async taskCards() {
        const r = await this.call('/rest/n/nebula/activity/earn/overview/taskCard/list', {
            params: { source: SOURCE },
        });
        if (!this.ok(r)) return { ok: false, why: this.why(r), cards: [] };
        const list = ((r.json.data || {}).taskCards) || [];
        const cards = list.map((c) => {
            const d = c.taskCardShowDetail || {};
            const p = d.progressArea || {};
            return {
                taskCardId: c.taskCardId,
                taskId: d.taskId,
                title: plain(d.title || ''),
                canReward: !!p.canReward,
                buttonText: plain(p.buttonText || ''),
                buttonUrl: p.buttonLinkUrl || '',
                amount: Number(p.rewardedPrizeAmount || 0),
                progressText: plain(p.text || ''),
            };
        });
        return { ok: true, cards };
    }

    /** 领任务卡金币：POST /rest/n/nebula/task/reward {taskId} */
    async taskReward(taskId) {
        const r = await this.call('/rest/n/nebula/task/reward', {
            method: 'POST',
            body: { taskId },
            sig3: sigReady(),
        });
        if (!r.json) return { ok: false, why: `HTTP ${r.status} 非 JSON` };
        const code = Number(r.json.result);
        if (code === R.OK) {
            const d = r.json.data || {};
            const pop = d.popup || {};
            return {
                ok: true,
                already: false,
                amount: Number(pop.amount || 0),
                suffix: pop.suffix || '金币',
                msg: plain(pop.title || d.toast || ''),
            };
        }
        if (code === R.NO_MORE_REWARD) return { ok: true, already: true, msg: plain(r.json.error_msg) };
        return { ok: false, why: this.why(r) };
    }

    /** 任务卡埋点上报（顺手打一下，纯埋点不产金币，失败无所谓） */
    async taskCardReport(taskCardId, event) {
        const r = await this.call('/rest/n/nebula/activity/earn/overview/taskCard/report', {
            method: 'POST',
            body: { taskCardId, reportEvent: event },
        });
        return this.ok(r);
    }

    /** 任务清单（只用于报告里统计可自动化项） */
    async taskList() {
        const r = await this.call('/rest/n/nebula/activity/earn/overview/tasks');
        if (!this.ok(r)) return { ok: false, tasks: [] };
        const d = r.json.data || {};
        const tasks = (d.dailyTasks || []).map((t) => ({
            id: t.id,
            name: plain(t.name || ''),
            desc: plain(t.desc || ''),
            linkType: t.linkType,
            done: !!t.finish,
            status: t.status,
        }));
        return {
            ok: true,
            todo: Number(d.finishTaskCount || 0),
            total: tasks.length,
            tasks,
            raw: d.dailyTasks || [],
        };
    }

    /** 提现进度 */
    async withdraw() {
        const r = await this.call('/rest/n/nebula/account/withdraw');
        if (!this.ok(r)) return { ok: false, why: this.why(r) };
        const d = r.json.data || {};
        return {
            ok: true,
            coin: Number(d.totalCoin || d.coin || 0),
            cash: d.cash != null ? d.cash : d.totalCash,
            raw: d,
        };
    }

    /**
     * 通用 zt 任务完成上报（需要 __NS_sig3 · 模式 A）
     * 任务列表里 extParam.ztReportParams 给出了 reportUrl / taskId / subBizId / reportCount
     * 实测：金币商城浏览任务 549503 → result:1, completedTimesChanged:true, +30 金币
     */
    async taskReportUg(taskId, subBizId, reportCount) {
        const r = await this.call('/rest/wd/ug/encourage/task/report', {
            method: 'POST',
            sig3: true,
            body: {
                taskId: Number(taskId),
                subBizId: Number(subBizId == null ? 0 : subBizId),
                reportCount: Number(reportCount == null ? 1 : reportCount),
            },
        });
        if (!this.ok(r)) return { ok: false, why: this.why(r) };
        const d = r.json.data || {};
        return { ok: true, changed: !!d.completedTimesChanged, taskId: d.taskId };
    }

    /**
     * matrix 资源位点击上报（需要 __NS_sig3 · 模式 A）
     * 赚钱页每个任务卡片的点击都会打这条，服务端据此记录"用户点过这个任务"。
     * 实测：75 个任务全部 result:1，本身不产金币，但会把任务放进待完成态。
     * @param {object} et eventTrackingLogInfo（单个对象，不是数组）
     */
    async clickTask(et) {
        const r = await this.call('/rest/wd/usergrowth/encourage/matrix/resource/action', {
            method: 'POST',
            sig3: true,
            body: { actionType: 2, resourceSlotInfo: et },
        });
        return { ok: this.ok(r), why: this.ok(r) ? '' : this.why(r) };
    }
}

// ============================================================================
// 五、单账号主流程
// ============================================================================

async function runAccount(acc, idx, total) {
    const tag = `[${idx}/${total}]`;
    console.log('');
    console.log(`  ${tag} ${acc.label}`);

    const c = new KsClient(acc.ck, acc.label);

    // ---- 0. 探活 ----
    const base = await c.basicInfo();
    if (!base.ok) {
        console.log(`    ✗ 会话失效  ${base.why}`);
        console.log(`      这台机器的 Cookie 已经不能用了（STS 过期 / 被顶号 / 复制时截断）。`);
        return {
            label: acc.label,
            name: c.name,
            status: 'dead',
            coin: null,
            gain: 0,
            msg: base.why,
            detail: [],
        };
    }
    console.log(`    👤 ${c.name}   💰 当前金币 ${base.coin}`);
    if (base.cash != null) console.log(`    💵 可提现   ${base.cash} 元`);
    console.log(
        c.isApp
            ? '    🔑 Cookie 类型：App 包（含 egid）—— 写接口免签名可用'
            : c.hasEgid
              ? '    🔑 Cookie 类型：部分 App 字段（有 egid，缺 api_st）'
              : '    🔑 Cookie 类型：网页包（无 egid）—— 写接口会要 __NS_sig3，多数做不了'
    );

    const detail = [];
    let gain = 0;

    // ---- 1. 签到 ----
    console.log(`    ${line(46)}`);
    console.log('    📅 签到');
    const dt = await c.signInDetail();
    if (dt.ok && dt.signed) {
        console.log(`       · 日历显示今日已签（连签「${dt.continuous}」）`);
        detail.push(`签到=已签(${dt.continuous})`);
    }
    const sg = await c.signInReport();
    if (sg.ok && sg.already) {
        console.log(`       · 已领过今日奖励，跳过  ${clip(sg.msg, 40)}`);
        if (!detail.length) detail.push('签到=已签');
    } else if (sg.ok) {
        console.log(`       ✓ 签到成功  +${sg.amount || '?'}  ${clip(sg.msg, 40)}`);
        gain += Number(sg.amount) || 0;
        detail.push(`签到=+${sg.amount || '?'}`);
    } else {
        console.log(`       ✗ 签到失败  ${sg.why}`);
        detail.push('签到=失败');
    }

    // ---- 2. 任务卡领金币 ----
    console.log(`    ${line(46)}`);
    console.log('    🎴 任务卡领金币');
    const tc = await c.taskCards();
    if (!tc.ok) {
        console.log(`       ✗ 拉列表失败  ${tc.why}`);
    } else if (!tc.cards.length) {
        console.log('       · 今天没有任务卡');
    } else {
        for (const card of tc.cards) {
            const canClaim = card.canReward && card.taskId && /task\/reward/.test(card.buttonUrl || 'task/reward');
            if (!canClaim) {
                console.log(`       · 「${clip(card.title, 22)}」暂不可领  ${clip(card.progressText, 26)}`);
                continue;
            }
            const rr = await c.taskReward(card.taskId);
            if (rr.ok && rr.already) {
                console.log(`       · 「${clip(card.title, 22)}」已领完  ${clip(rr.msg, 20)}`);
            } else if (rr.ok) {
                console.log(`       ✓ 「${clip(card.title, 22)}」+${rr.amount} ${rr.suffix}`);
                gain += Number(rr.amount) || 0;
                detail.push(`任务卡${card.taskId}=+${rr.amount}`);
            } else {
                console.log(`       ✗ 「${clip(card.title, 22)}」${rr.why}`);
            }
            // 顺手打一个埋点，让服务端认为用户真的点过（失败不影响）
            await c.taskCardReport(card.taskCardId, 'clickReward').catch(() => {});
            await sleep(rand(1, 2) * 1000);
        }
    }

    // ---- 2.5 任务中心：点击上报 + zt 任务上报 ----
    // 每天跑一次 full 就够（点击上报只是把任务标成"已点过"，本身不给金币）。
    // 青龙上白天高频跑的是 light 模式，这里整段跳过，避免一天上百次 POST 触发风控。
    const lightMode = runMode() === 'light';
    console.log(`    ${line(46)}`);
    console.log('    🖱 任务中心上报');
    const tl0 = await c.taskList();
    let ztDone = 0;
    let clickDone = 0;
    if (!tl0.ok) {
        console.log(`       · 拉任务表失败，跳过  ${tl0.why || ''}`);
    } else if (lightMode) {
        console.log(`       · light 模式：跳过点击上报（共 ${tl0.total} 个任务，交给每天首轮 full 处理）`);
    } else {
        // (a) 每个任务打一次点击上报，把任务置为"已点击/进行中"
        for (const t of tl0.raw) {
            let et = t.eventTrackingLogInfo;
            if (Array.isArray(et)) et = et[0];
            if (!et || !et.eventTrackingTaskId) continue;
            const cr = await c.clickTask(et);
            if (cr.ok) clickDone += 1;
            await sleep(rand(120, 320));
        }
        // (b) 带 ztReportParams 的任务 → 直接上报完成（例如"浏览金币商城权益兑换页面"）
        for (const t of tl0.raw) {
            const z = (t.extParam || {}).ztReportParams;
            if (!z || !z.taskId || !/encourage\/task\/report/.test(String(z.reportUrl || ''))) continue;
            const ur = await c.taskReportUg(z.taskId, z.subBizId, z.reportCount);
            if (ur.ok && ur.changed) {
                ztDone += 1;
                console.log(`       ✓ 「${clip(plain(t.name || ''), 22)}」浏览完成上报`);
                detail.push(`浏览任务${z.taskId}=完成`);
            } else if (!ur.ok) {
                console.log(`       · 「${clip(plain(t.name || ''), 22)}」${ur.why}`);
            }
            await sleep(rand(600, 1200));
        }
        console.log(`       · 点击上报 ${clickDone}/${tl0.total} 个任务 · 完成上报 ${ztDone} 个`);

        // (c) 任务清单分类汇总：告诉用户哪些当场就能做、哪些必须进 App
        const cls = classifyTasks(tl0.raw);
        if (cls.length) {
            console.log('       · 任务构成（按完成方式）');
            for (const g of cls) {
                console.log(`         ${g.emoji} ${g.label.padEnd(16)} ${String(g.n).padStart(2)} 个  ${g.hint}`);
            }
        }
    }

    // ---- 3. 开宝箱 ----
    console.log(`    ${line(46)}`);
    console.log('    🎁 开宝箱');
    const boxWait = on(ENV_BOX_WAIT);
    const boxMax = Number(env(ENV_BOX_MAX, '20')) || 20;
    let opened = 0;
    let boxGain = 0;

    for (let n = 0; n < boxMax; n++) {
        // ---- 1. 查状态：先判断是"可开"还是"要 App 填进度" ----
        let bi = await c.boxInfo();
        if (!bi.ok) {
            console.log(`       ✗ 查状态失败  ${bi.why}`);
            break;
        }
        if (bi.needFill) {
            // 进度任务未攒满。实测纯 HTTP 填不动，直接说清楚，不让用户干等。
            console.log(
                `       · 本轮进度 ${bi.fillHave}/${bi.fillNeed}，需 App 前台攒满才能开`
            );
            console.log(
                `         在手机上打开极速版、停在赚钱页约 ${Math.ceil((bi.fillNeed - bi.fillHave) / 60)} 分钟即可`
            );
            break;
        }

        // ---- 2. 可开但要等倒计时（服务端 remainSeconds 是唯一权威） ----
        let guard = 0;
        while (bi.ok && bi.remain > 0 && !bi.needFill) {
            if (!boxWait) {
                console.log(`       · 下一个宝箱还要 ${bi.remain}s，本次不等（ks_box_wait=on 可连开）`);
                break;
            }
            if (guard >= BOX_WAIT_ROUNDS) {
                console.log(`       · 冷却反复未结束，本轮放弃（已开 ${opened} 个）`);
                break;
            }
            // 单次最多睡 6 分钟，睡醒必须重新问服务端，不能盲信倒计时
            const w = Math.min(bi.remain, BOX_COOLDOWN_MAX);
            console.log(`       ⏳ 等 ${w}s 开第 ${n + 1} 个宝箱…（本次已开 ${opened} 个）`);
            await sleep((w + BOX_MIN_GAP) * 1000);
            guard += 1;
            bi = await c.boxInfo();
            if (bi.ok && bi.needFill) break;
        }
        if (!bi.ok || bi.remain > 0 || bi.needFill) break;

        // ---- 3. 开 ----
        const br = await c.boxReport();
        if (!br.ok) {
            console.log(`       ✗ 开箱失败  ${br.why}`);
            break;
        }
        if (!br.hit) {
            console.log(`       · 未到账：${clip(br.text, 26)}  待 ${br.reward} 金币`);
            // 服务端说没到，重查一次状态；若变成需要填进度就直接停
            const chk = await c.boxInfo();
            if (!chk.ok || chk.needFill || chk.remain > 0) break;
            n -= 1;
            await sleep(BOX_MIN_GAP * 1000);
            continue;
        }
        opened += 1;
        boxGain += br.reward;
        console.log(`       ✓ 第 ${opened} 个宝箱  +${br.reward} ${br.prefix || '金币'}`);
        if (opened >= boxMax) break;
        await sleep(rand(BOX_MIN_GAP, BOX_MIN_GAP + 2) * 1000);
    }
    if (opened) {
        gain += boxGain;
        detail.push(`宝箱${opened}个=+${boxGain}`);
    } else if (!boxWait) {
        detail.push('宝箱=未开');
    }

    // ---- 3.5 App 内任务时段提醒 ----
    // 饭补 / 睡觉 / 走路 这三类金币只能在 App 里领（要真实看广告、真实睡眠、计步传感器），
    // HTTP 拿不到。但它们的"开放时间窗"是公开接口能查的 —— 提前告诉你，到点手动点一下就有。
    console.log(`    ${line(46)}`);
    console.log('    ⏰ App 内任务时段');
    const reminders = await appTimers(c);
    if (reminders.length) {
        for (const r of reminders) {
            console.log(`       ${r.emoji} ${r.text}`);
            detail.push(r.short);
        }
    } else {
        console.log('       · 当前没有可领的时段任务');
    }

    // ---- 4. 收尾 ----
    console.log(`    ${line(46)}`);
    const after = await c.basicInfo();
    const coinNow = after.ok ? after.coin : base.coin;
    const realGain = coinNow - base.coin;
    console.log(`    💰 结束金币 ${coinNow}（本次净增 ${realGain >= 0 ? '+' : ''}${realGain}）`);

    const tl = await c.taskList();
    if (tl.ok) {
        console.log(`    📋 每日任务 ${tl.total} 项｜HTTP 侧可完成：签到 · 宝箱 · 任务卡 · 商城浏览；`);
        console.log(`       看广告/刷视频/直播/短剧/游戏 属于 App 内行为，用 ks_device_farm.py 在真机跑`);
    }

    return {
        label: acc.label,
        name: c.name,
        status: opened || gain > 0 ? 'ok' : 'ok',
        coin: coinNow,
        gain: realGain,
        detail,
        msg: '',
        reminders,
    };
}

// ============================================================================
// 3.4 任务分类（按"怎么才能完成"）
// ============================================================================
// 60 个日常任务里，HTTP 侧能真正完成的只有很少几个，其余都绑死在 App 原生行为上。
// 这里按 linkUrl 的 scheme + 描述关键字归类，输出给用户看，避免"为什么跑了还是 0"的困惑。
function classifyTasks(list) {
    const buckets = {
        http: { n: 0, emoji: '✅', label: 'HTTP 可做', hint: '本轮已尝试上报' },
        app: { n: 0, emoji: '📱', label: 'App 内行为', hint: '需真机：看视频/广告/直播/游戏' },
        h5: { n: 0, emoji: '🌐', label: 'H5 活动页', hint: '页面能开，判定仍要 App 信号' },
        share: { n: 0, emoji: '👥', label: '邀请/分享', hint: '需真人好友，脚本做不了' },
        other: { n: 0, emoji: '❓', label: '其它', hint: '' },
    };
    for (const t of list || []) {
        const link = String(t.linkUrl || '');
        const name = plain(t.name || '') + ' ' + plain(t.desc || '');
        if (/邀|好友|分享|助力|二维码|face-qrcode|fission/i.test(name) || /fission/i.test(link)) {
            buckets.share.n += 1;
        } else if (/^ksnebula:\/\//i.test(link)) {
            buckets.app.n += 1;
        } else if (/^https?:\/\/encourage\.kuaishou\.com|^https?:\/\/nebula\.kuaishou\.com/i.test(link)) {
            buckets.h5.n += 1;
        } else if (/看广告|看视频|直播|短剧|游戏|斗地主|消消乐|搜索|听小说|走路|睡觉|饭补/.test(name)) {
            buckets.app.n += 1;
        } else if (/^https?:\/\//i.test(link)) {
            buckets.h5.n += 1;
        } else {
            buckets.other.n += 1;
        }
    }
    return Object.keys(buckets)
        .map((k) => buckets[k])
        .filter((b) => b.n > 0);
}

// ---------------------------------------------------------------------------
// 3.5 App 内任务时段检测
// ---------------------------------------------------------------------------
// 返回可读的提醒列表。只读接口，不产生任何写操作。
async function appTimers(c) {
    const out = [];
    const now = Date.now();

    // 饭补：一天 4 个时段，每段都能领一笔
    try {
        const r = await c.call('/rest/wd/encourage/unionTask/dish/detail', { host: HOST_ENCOURAGE });
        const d = r && r.json && Number(r.json.result) === R.OK ? r.json.data : null;
        if (d && Array.isArray(d.items)) {
            for (const it of d.items) {
                if (!it || !it.startTime || !it.endTime) continue;
                if (it.awarded) continue;
                const inWin = now >= it.startTime && now <= it.endTime;
                if (!inWin) continue;
                const st = new Date(it.startTime);
                const en = new Date(it.endTime);
                const hm = (dt) => `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                out.push({
                    emoji: '🍚',
                    text: `饭补进行中 ${hm(st)}-${hm(en)}  可领 ${it.amount} 金币（App 内看广告领）`,
                    short: `饭补时段=${hm(st)}-${hm(en)}`,
                });
            }
            // 顺便提示尚未开始的时段
            for (const it of d.items) {
                if (!it || !it.startTime || it.awarded) continue;
                if (now < it.startTime) {
                    const st = new Date(it.startTime);
                    const hm = `${String(st.getHours()).padStart(2, '0')}:${String(st.getMinutes()).padStart(2, '0')}`;
                    out.push({
                        emoji: '🕐',
                        text: `下一段饭补 ${hm} 开始，${it.amount} 金币`,
                        short: `饭补预告=${hm}`,
                    });
                    break;
                }
            }
        }
    } catch (e) { /* 接口不可用时静默跳过 */ }

    // 睡觉赚金币：20:00 ~ 次日 05:00
    try {
        const r = await c.call('/rest/wd/encourage/unionTask/relax/detail', { host: HOST_ENCOURAGE });
        const d = r && r.json && Number(r.json.result) === R.OK ? r.json.data : null;
        if (d) {
            const hh = new Date().getHours();
            const inWin = hh >= 20 || hh < 5;
            const cnt = d.goodRelaxCount;
            if (inWin) {
                out.push({
                    emoji: '😴',
                    text: `睡觉赚金币时段内（${d.startSleepTime}-${d.startWakeUpTime}）已优质睡眠 ${cnt} 次`,
                    short: `睡觉=时段内(优质${cnt})`,
                });
            }
        }
    } catch (e) { /* ignore */ }

    return out;
}

// ============================================================================
// 六、推送
// ============================================================================

function pushChannels() {
    const c = [];
    if (env('QYWX_KEY', '')) c.push('企业微信');
    if (env('QYWX_AM', '')) c.push('企业微信应用');
    if (env('PUSH_PLUS_TOKEN', '')) c.push('PushPlus');
    if (env('SCKEY', '')) c.push('Server酱');
    if (env('TG_BOT_TOKEN', '') && env('TG_CHAT_ID', '')) c.push('Telegram');
    return c;
}

function pushOn() {
    if (env(ENV_TY_PUSH, '') && !on(ENV_TY_PUSH)) return false;
    return on(ENV_PUSH) || env(ENV_PUSH, 'on') === 'on';
}

async function push(results) {
    if (!pushOn()) return;
    const list = pushChannels();
    if (!list.length) {
        console.log('\n  📪 未配置推送渠道，跳过（配 QYWX_KEY / PUSH_PLUS_TOKEN 任意一个即可）');
        return;
    }

    const ok = results.filter((r) => r.status === 'ok').length;
    const dead = results.filter((r) => r.status === 'dead').length;
    const totalGain = results.reduce((s, r) => s + (Number(r.gain) || 0), 0);

    let md = `## 快手极速版 · ${now()}\n\n`;
    md += `**${ok} 成功 / ${dead} 失效 · 合计 +${totalGain} 金币**\n\n`;
    results.forEach((r) => {
        const icon = r.status === 'dead' ? '❌' : '✅';
        md += `### ${icon} ${r.name}\n`;
        md += `- 金币：**${r.coin == null ? '—' : r.coin}**（+${r.gain}）\n`;
        if (r.detail && r.detail.length) md += `- 明细：${r.detail.join(' · ')}\n`;
        if (r.msg) md += `- 备注：${clip(r.msg, 120)}\n`;
        md += '\n';
    });
    // App 内任务的时段提醒单独拎出来，免得埋在明细里被忽略
    const allRem = results.reduce((a, r) => a.concat(r.reminders || []), []);
    if (allRem.length) {
        md += `### ⏰ 现在打开 App 就能领\n`;
        for (const r of allRem) md += `- ${r.emoji} ${r.text}\n`;
        md += `\n> 这几项服务端要求真实看广告 / 真实睡眠 / 计步传感器，HTTP 侧拿不到，只能手动点一下。\n\n`;
    }
    if (dead) md += `> ⚠️ 有账号 Cookie 失效，重抓 ks_ck 覆盖即可。\n`;

    const title = `快手极速版 +${totalGain} 金币`;
    const errors = [];
    const done = [];

    if (env('QYWX_KEY', '')) {
        try {
            const r = await request({
                url: `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${env('QYWX_KEY')}`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                data: { msgtype: 'markdown', markdown: { content: md } },
            });
            const j = JSON.parse(r.text);
            if (j.errcode === 0) done.push('企业微信');
            else throw new Error(j.errmsg || '未知');
        } catch (e) {
            errors.push('企业微信 → ' + e.message);
        }
    }

    if (env('PUSH_PLUS_TOKEN', '')) {
        try {
            const r = await request({
                url: 'https://www.pushplus.plus/send',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                data: { token: env('PUSH_PLUS_TOKEN'), title, content: md, template: 'markdown' },
            });
            const j = JSON.parse(r.text);
            if (j.code === 200) done.push('PushPlus');
            else throw new Error(j.msg || '未知');
        } catch (e) {
            errors.push('PushPlus → ' + e.message);
        }
    }

    if (env('SCKEY', '')) {
        try {
            const r = await request({
                url: `https://sctapi.ftqq.com/${env('SCKEY')}.send`,
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                data: `title=${encodeURIComponent(title)}&desp=${encodeURIComponent(md)}`,
            });
            const j = JSON.parse(r.text);
            if (j.code === 0) done.push('Server酱');
            else throw new Error(j.message || '未知');
        } catch (e) {
            errors.push('Server酱 → ' + e.message);
        }
    }

    if (env('TG_BOT_TOKEN', '') && env('TG_CHAT_ID', '')) {
        try {
            const r = await request({
                url: `https://api.telegram.org/bot${env('TG_BOT_TOKEN')}/sendMessage`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                data: { chat_id: env('TG_CHAT_ID'), text: md, disable_web_page_preview: true },
            });
            const j = JSON.parse(r.text);
            if (j.ok) done.push('Telegram');
            else throw new Error(j.description || '未知');
        } catch (e) {
            errors.push('Telegram → ' + e.message);
        }
    }

    if (done.length) console.log(`\n  📮 推送完成：${done.join('、')}`);
    if (errors.length) console.log(`  ⚠️  推送异常：${errors.join('；')}`);
}

// ============================================================================
// 七、参数解析
// ============================================================================

function parseAccounts() {
    const raw = env(ENV_CK, '') || env(ENV_CK_ALT, '');
    if (!raw) return [];
    return raw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith('#'))
        .map((s, i) => {
            // 支持 "备注#Cookie" —— 备注里不能带 "=" 且不能太长
            const m = s.match(/^([^=#]{1,24})#(.+)$/);
            let label = `账号${i + 1}`;
            let ck = s;
            if (m) {
                label = m[1].trim();
                ck = m[2].trim();
            }
            const ud = (ck.match(/(?:^|;\s*)(?:ud|userId)=(\d+)/) || [])[1];
            if (ud) label += `（ud_${ud}）`;
            return { label, ck };
        });
}

// ============================================================================
// 八、主流程
// ============================================================================

async function main() {
    console.log('');
    console.log('  ' + line(58));
    console.log('    🎬 快手极速版 · 每日签到 + 自动赚金币   v1.0');
    console.log('  ' + line(58));

    const accounts = parseAccounts();
    if (!accounts.length) {
        console.log('');
        console.log(`  ⚠️  没读到 Cookie（环境变量 ${ENV_CK}）`);
        console.log('');
        console.log('    这个平台的密码登录已经被风控整体封死了，只能用 Cookie：');
        console.log('');
        console.log('      POST id.kuaishou.com/pass/kuaishou/login/phone/v2');
        console.log('        正确密码   → 100110150 密码登录存在安全隐患');
        console.log('        错误密码   → 100110150 密码登录存在安全隐患  ← 一模一样');
        console.log('        不存在的号 → 100110150 密码登录存在安全隐患  ← 还是一样');
        console.log('');
        console.log('    三个不同输入同一个码 = 服务端根本没收密码，这条路是死的。');
        console.log('');
        console.log('    抓 Cookie（务必在 App 里抓，别用网页版）：');
        console.log('      1. iPhone/安卓 打开快手极速版，进「我的」确认已登录');
        console.log('      2. Reqable / Stream 抓包，过滤 nebula.kuaishou.com');
        console.log('      3. 点任意请求 → 复制完整 Cookie 请求头（约 3000 字符，别截断）');
        console.log(`      4. 青龙「环境变量」新建 ${ENV_CK}，整串贴进去`);
        console.log('');
        console.log('    多账号：一行一个 Cookie，回车分隔。');
        console.log(`    带备注：${ENV_CK} 里写  大号#<cookie整串>`);
        console.log('');
        return;
    }

    const channels = pushChannels();
    console.log('');
    console.log(`    📇 账号 ${accounts.length} 个 · 间隔 ${env(ENV_DELAY, '5-15')} 秒`);
    console.log(`    📮 推送 ${channels.length ? channels.join(' / ') : '未配置（静默）'}`);
    console.log(`    🎯 模式 ${runMode() === 'light' ? 'light（只领取，不发点击上报）' : 'full（含 60 个任务点击上报）'}`);
    console.log(`    🎁 宝箱 ${on(ENV_BOX_WAIT) ? `连开模式，单次最多 ${env(ENV_BOX_MAX, '20')} 个` : '只开当前可开的一个'}`);

    const results = [];
    for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];
        try {
            results.push(await runAccount(acc, i + 1, accounts.length));
        } catch (e) {
            console.log(`    ✗ 异常：${e.message}`);
            results.push({ label: acc.label, name: acc.label, status: 'fail', coin: null, gain: 0, detail: [], msg: e.message });
        }
        if (i < accounts.length - 1) {
            const [a, b] = String(env(ENV_DELAY, '5-15')).split('-').map((x) => Number(x.trim()));
            const lo = Number.isFinite(a) ? a : 5;
            const hi = Number.isFinite(b) ? b : lo + 10;
            await sleep(rand(lo, hi) * 1000);
        }
    }

    const ok = results.filter((r) => r.status === 'ok').length;
    const dead = results.filter((r) => r.status === 'dead').length;
    const fail = results.filter((r) => r.status === 'fail').length;
    const gain = results.reduce((s, r) => s + (Number(r.gain) || 0), 0);

    console.log('');
    console.log('  ' + line(58));
    console.log(`    📊 ✅ ${ok} 成功 · ❌ ${dead} 失效 · ⚠️ ${fail} 异常 · 合计 +${gain} 金币`);
    console.log('  ' + line(58));

    if (dead) {
        console.log('');
        console.log('  💡 Cookie 失效了，重新抓一次覆盖 ks_ck 即可。');
        console.log('');
        console.log('     快手 SSO 的 STS（kuaishou.api_st）不对外续期，');
        console.log('     过期后没有 refresh 接口可用，只能重抓 —— 所有快手脚本都一样。');
        console.log('     重抓时注意：别在网页版登录，网页版和 App 是两套 session，');
        console.log('     在网页版登录会把 App 的顶掉。');
        console.log('');
    }

    await push(results);
    console.log('');
}

main().catch((e) => {
    console.error('');
    console.error('  💥 脚本异常：' + (e && e.stack ? e.stack : e));
    process.exit(1);
});
