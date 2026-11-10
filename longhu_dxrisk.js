/* -------------------------------------------------------------------------
 *  项目名称：龙湖天街（顶象设备指纹模块）
 *  脚本文件：longhu_dxrisk.js
 *  更新说明：
 *    2026-11-09  Mist  仓库首发：XXTEA 指纹签发，供 longhu_signin.js require
 * -------------------------------------------------------------------------
 */
/**
 * ============================================================================
 *  龙湖天街 · 顶象设备指纹签发模块（longhu_dxrisk.js）
 * ============================================================================
 *
 *  作    者：Mist
 *  版    本：v1.0
 *  归    属：龙湖天街签到项目 主脚本/core 模块（被 longhu_signin.js require）
 *
 * ----------------------------------------------------------------------------
 *  【这个文件是干什么的】
 * ----------------------------------------------------------------------------
 *  龙湖签到接口要求带 X-LF-DXRisk-Token —— 顶象（dingxiang-inc）设备指纹。
 *  以前只能从 App 里手工抠（localStorage 的 _dx_app_<appId>），一个账号一份，
 *  换账号就要重装 App 重建容器，非常难用。
 *
 *  本文件把 SDK 的签发链路整条搬到了 Node：
 *
 *      seed   = protobuf {1: 设备消息, 2: 1002, 3: map{K451:ms, K452:ms, ...164 项}}
 *      sign   = md5(appKey + seed + appKey)
 *      body   = XXTEA( zip{entry "data" -> seed} , key = "ea8a55a43621eacd" )
 *      POST   = https://ly-sta.longhu.net/udid/m1?sign=..&appKey=..&app=..&version=..
 *      resp   = XXTEA( zip{entry "data" -> {1:1002, 2:{1:token}, 3:code}} )
 *
 *  算法逐行对照 app/dxrisk.py（ken861222/longhu-checkin 的脱敏实现）移植，
 *  164 项设备字段表原样保留，只做了三件事：
 *
 *    1. 语言换掉：Python struct/hashlib/zipfile → Node Buffer/crypto/zlib；
 *    2. 自建了一个最小 ZIP 读写器（Node 没有内置 zip，只用到 deflate-raw 和
 *       local header + central directory，够服务端 ZipInputStream 用）；
 *    3. 一账号一指纹的派生盐从「龙湖 token」变成了调用方传进来的 salt。
 *
 * ----------------------------------------------------------------------------
 *  【为什么一个账号必须一份指纹】
 * ----------------------------------------------------------------------------
 *  实测（原项目 README 2026-11-03）：同一个指纹被多个账号使用，会被判
 *  「同一设备多账号」，直接触发风控。所以指纹不是设备级资产，是账号级资产。
 *
 *  本模块按 salt（调用方传账号 token）做 sha256 派生出 UUID / HEX 类设备标识：
 *
 *      seed_bytes = sha256("dx-device:" + salt)     ← 只在本机算，不入网
 *      take(n)    = sha256(seed_bytes + [计数器]) 拼接后切片
 *
 *  同一 token → 同一台「设备」（跨机器、跨容器都稳定）；
 *  不同 token → 不同设备。龙湖 token 不会出现在任何请求里，只当盐用。
 *
 *  注意：设备标识类字段（UUID、≥8 位 HEX）才派生，纯数字和结构性字段原样保留——
 *  和原版 _derive_value 的规则完全一致，改多了服务端会判 -10005。
 *
 * ----------------------------------------------------------------------------
 *  【机型预设】
 * ----------------------------------------------------------------------------
 *  /udid/m1 会校验 品牌 / 机型 / 代号 / build fingerprint / UA 之间的自洽性，
 *  只改其中一项直接 -10005（实测）。所以这里不出字段编辑，只给 5 套成套预设：
 *
 *      pixel7（默认，= 表内原始脱敏值） / xiaomi14 / oneplus12 / vivo_x100 / samsung_s24
 *
 *  通过环境变量 longhu_dx_profile 选，或按账号在 longhu_token 里写「备注#token#机型」。
 *
 * ----------------------------------------------------------------------------
 *  【返回码】
 * ----------------------------------------------------------------------------
 *      code 0   拿到 token（40 位左右，形如 6aexxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx）
 *      code -10004  上一枚令牌字段（DEVICE_MSG[7]）不被接受
 *      code -10005  设备字段不自洽（机型/品牌/fingerprint/UA 对不上）
 *      code 其它    上游限流或 SDK 版本过期
 *
 *  token 有效性与「设备是否被信任」是两件事：签发出来的指纹本身有效，但首次
 *  拿它去签到可能被 8040012 要求过滑块——那是风控的入网动作，不是本模块的问题。
 * ============================================================================
 */

'use strict';

const crypto = require('crypto');
const zlib = require('zlib');
const https = require('https');

// ============================================================================
// 一、常量（全部来自 libDXRiskComm-situation_v7_6_4_oaid_a327f13d.so）
// ============================================================================

const APPKEY = '6341e15e0d8bdb6b3d20a51fb2b7c171';
const APP = 'com.longfor.supera';
const VER = 'situation_v7_6_4_oaid_a327f13d';
/** XXTEA 密钥 = keymgr 40 位 hex 串的前 16 字符 */
const XKEY = 'ea8a55a43621eacd';
const ENDPOINT = 'https://ly-sta.longhu.net/udid/m1';

const M32 = 0xFFFFFFFF;
const DELTA = 0x9E3779B9;

// ============================================================================
// 二、设备字段表（164 项，脱敏值，与 python 版逐项一致）
// ============================================================================

const MAP_ITEMS = [
    ["K0000", "32768"],
    ["K1", "[]"],
    ["K100", "Dalvik/2.1.0 (Linux; U; Android 14; panther Build/UQ1A.240205.002)"],
    ["K1046", "Android"],
    ["K1060", "16"],
    ["K1061", "2026-06-01"],
    ["K1062", "google/panther/panther:14/UQ1A.240205.002/11224170:user/release-keys"],
    ["K1063", "pangu-build-component-system-647115-ltbdv-ll7d6-v7v6m"],
    ["K1064", "1779973142"],
    ["K1065", "BP2A.250605.031.A3"],
    ["K1066", "BP2A.250605.031.A3"],
    ["K1067", "release-keys"],
    ["K1068", "builder"],
    ["K1069", "missi-user 16 BP2A.250605.031.A3 16OS3.1.260528.205044822.QCPECN.S release-keys"],
    ["K1072", "1779973142"],
    ["K1073", "user"],
    ["K1074", "36"],
    ["K1077", "Thu May 28 20:59:02 CST 2026"],
    ["K1078", "nosdcard"],
    ["K1083", "REL"],
    ["K1084", "Android 14"],
    ["K1085", "0"],
    ["K1086", "36"],
    ["K11", "16"],
    ["K111", "1440x3200"],
    ["K1110", "panther"],
    ["K1111", "Pixel 7"],
    ["K1112", "google"],
    ["K1113", "panther"],
    ["K1114", "arm64-v8a"],
    ["K1116", "arm64-v8a"],
    ["K1117", "google"],
    ["K1118", "sun"],
    ["K112", "1440 x 3200"],
    ["K1130", "qcom"],
    ["K1135", "unknown"],
    ["K1136", "sun"],
    ["K1138", "196610"],
    ["K114", "3"],
    ["K1142", "android-google"],
    ["K1143", "1"],
    ["K1145", "I2C"],
    ["K115", "true"],
    ["K1193", "LOADED,LOADED"],
    ["K1197", "1,1"],
    ["K1199", "NR_SA,NR_SA"],
    ["K12", "2026-06-01"],
    ["K1201", "false,false"],
    ["K1203", "46011,46000"],
    ["K1220", "NV,RUIM"],
    ["K1272", "Asia/Shanghai"],
    ["K13", "google/panther/panther:14/UQ1A.240205.002/11224170:user/release-keys"],
    ["K1310", "running"],
    ["K1314", "0"],
    ["K1315", "unknown"],
    ["K138", "MPSS.DE.7.0-CN-3f86abc7ae,MPSS.DE.7.0-CN-3f86abc7ae"],
    ["K14", "qcom"],
    ["K15", "pangu-build-component-system-647115-ltbdv-ll7d6-v7v6m"],
    ["K16", "1779973142000"],
    ["K17", "panther"],
    ["K18", "Pixel 7"],
    ["K19", "google"],
    ["K2", "google"],
    ["K20", "panther"],
    ["K200", "1794150005956"],
    ["K201", "1794043797795"],
    ["K203", "106208161"],
    ["K204", "8"],
    ["K21", "arm64-v8a"],
    ["K21-1", "arm64-v8a"],
    ["K22", "BP2A.250605.031.A3"],
    ["K23", "BP2A.250605.031.A3"],
    ["K24", "google"],
    ["K2400", "u10318"],
    ["K2402", "false"],
    ["K25", "sun"],
    ["K251", "5"],
    ["K252", "1"],
    ["K26", "unknown"],
    ["K27", "MPSS.DE.7.0-CN-3f86abc7ae,MPSS.DE.7.0-CN-3f86abc7ae"],
    ["K28", "release-keys"],
    ["K281", "Snapdragon\n"],
    ["K29", "builder"],
    ["K290", "f1da0e45-0f65-4503-a904-febdc6eb07c7\n"],
    ["K291", "99eec5bf-dd65-48b5-a658-70b80c9e08de\n"],
    ["K292", "6.6.77-android15-8-gca30f3b4bef6-abogki440974771-4k"],
    ["K293", "#1 SMP PREEMPT Mon Sep  1 06:06:55 UTC 2025"],
    ["K3", "龙湖"],
    ["K30", "8"],
    ["K300", "161"],
    ["K301", "qcom"],
    ["K302", "missi-user"],
    ["K303", "Pixel 7"],
    ["K304", "google"],
    ["K305", "sun"],
    ["K306", "sun"],
    ["K307", "MPSS.DE.7.0-CN-3f86abc7ae,MPSS.DE.7.0-CN-3f86abc7ae"],
    ["K308", "4:memory:/mimd/uid_10318\n3:cpuset:/top-app\n2:cpu:/top-app\n1:blkio:/\n0::/apps/uid_10318/pid_640\n"],
    ["K309", "-1"],
    ["K31", "fp asimd evtstrm aes pmull sha1 sha2 crc32 atomics fphp asimdhp cpuid asimdrdm jscvt fcma lrcpc dcpop sha3 sm3 sm4 asimddp sha512 asimdfhm dit uscat ilrcpc flagm ssbs sb paca pacg dcpodp flagm2 frint i8mm bf16 rng bti ecv afp rpres\n"],
    ["K310", "true"],
    ["K311", "true"],
    ["K312", "true"],
    ["K313", "true"],
    ["K320", "true"],
    ["K327", "true"],
    ["K327-s", "baidu_1"],
    ["K329", "false"],
    ["K331", "google"],
    ["K332", "[{capabilities=33, packageNames=null, flags=82, description=🌈🌈🌈️\n--------------\n我的作用：旨在帮助用户跳过那些被工信部提名的，影响用户体验的开屏广告和弹窗。\n--------------\n用户须知：李跳跳是一个不联网的单机应用凑字数，不会也没办法泄露你的任何隐私。\n--------------\n\n\n🐟🐠🐟, Id=hello.litiaotiao.app/.LttService, eventTypes=4194305}]"],
    ["K333", "[{\"deviceSources\":769,\"isExternal\":false,\"keyboardType\":2,\"isEnabled\":true,\"isVirtual\":true,\"deviceName\":\"Virtual\"},{\"deviceSources\":257,\"isExternal\":false,\"keyboardType\":1,\"isEnabled\":true,\"isVirtual\":false,\"deviceName\":\"gpio-keys\"},{\"deviceSources\":1281,\"isExternal\":false,\"keyboardType\":1,\"isEnabled\":true,\"isVirtual\":false,\"deviceName\":\"uinput-google\"},{\"deviceSources\":257,\"isExternal\":false,\"keyboardType\":1,\"isEnabled\":true,\"isVirtual\":false,\"deviceName\":\"pmic_pwrkey\"},{\"deviceSources\":257,\"isExternal\":false,\"keyboardType\":1,\"isEnabled\":true,\"isVirtual\":false,\"deviceName\":\"pmic_resin\"},{\"deviceSources\":257,\"isExternal\":false,\"keyboardType\":1,\"isEnabled\":true,\"isVirtual\":false,\"deviceName\":\"pmic_pwrkey_bark\"},{\"deviceSources\":257,\"isExternal\":false,\"keyboardType\":1,\"isEnabled\":true,\"isVirtual\":false,\"deviceName\":\"pmic_pwrkey_resin_bark\"},{\"deviceSources\":4355,\"isExternal\":false,\"keyboardType\":1,\"isEnabled\":true,\"isVirtual\":false,\"deviceName\":\"google_Touch_Input_0\"},{\"deviceSources\":-2147483391,\"isExternal\":false,\"keyboardType\":1,\"isEnabled\":true,\"isVirtual\":false,\"deviceName\":\"sun-mtp-snd-card Headset Jack\"}]"],
    ["K34", "3532800\n"],
    ["K35", "384000\n"],
    ["K39", "1996800\n"],
    ["K4", "1.30.2"],
    ["K40", "54200\n"],
    ["K41", "0-7\n"],
    ["K451", "__TS__"],
    ["K452", "__TS__"],
    ["K46", "Wi-Fi"],
    ["K47", "Wi-Fi"],
    ["K500", "cn"],
    ["K501", "46011"],
    ["K502", "中国电信"],
    ["K503", "cn"],
    ["K504", "46002"],
    ["K505", "中国电信"],
    ["K58", "a6119290-0000-4000-8000-00160c5f6505"],
    ["K6", "google"],
    ["K60", "141000367"],
    ["K61", "3.2"],
    ["K65", "11662073856-240924995584"],
    ["K66", "11662073856,20119552"],
    ["K666", "91875735"],
    ["K667", "龙湖"],
    ["K67", "67167473664,240924995584"],
    ["K69", "[{\"dev\": \"/dev/block/dm-9\", \"free\": \"0K\", \"fs\": \"/\", \"size\": \"853M\", \"type\": \"erofs\", \"used\": \"853M\"}, {\"dev\": \"/dev/block/dm-10\", \"free\": \"0K\", \"fs\": \"/system_ext\", \"size\": \"664M\", \"type\": \"erofs\", \"used\": \"664M\"}, {\"dev\": \"/dev/block/dm-11\", \"free\": \"0K\", \"fs\": \"/product\", \"size\": \"3G\", \"type\": \"erofs\", \"used\": \"3G\"}, {\"dev\": \"/dev/block/dm-13\", \"free\": \"0K\", \"fs\": \"/vendor\", \"size\": \"743M\", \"type\": \"erofs\", \"used\": \"743M\"}, {\"dev\": \"/dev/block/dm-55\", \"free\": \"62G\", \"fs\": \"/data\", \"size\": \"224G\", \"type\": \"f2fs\", \"used\": \"161G\"}]"],
    ["K7", "470ac8003684594a0702f762bdd25d29"],
    ["K8", "situation_v7_6_4_oaid_a327f13d"],
    ["K800", "15"],
    ["K801", "2"],
    ["K802", "11"],
    ["K803", "15"],
    ["K804", "20"],
    ["K805", "15"],
    ["K850", "321028183"],
    ["K851", "1793774040782"],
    ["K852", "1793774040782"],
    ["K853", "821575236"],
    ["K854", "0"],
    ["K855", "google"],
    ["K90", "3"],
    ["K902", "arm64-v8a"],
    ["K903", "user"],
    ["K904", "MPSS.DE.7.0-CN-3f86abc7ae,MPSS.DE.7.0-CN-3f86abc7ae"],
    ["K906", "36"],
    ["K907", "REL"],
    ["K908", "Android 14"],
    ["K91", "2"],
    ["K92", "true"],
    ["K93", "27"],
    ["K94", "100"],
    ["K95", "0"],
    ["K96", "3685"],
    ["K97", "358"],
    ["K98", "Li-poly"],
    ["user_K443", "5cd6e7a161e146bd"],
    ["user_K443-reas", "oaid_debug: init=ok; detail=initOAIDSDKCert: ok; certPath=com.longfor.supera.cert.pem"],
    ["user_K444", "3f970c12be062f69"],
    ["user_K445", "037b0d6a-0000-4000-8000-00817a57cad2"],
    ["user_K446", "true"],
];

// 机型预设覆盖表用到的字段分组
const BRAND_KEYS = ['K2', 'K6', 'K19', 'K24', 'K331', 'K855', 'K1112', 'K1117', 'K304'];
const MODEL_KEYS = ['K18', 'K1111', 'K303'];
const DEVICE_KEYS = ['K17', 'K20', 'K1110', 'K1113'];
const FP_KEYS = ['K13', 'K1062'];

function profileFields(brand, model, device, build, incremental, brandTag) {
    const f = {};
    for (const k of BRAND_KEYS) f[k] = brand;
    for (const k of MODEL_KEYS) f[k] = model;
    for (const k of DEVICE_KEYS) f[k] = device;
    const fp = brand + '/' + device + '/' + device + ':14/' + build + '/' + incremental + ':user/release-keys';
    for (const k of FP_KEYS) f[k] = fp;
    f.K100 = 'Dalvik/2.1.0 (Linux; U; Android 14; ' + device + ' Build/' + build + ')';
    f.K1142 = 'android-' + brandTag;
    return f;
}

const DEVICE_PROFILES = {
    pixel7: { name: 'Google Pixel 7', brand: 'google', model: 'Pixel 7', fields: {} },
    xiaomi14: {
        name: 'Xiaomi 14',
        brand: 'Xiaomi',
        model: 'Xiaomi 14',
        fields: profileFields('Xiaomi', 'Xiaomi 14', 'houji', 'UKQ1.230804.001', 'V816.0.1.0.UNCCNXM', 'xiaomi'),
    },
    oneplus12: {
        name: 'OnePlus 12',
        brand: 'OnePlus',
        model: 'OnePlus 12',
        fields: profileFields('OnePlus', 'OnePlus 12', 'waffle', 'UKQ1.230716.001', '2412291200', 'oneplus'),
    },
    vivo_x100: {
        name: 'vivo X100',
        brand: 'vivo',
        model: 'vivo X100',
        fields: profileFields('vivo', 'vivo X100', 'V2309A', 'UP1A.231005.007', 'compiler07022220', 'vivo'),
    },
    samsung_s24: {
        name: 'Samsung Galaxy S24',
        brand: 'samsung',
        model: 'SM-S9210',
        fields: profileFields('samsung', 'SM-S9210', 'e1q', 'UP1A.231005.007', 'S9210XXU1AWM9', 'samsung'),
    },
};

const DEFAULT_PROFILE = 'pixel7';
const PROFILE_KEYS = Object.keys(DEVICE_PROFILES);

// 设备消息：1=SDK 版本串 2=顶象版本 3=App 版本号(整数) 4=appKey 5=常量
// 6=常量 7=上一枚令牌 8=常量 9=包名 10=常量
// [字段号, 值, 是否 varint]
const DEVICE_MSG = [
    [1, VER, false],
    [2, '1.30.2', false],
    [3, 321028183, true],
    [4, APPKEY, false],
    [5, 0, true],
    [6, '36', false],
    [7, '6aec8780Zq4dNGOFcPVdCh4moOzSwyE9LZVGC9m3', false], // 协议要求携带上一枚令牌，清空会被判 -10004
    [8, 1, true],
    [9, APP, false],
    [10, 3, true],
];

// ============================================================================
// 三、protobuf wire 编解码
// ============================================================================

function varint(n) {
    const out = [];
    let v = n;
    if (v < 0) v += Math.pow(2, 63);
    while (true) {
        const b = v % 128;
        v = Math.floor(v / 128);
        if (v) out.push(b | 0x80);
        else {
            out.push(b);
            return Buffer.from(out);
        }
    }
}

/** 读 varint：返回 [值, 新下标] */
function readVarint(buf, i) {
    let r = 0;
    let sh = 0;
    while (true) {
        const x = buf[i++];
        r += (x & 0x7f) * Math.pow(2, sh);
        if (!(x & 0x80)) return [r, i];
        sh += 7;
    }
}

const pbStr = (field, value) => {
    const body = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
    return Buffer.concat([varint(field * 8 + 2), varint(body.length), body]);
};

const pbVi = (field, value) => Buffer.concat([varint(field * 8), varint(value)]);

function pbFields(buf) {
    const out = [];
    let i = 0;
    while (i < buf.length) {
        let t;
        [t, i] = readVarint(buf, i);
        const field = Math.floor(t / 8);
        const wt = t & 7;
        let v;
        if (wt === 0) {
            [v, i] = readVarint(buf, i);
            out.push([field, 0, v]);
        } else if (wt === 2) {
            let len;
            [len, i] = readVarint(buf, i);
            out.push([field, 2, buf.slice(i, i + len)]);
            i += len;
        } else if (wt === 5) {
            out.push([field, 5, buf.slice(i, i + 4)]);
            i += 4;
        } else if (wt === 1) {
            out.push([field, 1, buf.slice(i, i + 8)]);
            i += 8;
        } else {
            throw new Error('protobuf wiretype 异常: ' + wt);
        }
    }
    return out;
}

// ============================================================================
// 四、XXTEA（SDK 变体：末尾追加明文长度字）
// ============================================================================

function keyWords(key) {
    const b = Buffer.alloc(16);
    Buffer.from(key, 'utf8').copy(b, 0, 0, 16);
    return [b.readUInt32LE(0), b.readUInt32LE(4), b.readUInt32LE(8), b.readUInt32LE(12)];
}

function encWords(v, k) {
    const n = v.length - 1;
    if (n < 1) return v;
    let rounds = 6 + Math.floor(52 / (n + 1));
    let s = 0;
    let z = v[n];
    while (rounds--) {
        s = (s + DELTA) >>> 0;
        const e = (s >>> 2) & 3;
        for (let p = 0; p < n; p++) {
            const y = v[p + 1];
            let mx = ((((z >>> 5) ^ ((y << 2) >>> 0)) >>> 0) + (((y >>> 3) ^ ((z << 4) >>> 0)) >>> 0)) >>> 0;
            mx = (mx ^ ((((s ^ y) >>> 0) + ((k[(p & 3) ^ e] ^ z) >>> 0)) >>> 0)) >>> 0;
            v[p] = (v[p] + mx) >>> 0;
            z = v[p];
        }
        const y2 = v[0];
        let mx2 = ((((z >>> 5) ^ ((y2 << 2) >>> 0)) >>> 0) + (((y2 >>> 3) ^ ((z << 4) >>> 0)) >>> 0)) >>> 0;
        mx2 = (mx2 ^ ((((s ^ y2) >>> 0) + ((k[(n & 3) ^ e] ^ z) >>> 0)) >>> 0)) >>> 0;
        v[n] = (v[n] + mx2) >>> 0;
        z = v[n];
    }
    return v;
}

function decWords(v, k) {
    const n = v.length - 1;
    if (n < 1) return v;
    const rounds = 6 + Math.floor(52 / (n + 1));
    let s = (rounds * DELTA) >>> 0;
    let y = v[0];
    while (s) {
        const e = (s >>> 2) & 3;
        for (let p = n; p > 0; p--) {
            const z = v[p - 1];
            let mx = ((((z >>> 5) ^ ((y << 2) >>> 0)) >>> 0) + (((y >>> 3) ^ ((z << 4) >>> 0)) >>> 0)) >>> 0;
            mx = (mx ^ ((((s ^ y) >>> 0) + ((k[(p & 3) ^ e] ^ z) >>> 0)) >>> 0)) >>> 0;
            v[p] = (v[p] - mx) >>> 0;
            y = v[p];
        }
        const z2 = v[n];
        let mx2 = ((((z2 >>> 5) ^ ((y << 2) >>> 0)) >>> 0) + (((y >>> 3) ^ ((z2 << 4) >>> 0)) >>> 0)) >>> 0;
        mx2 = (mx2 ^ ((((s ^ y) >>> 0) + ((k[e] ^ z2) >>> 0)) >>> 0)) >>> 0;
        v[0] = (v[0] - mx2) >>> 0;
        y = v[0];
        s = (s - DELTA) >>> 0;
    }
    return v;
}

function wordsFromBuf(buf) {
    const out = [];
    for (let i = 0; i < buf.length; i += 4) out.push(buf.readUInt32LE(i));
    return out;
}

function bufFromWords(words) {
    const b = Buffer.alloc(words.length * 4);
    for (let i = 0; i < words.length; i++) b.writeUInt32LE(words[i], i * 4);
    return b;
}

/** 加密：4 字节对齐补零 + 末尾一个长度字 */
function xxteaEnc(data, key = XKEY) {
    const pad = (4 - (data.length % 4)) % 4;
    const v = wordsFromBuf(Buffer.concat([data, Buffer.alloc(pad)]));
    v.push(data.length);
    encWords(v, keyWords(key));
    return bufFromWords(v);
}

/** 解密：返回 [明文 Buffer, 明文长度] */
function xxteaDec(ct, key = XKEY) {
    const v = wordsFromBuf(ct);
    decWords(v, keyWords(key));
    return [bufFromWords(v), v[v.length - 1]];
}

// ============================================================================
// 五、最小 ZIP 读写（只服务这一个接口）
// ============================================================================

let CRC_TABLE = null;
function crc32(buf) {
    if (!CRC_TABLE) {
        CRC_TABLE = new Int32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            CRC_TABLE[n] = c;
        }
    }
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}

/** 打一个单文件 zip（deflate），结构与 python zipfile.ZIP_DEFLATED 等价 */
function zipOne(name, data) {
    const nameBuf = Buffer.from(name, 'utf8');
    const comp = zlib.deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // 解压所需版本
    local.writeUInt16LE(0, 6); // 无 flag（尺寸直接写头里，服务端 ZipInputStream 读得动）
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10); // 时间
    local.writeUInt16LE(0x21, 12); // 日期（1980-01-01，固定值）
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(0, 30); // extra+comment len 都在 32/34，这里 0
    central.writeUInt32LE(0, 38); // 外部属性
    central.writeUInt32LE(0, 42); // local header 偏移

    const cdBuf = Buffer.concat([central, nameBuf]);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(cdBuf.length, 12);
    eocd.writeUInt32LE(30 + nameBuf.length + comp.length, 16);

    return Buffer.concat([local, nameBuf, comp, cdBuf, eocd]);
}

/** 解一个单文件 zip：走中央目录拿尺寸，不依赖 flag bit3 的 data descriptor */
function unzipOne(payload) {
    let eocd = -1;
    for (let i = payload.length - 22; i >= Math.max(0, payload.length - 65557); i--) {
        if (payload.readUInt32LE(i) === 0x06054b50) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0) throw new Error('zip 响应里找不到中央目录');
    const cdOff = payload.readUInt32LE(eocd + 16);
    if (payload.readUInt32LE(cdOff) !== 0x02014b50) throw new Error('zip 中央目录损坏');
    const method = payload.readUInt16LE(cdOff + 10);
    const compSize = payload.readUInt32LE(cdOff + 20);
    const nameLen = payload.readUInt16LE(cdOff + 28);
    const extraLen = payload.readUInt16LE(cdOff + 30);
    const commentLen = payload.readUInt16LE(cdOff + 32);
    const lho = payload.readUInt32LE(cdOff + 42);
    const lNameLen = payload.readUInt16LE(lho + 26);
    const lExtraLen = payload.readUInt16LE(lho + 28);
    const start = lho + 30 + lNameLen + lExtraLen;
    const body = payload.slice(start, start + compSize);
    void nameLen;
    void extraLen;
    void commentLen;
    return method === 8 ? zlib.inflateRawSync(body) : body;
}

// ============================================================================
// 六、按 salt 派生设备标识（一账号一份指纹的根）
// ============================================================================

function makeStream(saltText) {
    const seed = crypto.createHash('sha256').update('dx-device:' + String(saltText), 'utf8').digest();
    let buf = Buffer.alloc(0);
    let n = 0;
    const take = (len) => {
        while (buf.length < len) {
            const counter = Buffer.from([n & 0xff]);
            buf = Buffer.concat([buf, crypto.createHash('sha256').update(Buffer.concat([seed, counter])).digest()]);
            n++;
        }
        const out = buf.slice(0, len);
        buf = buf.slice(len);
        return out;
    };
    return {
        hexstr: (len) => take(Math.ceil(len / 2)).toString('hex').slice(0, len),
        uuid: () => {
            const b = Buffer.from(take(16));
            b[6] = (b[6] & 0x0f) | 0x40;
            b[8] = (b[8] & 0x3f) | 0x80;
            const h = b.toString('hex');
            return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
        },
    };
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const HEX_RE = /^[0-9a-fA-F]{8,}$/;

/** 只重写设备标识类字段（UUID / ≥8 位 HEX），数字和结构性字段原样保留 */
function deriveValue(value, stream) {
    if (!stream || !value) return value;
    if (UUID_RE.test(value)) return stream.uuid();
    if (/^[0-9]+$/.test(value)) return value;
    if (HEX_RE.test(value)) return stream.hexstr(value.length);
    return value;
}

// ============================================================================
// 七、拼 seed / 发请求
// ============================================================================

function buildSeed(salt, overrides, ts) {
    const now = ts || Date.now();
    const stream = salt ? makeStream(salt) : null;
    const chunks = [];
    for (const [key, raw] of MAP_ITEMS) {
        let text = key === 'K451' || key === 'K452' ? String(now) : deriveValue(raw, stream);
        if (overrides && Object.prototype.hasOwnProperty.call(overrides, key)) text = overrides[key];
        chunks.push(pbStr(1, Buffer.concat([pbStr(1, key), pbStr(2, String(text))])));
    }
    const devChunks = DEVICE_MSG.map(([f, v, isVarint]) => (isVarint ? pbVi(f, v) : pbStr(f, v)));
    return Buffer.concat([
        pbStr(1, Buffer.concat(devChunks)),
        pbVi(2, 1002),
        pbStr(3, Buffer.concat(chunks)),
    ]);
}

function httpPostBinary(url, body, timeout = 20000) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request(
            {
                hostname: u.hostname,
                path: u.pathname + u.search,
                method: 'POST',
                timeout,
                headers: {
                    accept: '*/*',
                    connection: 'keep-alive',
                    'User-Agent': 'Risk-' + VER,
                    'Content-type': 'application/octet-stream',
                    'Content-Length': body.length,
                    'Accept-Encoding': 'gzip',
                },
            },
            (res) => {
                const cs = [];
                res.on('data', (c) => cs.push(c));
                res.on('end', () => {
                    let buf = Buffer.concat(cs);
                    if (String(res.headers['content-encoding'] || '').includes('gzip')) {
                        try {
                            buf = zlib.gunzipSync(buf);
                        } catch (e) {
                            /* 原样 */
                        }
                    }
                    resolve({ status: res.statusCode, buf });
                });
            }
        );
        req.on('timeout', () => req.destroy(new Error('指纹服务请求超时')));
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

/**
 * 签发一枚设备指纹。
 * @param {object} opt
 * @param {string} opt.salt    派生盐（一般传账号 token，决定「哪台设备」）
 * @param {string} [opt.profile] 机型预设，默认 pixel7
 * @returns {Promise<{ok:boolean, token?:string, code?:number, msg?:string, ms?:number, profile?:string}>}
 */
async function issueDxToken(opt) {
    const o = opt || {};
    const key = String(o.profile || DEFAULT_PROFILE).trim().toLowerCase();
    const preset = DEVICE_PROFILES[key] || DEVICE_PROFILES[DEFAULT_PROFILE];
    const seed = buildSeed(o.salt || '', preset.fields, o.ts);
    const sign = crypto
        .createHash('md5')
        .update(Buffer.concat([Buffer.from(APPKEY, 'utf8'), seed, Buffer.from(APPKEY, 'utf8')]))
        .digest('hex');
    const url = ENDPOINT + '?sign=' + sign + '&appKey=' + APPKEY + '&app=' + encodeURIComponent(APP) + '&version=' + VER;
    const t0 = Date.now();

    let res;
    try {
        res = await httpPostBinary(url, xxteaEnc(zipOne('data', seed)));
    } catch (e) {
        return { ok: false, msg: '网络异常：' + (e && e.message ? e.message : e) };
    }

    let fields;
    try {
        const [plain, len] = xxteaDec(res.buf);
        fields = pbFields(unzipOne(plain.slice(0, len)));
    } catch (e) {
        return {
            ok: false,
            msg: '响应解析失败（HTTP ' + res.status + '，' + res.buf.length + ' 字节）：' + (e && e.message ? e.message : e),
        };
    }

    let code = fields.find((f) => f[0] === 3);
    code = code ? code[2] : null;
    if (code !== null && code >= Math.pow(2, 63)) code -= Math.pow(2, 64);
    const payload = fields.find((f) => f[0] === 2);
    let token = null;
    if (payload && payload[2] && payload[2].length) {
        const inner = pbFields(payload[2]).find((f) => f[0] === 1);
        token = inner ? inner[2].toString('utf8') : null;
    }
    return {
        ok: !!token,
        token: token || '',
        code,
        msg: token ? '' : 'code=' + code,
        ms: Date.now() - t0,
        profile: key in DEVICE_PROFILES ? key : DEFAULT_PROFILE,
    };
}

module.exports = {
    issueDxToken,
    PROFILE_KEYS,
    DEVICE_PROFILES,
    DEFAULT_PROFILE,
    // 导出给自检脚本用
    _internals: { buildSeed, xxteaEnc, xxteaDec, zipOne, unzipOne, pbStr, pbVi, pbFields, crc32 },
};
