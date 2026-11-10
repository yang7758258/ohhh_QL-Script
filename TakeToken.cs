using System;
using System.Collections.Generic;
using System.Text;
using System.Security.Cryptography;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.Reflection;

namespace LonghuTakeToken
{
    // ========================================================================
    //  龙湖天街 · 取 Token（手机号 + 短信验证码）
    //  -----------------------------------------------------------------------
    //  这一份是单文件 C#（WinForms），用 Windows 自带的 .NET Framework 编译成 exe，
    //  双击即用，不需要装 Node / Python / 浏览器。
    //
    //  它做四件事：
    //    ① 按手机号签一份顶象设备指纹（/udid/m1，protobuf + XXTEA + zip + md5）
    //    ② 调 App 短信登录接口发码、验码，换到 32 位龙湖 token
    //    ③ 校验 token（user-info）并立刻做一次续期（token2key -> key2token）
    //    ④ 把 token 合并写入青龙面板的环境变量 longhu_token（去重、不覆盖别人的行）
    //
    //  实测要点（2026-11-09）：
    //    - 用自签指纹发码，服务端直接回 code=200，**不弹滑块**（参考项目的 909001
    //      是特定风控状态下才会出现）；万一真被要求过滑块，程序会拉起本机浏览器
    //      打开内置的滑块页（跑的是龙湖自己的 dx-captcha SDK），拖一次即可继续。
    //    - 签名密钥 App 端与小程序端不同，这里必须用 SIGN_SECRET_APP。
    //    - 同一手机号不要连续狂点发码（服务端有频控），间隔 60 秒以上。
    // ========================================================================

    internal static class Consts
    {
        public const string Host = "gw2c-hw-open.longfor.com";
        public const string Base = "https://gw2c-hw-open.longfor.com";

        // 客户端签名密钥：App 短信登录用这一套（小程序那套是 Q74eKtH5…，别混用）
        public const string SignSecretApp = "20jtGtg5TQ9V1A3Q4RsxBzJqb@^WUS%m";

        public const string ApiKeyLogin = "98717e7a-a039-46af-8143-be7558a089c0"; // 会员/登录
        public const string ApiKeyWallet = "f4a2290e-c382-45b7-949c-3253d07e9b5b"; // key2token

        public const string ApiVersion = "v1_30_2";
        public const string AppVersion = "1.30.2";
        public const string BuCode = "L00602";
        public const string Channel = "L0";
        public const string UaApp = "com.longfor.supera/1.30.2 iOS/26.6";
        public const string BundleId = "com.longfor.supera";

        public const string SendSmsPath = "/supera/mine/v1_30_2/publicApi/login/sendSmsCodeSecret";
        public const string LoginPath = "/supera/mine/v1_30_2/publicApi/login/smsCodeSecret";

        public const string MemberApiVersion = "v2_6_0";
        public const string UserInfoPath = "/supera/member/api/bff/pages/v2_6_0/v1/user-info";
        public const string Token2KeyPath = "/supera/mine/v2_6_0/token/token2key";
        public const string Key2TokenPath = "/lmember-lpns-api-prod/api/lpns/auth/v1/key2token";

        // 顶象指纹
        public const string DxAppKey = "6341e15e0d8bdb6b3d20a51fb2b7c171";
        public const string DxApp = "com.longfor.supera";
        public const string DxVer = "situation_v7_6_4_oaid_a327f13d";
        public const string DxXteaKey = "ea8a55a43621eacd";
        public const string DxEndpoint = "https://ly-sta.longhu.net/udid/m1";

        // 滑块（仅在服务端要求人机验证时才用得上）
        public const string CaptchaAppId = "d1a43734fc59aeae9f1562dbd70fdf54";
        public const string CaptchaApi = "https://ly-ver.longhu.net";
        public const string CaptchaSdk = "https://ly-sta.longhu.net/dx-captcha/index.js";

        // 青龙默认（可在界面上改）
        // 不内置任何人的青龙地址与账号 —— 首次运行由「设置」界面填写，存本机
        public const string QlUrlDefault = "";
        public const string QlUserDefault = "";
        public const string QlPassDefault = "";
        public const string QlEnvName = "longhu_token";
    }

    // ========================================================================
    //  一、设备字段表（171 项，与 Node 版 longhu_dxrisk.js 逐项一致）
    // ========================================================================
    internal static class DeviceTable
    {
        public static readonly string[][] MapItems = new string[][]
        {
            new string[] { "K0000", "32768" },
            new string[] { "K1", "[]" },
            new string[] { "K100", "Dalvik/2.1.0 (Linux; U; Android 14; panther Build/UQ1A.240205.002)" },
            new string[] { "K1046", "Android" },
            new string[] { "K1060", "16" },
            new string[] { "K1061", "2026-06-01" },
            new string[] { "K1062", "google/panther/panther:14/UQ1A.240205.002/11224170:user/release-keys" },
            new string[] { "K1063", "pangu-build-component-system-647115-ltbdv-ll7d6-v7v6m" },
            new string[] { "K1064", "1779973142" },
            new string[] { "K1065", "BP2A.250605.031.A3" },
            new string[] { "K1066", "BP2A.250605.031.A3" },
            new string[] { "K1067", "release-keys" },
            new string[] { "K1068", "builder" },
            new string[] { "K1069", "missi-user 16 BP2A.250605.031.A3 16OS3.1.260528.205044822.QCPECN.S release-keys" },
            new string[] { "K1072", "1779973142" },
            new string[] { "K1073", "user" },
            new string[] { "K1074", "36" },
            new string[] { "K1077", "Thu May 28 20:59:02 CST 2026" },
            new string[] { "K1078", "nosdcard" },
            new string[] { "K1083", "REL" },
            new string[] { "K1084", "Android 14" },
            new string[] { "K1085", "0" },
            new string[] { "K1086", "36" },
            new string[] { "K11", "16" },
            new string[] { "K111", "1440x3200" },
            new string[] { "K1110", "panther" },
            new string[] { "K1111", "Pixel 7" },
            new string[] { "K1112", "google" },
            new string[] { "K1113", "panther" },
            new string[] { "K1114", "arm64-v8a" },
            new string[] { "K1116", "arm64-v8a" },
            new string[] { "K1117", "google" },
            new string[] { "K1118", "sun" },
            new string[] { "K112", "1440 x 3200" },
            new string[] { "K1130", "qcom" },
            new string[] { "K1135", "unknown" },
            new string[] { "K1136", "sun" },
            new string[] { "K1138", "196610" },
            new string[] { "K114", "3" },
            new string[] { "K1142", "android-google" },
            new string[] { "K1143", "1" },
            new string[] { "K1145", "I2C" },
            new string[] { "K115", "true" },
            new string[] { "K1193", "LOADED,LOADED" },
            new string[] { "K1197", "1,1" },
            new string[] { "K1199", "NR_SA,NR_SA" },
            new string[] { "K12", "2026-06-01" },
            new string[] { "K1201", "false,false" },
            new string[] { "K1203", "46011,46000" },
            new string[] { "K1220", "NV,RUIM" },
            new string[] { "K1272", "Asia/Shanghai" },
            new string[] { "K13", "google/panther/panther:14/UQ1A.240205.002/11224170:user/release-keys" },
            new string[] { "K1310", "running" },
            new string[] { "K1314", "0" },
            new string[] { "K1315", "unknown" },
            new string[] { "K138", "MPSS.DE.7.0-CN-3f86abc7ae,MPSS.DE.7.0-CN-3f86abc7ae" },
            new string[] { "K14", "qcom" },
            new string[] { "K15", "pangu-build-component-system-647115-ltbdv-ll7d6-v7v6m" },
            new string[] { "K16", "1779973142000" },
            new string[] { "K17", "panther" },
            new string[] { "K18", "Pixel 7" },
            new string[] { "K19", "google" },
            new string[] { "K2", "google" },
            new string[] { "K20", "panther" },
            new string[] { "K200", "1794150005956" },
            new string[] { "K201", "1794043797795" },
            new string[] { "K203", "106208161" },
            new string[] { "K204", "8" },
            new string[] { "K21", "arm64-v8a" },
            new string[] { "K21-1", "arm64-v8a" },
            new string[] { "K22", "BP2A.250605.031.A3" },
            new string[] { "K23", "BP2A.250605.031.A3" },
            new string[] { "K24", "google" },
            new string[] { "K2400", "u10318" },
            new string[] { "K2402", "false" },
            new string[] { "K25", "sun" },
            new string[] { "K251", "5" },
            new string[] { "K252", "1" },
            new string[] { "K26", "unknown" },
            new string[] { "K27", "MPSS.DE.7.0-CN-3f86abc7ae,MPSS.DE.7.0-CN-3f86abc7ae" },
            new string[] { "K28", "release-keys" },
            new string[] { "K281", "Snapdragon\n" },
            new string[] { "K29", "builder" },
            new string[] { "K290", "f1da0e45-0f65-4503-a904-febdc6eb07c7\n" },
            new string[] { "K291", "99eec5bf-dd65-48b5-a658-70b80c9e08de\n" },
            new string[] { "K292", "6.6.77-android15-8-gca30f3b4bef6-abogki440974771-4k" },
            new string[] { "K293", "#1 SMP PREEMPT Mon Sep  1 06:06:55 UTC 2025" },
            new string[] { "K3", "龙湖" },
            new string[] { "K30", "8" },
            new string[] { "K300", "161" },
            new string[] { "K301", "qcom" },
            new string[] { "K302", "missi-user" },
            new string[] { "K303", "Pixel 7" },
            new string[] { "K304", "google" },
            new string[] { "K305", "sun" },
            new string[] { "K306", "sun" },
            new string[] { "K307", "MPSS.DE.7.0-CN-3f86abc7ae,MPSS.DE.7.0-CN-3f86abc7ae" },
            new string[] { "K308", "4:memory:/mimd/uid_10318\n3:cpuset:/top-app\n2:cpu:/top-app\n1:blkio:/\n0::/apps/uid_10318/pid_640\n" },
            new string[] { "K309", "-1" },
            new string[] { "K31", "fp asimd evtstrm aes pmull sha1 sha2 crc32 atomics fphp asimdhp cpuid asimdrdm jscvt fcma lrcpc dcpop sha3 sm3 sm4 asimddp sha512 asimdfhm dit uscat ilrcpc flagm ssbs sb paca pacg dcpodp flagm2 frint i8mm bf16 rng bti ecv afp rpres\n" },
            new string[] { "K310", "true" },
            new string[] { "K311", "true" },
            new string[] { "K312", "true" },
            new string[] { "K313", "true" },
            new string[] { "K320", "true" },
            new string[] { "K327", "true" },
            new string[] { "K327-s", "baidu_1" },
            new string[] { "K329", "false" },
            new string[] { "K331", "google" },
            new string[] { "K332", "[{capabilities=33, packageNames=null, flags=82, description=🌈🌈🌈️\n--------------\n我的作用：旨在帮助用户跳过那些被工信部提名的，影响用户体验的开屏广告和弹窗。\n--------------\n用户须知：李跳跳是一个不联网的单机应用凑字数，不会也没办法泄露你的任何隐私。\n--------------\n\n\n🐟🐠🐟, Id=hello.litiaotiao.app/.LttService, eventTypes=4194305}]" },
            new string[] { "K333", "[{\"deviceSources\":769,\"isExternal\":false,\"keyboardType\":2,\"isEnabled\":true,\"isVirtual\":true,\"deviceName\":\"Virtual\"},{\"deviceSources\":257,\"isExternal\":false,\"keyboardType\":1,\"isEnabled\":true,\"isVirtual\":false,\"deviceName\":\"gpio-keys\"},{\"deviceSources\":1281,\"isExternal\":false,\"keyboardType\":1,\"isEnabled\":true,\"isVirtual\":false,\"deviceName\":\"uinput-google\"},{\"deviceSources\":257,\"isExternal\":false,\"keyboardType\":1,\"isEnabled\":true,\"isVirtual\":false,\"deviceName\":\"pmic_pwrkey\"},{\"deviceSources\":257,\"isExternal\":false,\"keyboardType\":1,\"isEnabled\":true,\"isVirtual\":false,\"deviceName\":\"pmic_resin\"},{\"deviceSources\":257,\"isExternal\":false,\"keyboardType\":1,\"isEnabled\":true,\"isVirtual\":false,\"deviceName\":\"pmic_pwrkey_bark\"},{\"deviceSources\":257,\"isExternal\":false,\"keyboardType\":1,\"isEnabled\":true,\"isVirtual\":false,\"deviceName\":\"pmic_pwrkey_resin_bark\"},{\"deviceSources\":4355,\"isExternal\":false,\"keyboardType\":1,\"isEnabled\":true,\"isVirtual\":false,\"deviceName\":\"google_Touch_Input_0\"},{\"deviceSources\":-2147483391,\"isExternal\":false,\"keyboardType\":1,\"isEnabled\":true,\"isVirtual\":false,\"deviceName\":\"sun-mtp-snd-card Headset Jack\"}]" },
            new string[] { "K34", "3532800\n" },
            new string[] { "K35", "384000\n" },
            new string[] { "K39", "1996800\n" },
            new string[] { "K4", "1.30.2" },
            new string[] { "K40", "54200\n" },
            new string[] { "K41", "0-7\n" },
            new string[] { "K451", "__TS__" },
            new string[] { "K452", "__TS__" },
            new string[] { "K46", "Wi-Fi" },
            new string[] { "K47", "Wi-Fi" },
            new string[] { "K500", "cn" },
            new string[] { "K501", "46011" },
            new string[] { "K502", "中国电信" },
            new string[] { "K503", "cn" },
            new string[] { "K504", "46002" },
            new string[] { "K505", "中国电信" },
            new string[] { "K58", "a6119290-0000-4000-8000-00160c5f6505" },
            new string[] { "K6", "google" },
            new string[] { "K60", "141000367" },
            new string[] { "K61", "3.2" },
            new string[] { "K65", "11662073856-240924995584" },
            new string[] { "K66", "11662073856,20119552" },
            new string[] { "K666", "91875735" },
            new string[] { "K667", "龙湖" },
            new string[] { "K67", "67167473664,240924995584" },
            new string[] { "K69", "[{\"dev\": \"/dev/block/dm-9\", \"free\": \"0K\", \"fs\": \"/\", \"size\": \"853M\", \"type\": \"erofs\", \"used\": \"853M\"}, {\"dev\": \"/dev/block/dm-10\", \"free\": \"0K\", \"fs\": \"/system_ext\", \"size\": \"664M\", \"type\": \"erofs\", \"used\": \"664M\"}, {\"dev\": \"/dev/block/dm-11\", \"free\": \"0K\", \"fs\": \"/product\", \"size\": \"3G\", \"type\": \"erofs\", \"used\": \"3G\"}, {\"dev\": \"/dev/block/dm-13\", \"free\": \"0K\", \"fs\": \"/vendor\", \"size\": \"743M\", \"type\": \"erofs\", \"used\": \"743M\"}, {\"dev\": \"/dev/block/dm-55\", \"free\": \"62G\", \"fs\": \"/data\", \"size\": \"224G\", \"type\": \"f2fs\", \"used\": \"161G\"}]" },
            new string[] { "K7", "470ac8003684594a0702f762bdd25d29" },
            new string[] { "K8", "situation_v7_6_4_oaid_a327f13d" },
            new string[] { "K800", "15" },
            new string[] { "K801", "2" },
            new string[] { "K802", "11" },
            new string[] { "K803", "15" },
            new string[] { "K804", "20" },
            new string[] { "K805", "15" },
            new string[] { "K850", "321028183" },
            new string[] { "K851", "1793774040782" },
            new string[] { "K852", "1793774040782" },
            new string[] { "K853", "821575236" },
            new string[] { "K854", "0" },
            new string[] { "K855", "google" },
            new string[] { "K90", "3" },
            new string[] { "K902", "arm64-v8a" },
            new string[] { "K903", "user" },
            new string[] { "K904", "MPSS.DE.7.0-CN-3f86abc7ae,MPSS.DE.7.0-CN-3f86abc7ae" },
            new string[] { "K906", "36" },
            new string[] { "K907", "REL" },
            new string[] { "K908", "Android 14" },
            new string[] { "K91", "2" },
            new string[] { "K92", "true" },
            new string[] { "K93", "27" },
            new string[] { "K94", "100" },
            new string[] { "K95", "0" },
            new string[] { "K96", "3685" },
            new string[] { "K97", "358" },
            new string[] { "K98", "Li-poly" },
            new string[] { "user_K443", "5cd6e7a161e146bd" },
            new string[] { "user_K443-reas", "oaid_debug: init=ok; detail=initOAIDSDKCert: ok; certPath=com.longfor.supera.cert.pem" },
            new string[] { "user_K444", "3f970c12be062f69" },
            new string[] { "user_K445", "037b0d6a-0000-4000-8000-00817a57cad2" },
            new string[] { "user_K446", "true" },
        };

        // 机型预设覆盖表用到的字段分组
        public static readonly string[] BrandKeys = { "K2", "K6", "K19", "K24", "K331", "K855", "K1112", "K1117", "K304" };
        public static readonly string[] ModelKeys = { "K18", "K1111", "K303" };
        public static readonly string[] DeviceKeys = { "K17", "K20", "K1110", "K1113" };
        public static readonly string[] FpKeys = { "K13", "K1062" };

        public static readonly string[] ProfileKeys = { "pixel7", "xiaomi14", "oneplus12", "vivo_x100", "samsung_s24" };

        public static Dictionary<string, string> ProfileFields(string key)
        {
            var f = new Dictionary<string, string>();
            string brand, model, device, build, incremental, tag;
            switch ((key ?? "pixel7").ToLowerInvariant())
            {
                case "xiaomi14": brand = "Xiaomi"; model = "Xiaomi 14"; device = "houji"; build = "UKQ1.230804.001"; incremental = "V816.0.1.0.UNCCNXM"; tag = "xiaomi"; break;
                case "oneplus12": brand = "OnePlus"; model = "OnePlus 12"; device = "waffle"; build = "UKQ1.230716.001"; incremental = "2412291200"; tag = "oneplus"; break;
                case "vivo_x100": brand = "vivo"; model = "vivo X100"; device = "V2309A"; build = "UP1A.231005.007"; incremental = "compiler07022220"; tag = "vivo"; break;
                case "samsung_s24": brand = "samsung"; model = "SM-S9210"; device = "e1q"; build = "UP1A.231005.007"; incremental = "S9210XXU1AWM9"; tag = "samsung"; break;
                default: return f; // pixel7 = 表内原始脱敏值，不做覆盖
            }
            foreach (var k in BrandKeys) f[k] = brand;
            foreach (var k in ModelKeys) f[k] = model;
            foreach (var k in DeviceKeys) f[k] = device;
            string fp = brand + "/" + device + "/" + device + ":14/" + build + "/" + incremental + ":user/release-keys";
            foreach (var k in FpKeys) f[k] = fp;
            f["K100"] = "Dalvik/2.1.0 (Linux; U; Android 14; " + device + " Build/" + build + ")";
            f["K1142"] = "android-" + tag;
            return f;
        }
    }

    // ========================================================================
    //  二、字节工具：protobuf varint / XXTEA / 最小 ZIP / 派生盐
    // ========================================================================
    internal static class Bytes
    {
        /// <summary>毫秒时间戳（不用 DateTimeOffset，兼容 .NET 4.0）</summary>
        public static long NowMs()
        {
            return (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
        }

        public static byte[] Varint(long n)
        {
            var outList = new List<byte>();
            ulong v = (ulong)n;
            while (true)
            {
                byte b = (byte)(v & 0x7F);
                v >>= 7;
                if (v != 0) outList.Add((byte)(b | 0x80));
                else { outList.Add(b); return outList.ToArray(); }
            }
        }

        public static byte[] Cat(params byte[][] parts)
        {
            int len = 0;
            foreach (var p in parts) if (p != null) len += p.Length;
            var buf = new byte[len];
            int off = 0;
            foreach (var p in parts)
            {
                if (p == null) continue;
                Buffer.BlockCopy(p, 0, buf, off, p.Length);
                off += p.Length;
            }
            return buf;
        }

        public static byte[] PbStr(int field, byte[] value)
        {
            return Cat(Varint(field * 8 + 2), Varint(value.Length), value);
        }

        public static byte[] PbStr(int field, string value)
        {
            return PbStr(field, Encoding.UTF8.GetBytes(value));
        }

        public static byte[] PbVi(int field, long value)
        {
            return Cat(Varint(field * 8), Varint(value));
        }

        /// <summary>读 varint：out 下标前移</summary>
        public static long ReadVarint(byte[] buf, ref int i)
        {
            long r = 0;
            int shift = 0;
            while (true)
            {
                byte x = buf[i++];
                r += (long)(x & 0x7F) << shift;
                if ((x & 0x80) == 0) return r;
                shift += 7;
            }
        }

        /// <summary>解析 protobuf：返回 (字段号, wiretype, 值对象)</summary>
        public static List<PbField> ParsePb(byte[] buf)
        {
            var outList = new List<PbField>();
            int i = 0;
            while (i < buf.Length)
            {
                long t = ReadVarint(buf, ref i);
                int field = (int)(t >> 3);
                int wt = (int)(t & 7);
                if (wt == 0)
                {
                    long v = ReadVarint(buf, ref i);
                    outList.Add(new PbField { Field = field, Wire = 0, Num = v });
                }
                else if (wt == 2)
                {
                    int len = (int)ReadVarint(buf, ref i);
                    var slice = new byte[len];
                    Buffer.BlockCopy(buf, i, slice, 0, len);
                    i += len;
                    outList.Add(new PbField { Field = field, Wire = 2, Bytes = slice });
                }
                else if (wt == 5) { i += 4; }
                else if (wt == 1) { i += 8; }
                else throw new Exception("protobuf wiretype 异常: " + wt);
            }
            return outList;
        }

        // ---------------- XXTEA（SDK 变体：末尾追加明文长度字） ----------------

        private const uint M32 = 0xFFFFFFFFu;
        private const uint Delta = 0x9E3779B9u;

        private static uint[] KeyWords(string key)
        {
            var kb = new byte[16];
            var src = Encoding.UTF8.GetBytes(key);
            Buffer.BlockCopy(src, 0, kb, 0, Math.Min(16, src.Length));
            return new uint[]
            {
                BitConverter.ToUInt32(kb, 0), BitConverter.ToUInt32(kb, 4),
                BitConverter.ToUInt32(kb, 8), BitConverter.ToUInt32(kb, 12),
            };
        }

        private static uint[] ToWords(byte[] buf)
        {
            var w = new uint[buf.Length / 4];
            for (int i = 0; i < w.Length; i++) w[i] = BitConverter.ToUInt32(buf, i * 4);
            return w;
        }

        private static byte[] FromWords(uint[] words)
        {
            var b = new byte[words.Length * 4];
            for (int i = 0; i < words.Length; i++)
            {
                var t = BitConverter.GetBytes(words[i]);
                Buffer.BlockCopy(t, 0, b, i * 4, 4);
            }
            return b;
        }

        private static void EncWords(uint[] v, uint[] k)
        {
            int n = v.Length - 1;
            if (n < 1) return;
            int rounds = 6 + 52 / (n + 1);
            uint s = 0, z = v[n];
            while (rounds-- > 0)
            {
                s += Delta;
                uint e = (s >> 2) & 3;
                int p;
                for (p = 0; p < n; p++)
                {
                    uint y = v[p + 1];
                    uint mx = ((((z >> 5) ^ (y << 2)) + ((y >> 3) ^ (z << 4))) ^ ((s ^ y) + (k[(p & 3) ^ e] ^ z)));
                    v[p] += mx;
                    z = v[p];
                }
                uint y2 = v[0];
                uint mx2 = ((((z >> 5) ^ (y2 << 2)) + ((y2 >> 3) ^ (z << 4))) ^ ((s ^ y2) + (k[(n & 3) ^ e] ^ z)));
                v[n] += mx2;
                z = v[n];
            }
        }

        private static void DecWords(uint[] v, uint[] k)
        {
            int n = v.Length - 1;
            if (n < 1) return;
            int rounds = 6 + 52 / (n + 1);
            uint s = (uint)(rounds * Delta);
            uint y = v[0];
            while (s != 0)
            {
                uint e = (s >> 2) & 3;
                for (int p = n; p > 0; p--)
                {
                    uint z = v[p - 1];
                    uint mx = ((((z >> 5) ^ (y << 2)) + ((y >> 3) ^ (z << 4))) ^ ((s ^ y) + (k[(p & 3) ^ e] ^ z)));
                    v[p] -= mx;
                    y = v[p];
                }
                uint z2 = v[n];
                uint mx2 = ((((z2 >> 5) ^ (y << 2)) + ((y >> 3) ^ (z2 << 4))) ^ ((s ^ y) + (k[e] ^ z2)));
                v[0] -= mx2;
                y = v[0];
                s -= Delta;
            }
        }

        public static byte[] XxteaEnc(byte[] data, string key)
        {
            int pad = (4 - (data.Length % 4)) % 4;
            var padded = new byte[data.Length + pad];
            Buffer.BlockCopy(data, 0, padded, 0, data.Length);
            var words = new List<uint>(ToWords(padded));
            words.Add((uint)data.Length);
            var v = words.ToArray();
            EncWords(v, KeyWords(key));
            return FromWords(v);
        }

        /// <summary>解密：返回 (明文, 明文长度)</summary>
        public static byte[] XxteaDec(byte[] ct, string key, out int plainLen)
        {
            var v = ToWords(ct);
            DecWords(v, KeyWords(key));
            plainLen = (int)v[v.Length - 1];
            if (plainLen < 0 || plainLen > v.Length * 4) plainLen = v.Length * 4 - 4;
            return FromWords(v);
        }

        // ---------------- 最小 ZIP（单文件 deflate） ----------------

        private static uint[] _crcTable;

        public static uint Crc32(byte[] data)
        {
            if (_crcTable == null)
            {
                _crcTable = new uint[256];
                for (uint n = 0; n < 256; n++)
                {
                    uint c = n;
                    for (int k = 0; k < 8; k++) c = ((c & 1) != 0) ? (0xEDB88320u ^ (c >> 1)) : (c >> 1);
                    _crcTable[n] = c;
                }
            }
            uint crc = 0xFFFFFFFFu;
            foreach (byte b in data) crc = _crcTable[(crc ^ b) & 0xFF] ^ (crc >> 8);
            return crc ^ 0xFFFFFFFFu;
        }

        private static byte[] DeflateRaw(byte[] data)
        {
            using (var ms = new MemoryStream())
            {
                using (var ds = new DeflateStream(ms, CompressionMode.Compress, true)) ds.Write(data, 0, data.Length);
                return ms.ToArray();
            }
        }

        private static byte[] InflateRaw(byte[] data)
        {
            using (var input = new MemoryStream(data))
            using (var ds = new DeflateStream(input, CompressionMode.Decompress))
            using (var outMs = new MemoryStream())
            {
                var buf = new byte[8192];
                int n;
                while ((n = ds.Read(buf, 0, buf.Length)) > 0) outMs.Write(buf, 0, n);
                return outMs.ToArray();
            }
        }

        /// <summary>打一个单文件 zip（结构等价于 Java ZipOutputStream 能读的形态）</summary>
        public static byte[] ZipOne(string name, byte[] data)
        {
            var nameBytes = Encoding.UTF8.GetBytes(name);
            var comp = DeflateRaw(data);
            uint crc = Crc32(data);

            var local = new byte[30];
            WriteU32(local, 0, 0x04034b50);
            WriteU16(local, 4, 20);
            WriteU16(local, 6, 0);
            WriteU16(local, 8, 8);
            WriteU16(local, 10, 0);
            WriteU16(local, 12, 0x21);
            WriteU32(local, 14, crc);
            WriteU32(local, 18, (uint)comp.Length);
            WriteU32(local, 22, (uint)data.Length);
            WriteU16(local, 26, (ushort)nameBytes.Length);
            WriteU16(local, 28, 0);

            var central = new byte[46];
            WriteU32(central, 0, 0x02014b50);
            WriteU16(central, 4, 20);
            WriteU16(central, 6, 20);
            WriteU16(central, 8, 0);
            WriteU16(central, 10, 8);
            WriteU16(central, 12, 0);
            WriteU16(central, 14, 0x21);
            WriteU32(central, 16, crc);
            WriteU32(central, 20, (uint)comp.Length);
            WriteU32(central, 24, (uint)data.Length);
            WriteU16(central, 28, (ushort)nameBytes.Length);
            WriteU32(central, 42, 0);

            var eocd = new byte[22];
            WriteU32(eocd, 0, 0x06054b50);
            WriteU16(eocd, 8, 1);
            WriteU16(eocd, 10, 1);
            WriteU32(eocd, 12, (uint)(central.Length + nameBytes.Length));
            WriteU32(eocd, 16, (uint)(30 + nameBytes.Length + comp.Length));

            return Cat(local, nameBytes, comp, central, nameBytes, eocd);
        }

        /// <summary>解单文件 zip：走中央目录拿尺寸（服务端用的是 data descriptor，local header 里尺寸是 0）</summary>
        public static byte[] UnzipOne(byte[] payload)
        {
            int eocd = -1;
            for (int i = payload.Length - 22; i >= Math.Max(0, payload.Length - 65557); i--)
            {
                if (ReadU32(payload, i) == 0x06054b50) { eocd = i; break; }
            }
            if (eocd < 0) throw new Exception("zip 响应里找不到中央目录");
            int cdOff = (int)ReadU32(payload, eocd + 16);
            if (ReadU32(payload, cdOff) != 0x02014b50) throw new Exception("zip 中央目录损坏");
            int method = ReadU16(payload, cdOff + 10);
            int compSize = (int)ReadU32(payload, cdOff + 20);
            int lho = (int)ReadU32(payload, cdOff + 42);
            int lNameLen = ReadU16(payload, lho + 26);
            int lExtraLen = ReadU16(payload, lho + 28);
            int start = lho + 30 + lNameLen + lExtraLen;
            var body = new byte[compSize];
            Buffer.BlockCopy(payload, start, body, 0, compSize);
            return method == 8 ? InflateRaw(body) : body;
        }

        public static void WriteU16(byte[] b, int off, ushort v)
        {
            b[off] = (byte)(v & 0xFF);
            b[off + 1] = (byte)((v >> 8) & 0xFF);
        }

        public static void WriteU32(byte[] b, int off, uint v)
        {
            b[off] = (byte)(v & 0xFF);
            b[off + 1] = (byte)((v >> 8) & 0xFF);
            b[off + 2] = (byte)((v >> 16) & 0xFF);
            b[off + 3] = (byte)((v >> 24) & 0xFF);
        }

        public static ushort ReadU16(byte[] b, int off) { return (ushort)(b[off] | (b[off + 1] << 8)); }
        public static uint ReadU32(byte[] b, int off)
        {
            return (uint)(b[off] | (b[off + 1] << 8) | (b[off + 2] << 16) | (b[off + 3] << 24));
        }

        public static string Md5Hex(byte[] data)
        {
            using (var md5 = MD5.Create())
            {
                var h = md5.ComputeHash(data);
                var sb = new StringBuilder();
                foreach (var x in h) sb.Append(x.ToString("x2"));
                return sb.ToString();
            }
        }

        public static string Md5Hex(string text) { return Md5Hex(Encoding.UTF8.GetBytes(text)); }
    }

    internal class PbField
    {
        public int Field;
        public int Wire;
        public long Num;
        public byte[] Bytes;
    }

    // ========================================================================
    //  三、按 salt 派生设备标识（一账号一份指纹的根）
    // ========================================================================
    internal class DeviceStream
    {
        private readonly byte[] _seed;
        private byte[] _buf = new byte[0];
        private int _n;

        public DeviceStream(string saltText)
        {
            using (var sha = SHA256.Create())
                _seed = sha.ComputeHash(Encoding.UTF8.GetBytes("dx-device:" + (saltText ?? "")));
        }

        public byte[] Take(int n)
        {
            while (_buf.Length < n)
            {
                byte[] block;
                using (var sha = SHA256.Create())
                {
                    var input = new byte[_seed.Length + 1];
                    Buffer.BlockCopy(_seed, 0, input, 0, _seed.Length);
                    input[_seed.Length] = (byte)(_n & 0xFF);
                    block = sha.ComputeHash(input);
                }
                var merged = new byte[_buf.Length + block.Length];
                Buffer.BlockCopy(_buf, 0, merged, 0, _buf.Length);
                Buffer.BlockCopy(block, 0, merged, _buf.Length, block.Length);
                _buf = merged;
                _n++;
            }
            var outBytes = new byte[n];
            Buffer.BlockCopy(_buf, 0, outBytes, 0, n);
            var rest = new byte[_buf.Length - n];
            Buffer.BlockCopy(_buf, n, rest, 0, rest.Length);
            _buf = rest;
            return outBytes;
        }

        public string HexStr(int n)
        {
            var b = Take((n + 1) / 2);
            var sb = new StringBuilder();
            foreach (var x in b) sb.Append(x.ToString("x2"));
            return sb.ToString().Substring(0, n);
        }

        public string Uuid()
        {
            var b = Take(16);
            b[6] = (byte)((b[6] & 0x0F) | 0x40);
            b[8] = (byte)((b[8] & 0x3F) | 0x80);
            var sb = new StringBuilder();
            foreach (var x in b) sb.Append(x.ToString("x2"));
            var h = sb.ToString();
            return h.Substring(0, 8) + "-" + h.Substring(8, 4) + "-" + h.Substring(12, 4) + "-" + h.Substring(16, 4) + "-" + h.Substring(20);
        }
    }

    // ========================================================================
    //  四、顶象指纹签发
    // ========================================================================
    internal static class Dx
    {
        private static bool IsUuid(string v)
        {
            if (v.Length != 36) return false;
            for (int i = 0; i < v.Length; i++)
            {
                char c = v[i];
                if (i == 8 || i == 13 || i == 18 || i == 23) { if (c != '-') return false; }
                else if (!Uri.IsHexDigit(c)) return false;
            }
            return true;
        }

        private static bool IsDigits(string v)
        {
            if (v.Length == 0) return false;
            foreach (var c in v) if (!char.IsDigit(c)) return false;
            return true;
        }

        private static bool IsHexLong(string v)
        {
            if (v.Length < 8) return false;
            foreach (var c in v) if (!Uri.IsHexDigit(c)) return false;
            return true;
        }

        private static string Derive(string value, DeviceStream s)
        {
            if (s == null || string.IsNullOrEmpty(value)) return value;
            if (IsUuid(value)) return s.Uuid();
            if (IsDigits(value)) return value;
            if (IsHexLong(value)) return s.HexStr(value.Length);
            return value;
        }

        public static byte[] BuildSeed(string salt, Dictionary<string, string> overrides, long ts)
        {
            var stream = string.IsNullOrEmpty(salt) ? null : new DeviceStream(salt);
            var mapParts = new List<byte[]>();
            foreach (var row in DeviceTable.MapItems)
            {
                string key = row[0];
                string text = (key == "K451" || key == "K452") ? ts.ToString(CultureInfo.InvariantCulture) : Derive(row[1], stream);
                if (overrides != null && overrides.ContainsKey(key)) text = overrides[key];
                mapParts.Add(Bytes.PbStr(1, Bytes.Cat(Bytes.PbStr(1, key), Bytes.PbStr(2, text))));
            }

            var dev = new List<byte[]>();
            dev.Add(Bytes.PbStr(1, Consts.DxVer));
            dev.Add(Bytes.PbStr(2, "1.30.2"));
            dev.Add(Bytes.PbVi(3, 321028183));
            dev.Add(Bytes.PbStr(4, Consts.DxAppKey));
            dev.Add(Bytes.PbVi(5, 0));
            dev.Add(Bytes.PbStr(6, "36"));
            dev.Add(Bytes.PbStr(7, "6aec8780Zq4dNGOFcPVdCh4moOzSwyE9LZVGC9m3"));
            dev.Add(Bytes.PbVi(8, 1));
            dev.Add(Bytes.PbStr(9, Consts.DxApp));
            dev.Add(Bytes.PbVi(10, 3));

            return Bytes.Cat(
                Bytes.PbStr(1, Bytes.Cat(dev.ToArray())),
                Bytes.PbVi(2, 1002),
                Bytes.PbStr(3, Bytes.Cat(mapParts.ToArray())));
        }

        /// <summary>签到/登录用的设备指纹。salt 传 token 或手机号（决定「哪台设备」）</summary>
        public static string Issue(string salt, string profile, out string err)
        {
            err = null;
            try
            {
                var fields = DeviceTable.ProfileFields(profile);
                byte[] seed = BuildSeed(salt, fields, Bytes.NowMs());
                string sign = Bytes.Md5Hex(Bytes.Cat(Encoding.UTF8.GetBytes(Consts.DxAppKey), seed, Encoding.UTF8.GetBytes(Consts.DxAppKey)));
                string url = Consts.DxEndpoint + "?sign=" + sign + "&appKey=" + Consts.DxAppKey +
                             "&app=" + Uri.EscapeDataString(Consts.DxApp) + "&version=" + Consts.DxVer;
                byte[] body = Bytes.XxteaEnc(Bytes.ZipOne("data", seed), Consts.DxXteaKey);

                var resp = Http.Raw(Http.HttpPostBytes(url, body, new Dictionary<string, string>
                {
                    { "accept", "*/*" },
                    { "User-Agent", "Risk-" + Consts.DxVer },
                    { "Content-type", "application/octet-stream" },
                }));

                int plainLen;
                byte[] plain = Bytes.XxteaDec(resp, Consts.DxXteaKey, out plainLen);
                var zipPlain = new byte[plainLen];
                Buffer.BlockCopy(plain, 0, zipPlain, 0, plainLen);
                var pb = Bytes.ParsePb(Bytes.UnzipOne(zipPlain));

                long code = long.MinValue;
                byte[] payload = null;
                foreach (var f in pb)
                {
                    if (f.Field == 3 && f.Wire == 0) code = f.Num;
                    if (f.Field == 2 && f.Wire == 2) payload = f.Bytes;
                }
                if (payload == null)
                {
                    err = "指纹服务未返回数据（code=" + code + "）";
                    return null;
                }
                foreach (var f in Bytes.ParsePb(payload))
                {
                    if (f.Field == 1 && f.Wire == 2) return Encoding.UTF8.GetString(f.Bytes);
                }
                err = "指纹服务未返回 token（code=" + code + "）";
                return null;
            }
            catch (Exception e)
            {
                err = "签发失败：" + e.Message;
                return null;
            }
        }
    }

    // ========================================================================
    //  五、HTTP + 迷你 JSON（不引第三方库，也不用 System.Web.Extensions）
    // ========================================================================
    internal static class Json
    {
        public static object Parse(string s)
        {
            int i = 0;
            var v = ParseValue(s, ref i);
            return v;
        }

        private static void SkipWs(string s, ref int i)
        {
            while (i < s.Length && (s[i] == ' ' || s[i] == '\t' || s[i] == '\r' || s[i] == '\n')) i++;
        }

        private static object ParseValue(string s, ref int i)
        {
            SkipWs(s, ref i);
            if (i >= s.Length) return null;
            char c = s[i];
            if (c == '{')
            {
                i++;
                var map = new Dictionary<string, object>();
                SkipWs(s, ref i);
                if (i < s.Length && s[i] == '}') { i++; return map; }
                while (i < s.Length)
                {
                    SkipWs(s, ref i);
                    string key = (string)ParseValue(s, ref i);
                    SkipWs(s, ref i);
                    if (i < s.Length && s[i] == ':') i++;
                    map[key] = ParseValue(s, ref i);
                    SkipWs(s, ref i);
                    if (i < s.Length && s[i] == ',') { i++; continue; }
                    if (i < s.Length && s[i] == '}') { i++; break; }
                    break;
                }
                return map;
            }
            if (c == '[')
            {
                i++;
                var list = new List<object>();
                SkipWs(s, ref i);
                if (i < s.Length && s[i] == ']') { i++; return list; }
                while (i < s.Length)
                {
                    list.Add(ParseValue(s, ref i));
                    SkipWs(s, ref i);
                    if (i < s.Length && s[i] == ',') { i++; continue; }
                    if (i < s.Length && s[i] == ']') { i++; break; }
                    break;
                }
                return list;
            }
            if (c == '"')
            {
                i++;
                var sb = new StringBuilder();
                while (i < s.Length)
                {
                    char ch = s[i++];
                    if (ch == '"') break;
                    if (ch == '\\' && i < s.Length)
                    {
                        char e = s[i++];
                        switch (e)
                        {
                            case 'n': sb.Append('\n'); break;
                            case 'r': sb.Append('\r'); break;
                            case 't': sb.Append('\t'); break;
                            case 'b': sb.Append('\b'); break;
                            case 'f': sb.Append('\f'); break;
                            case 'u':
                                if (i + 4 <= s.Length)
                                {
                                    sb.Append((char)Convert.ToInt32(s.Substring(i, 4), 16));
                                    i += 4;
                                }
                                break;
                            default: sb.Append(e); break;
                        }
                    }
                    else sb.Append(ch);
                }
                return sb.ToString();
            }
            if (string.CompareOrdinal(s, i, "true", 0, 4) == 0) { i += 4; return true; }
            if (string.CompareOrdinal(s, i, "false", 0, 5) == 0) { i += 5; return false; }
            if (string.CompareOrdinal(s, i, "null", 0, 4) == 0) { i += 4; return null; }
            int start = i;
            while (i < s.Length && (char.IsDigit(s[i]) || s[i] == '-' || s[i] == '+' || s[i] == '.' || s[i] == 'e' || s[i] == 'E')) i++;
            double d;
            double.TryParse(s.Substring(start, i - start), NumberStyles.Float, CultureInfo.InvariantCulture, out d);
            return d;
        }

        public static string Str(object o)
        {
            if (o == null) return "";
            if (o is string) return (string)o;
            if (o is double) return ((double)o).ToString(CultureInfo.InvariantCulture);
            if (o is bool) return (bool)o ? "true" : "false";
            return o.ToString();
        }

        public static Dictionary<string, object> Obj(object o)
        {
            var d = o as Dictionary<string, object>;
            return d ?? new Dictionary<string, object>();
        }

        public static string Get(object root, string path)
        {
            object cur = root;
            foreach (var seg in path.Split('.'))
            {
                var d = cur as Dictionary<string, object>;
                if (d == null) return "";
                object nxt;
                if (!d.TryGetValue(seg, out nxt)) return "";
                cur = nxt;
            }
            return Str(cur);
        }
    }

    internal static class Http
    {
        static Http()
        {
            // .NET Framework 4.0 默认只谈 TLS1.0，龙湖网关只收 1.2
            try { ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072; }
            catch { }
            ServicePointManager.DefaultConnectionLimit = 8;
            try { ServicePointManager.Expect100Continue = false; } catch { }
        }

        private static HttpWebRequest Make(string url, string method, Dictionary<string, string> headers)
        {
            var req = (HttpWebRequest)WebRequest.Create(url);
            req.Method = method;
            req.Timeout = 20000;
            req.ReadWriteTimeout = 20000;
            req.KeepAlive = false;
            req.Proxy = null; // 直连：别被本机抓包工具的代理带偏
            if (headers != null)
            {
                foreach (var kv in headers)
                {
                    if (kv.Value == null) continue;
                    string k = kv.Key;
                    if (string.Equals(k, "Host", StringComparison.OrdinalIgnoreCase)) continue;
                    if (string.Equals(k, "Content-Type", StringComparison.OrdinalIgnoreCase)) { req.ContentType = kv.Value; continue; }
                    if (string.Equals(k, "User-Agent", StringComparison.OrdinalIgnoreCase)) { req.UserAgent = kv.Value; continue; }
                    if (string.Equals(k, "Accept", StringComparison.OrdinalIgnoreCase)) { req.Accept = kv.Value; continue; }
                    if (string.Equals(k, "Referer", StringComparison.OrdinalIgnoreCase)) { req.Referer = kv.Value; continue; }
                    req.Headers[k] = kv.Value;
                }
            }
            return req;
        }

        public static string HttpPostJson(string url, string json, Dictionary<string, string> headers)
        {
            var req = Make(url, "POST", headers);
            var body = Encoding.UTF8.GetBytes(json);
            req.ContentType = req.ContentType ?? "application/json";
            req.ContentLength = body.Length;
            using (var s = req.GetRequestStream()) s.Write(body, 0, body.Length);
            return ReadAll(req);
        }

        public static string HttpPutJson(string url, string json, Dictionary<string, string> headers)
        {
            var req = Make(url, "PUT", headers);
            var body = Encoding.UTF8.GetBytes(json);
            req.ContentType = req.ContentType ?? "application/json";
            req.ContentLength = body.Length;
            using (var st = req.GetRequestStream()) st.Write(body, 0, body.Length);
            return ReadAll(req);
        }

        public static string HttpDelete(string url, string json, Dictionary<string, string> headers)
        {
            var req = Make(url, "DELETE", headers);
            var body = Encoding.UTF8.GetBytes(json ?? "");
            req.ContentType = req.ContentType ?? "application/json";
            req.ContentLength = body.Length;
            using (var st = req.GetRequestStream()) st.Write(body, 0, body.Length);
            return ReadAll(req);
        }

        public static byte[] HttpPostBytes(string url, byte[] body, Dictionary<string, string> headers)
        {
            var req = Make(url, "POST", headers);
            req.ContentType = "application/octet-stream";
            req.ContentLength = body.Length;
            using (var s = req.GetRequestStream()) s.Write(body, 0, body.Length);
            using (var r = req.GetResponse())
            using (var rs = r.GetResponseStream())
            using (var ms = new MemoryStream())
            {
                var buf = new byte[8192];
                int n;
                while ((n = rs.Read(buf, 0, buf.Length)) > 0) ms.Write(buf, 0, n);
                return ms.ToArray();
            }
        }

        public static string HttpGet(string url, Dictionary<string, string> headers)
        {
            var req = Make(url, "GET", headers);
            return ReadAll(req);
        }

        /// <summary>发请求并原样返回字节（解 gzip 交给调用方）</summary>
        public static byte[] Raw(byte[] already)
        {
            return already;
        }

        private static string ReadAll(HttpWebRequest req)
        {
            try
            {
                using (var r = req.GetResponse())
                using (var rs = r.GetResponseStream())
                using (var ms = new MemoryStream())
                {
                    var buf = new byte[8192];
                    int n;
                    while ((n = rs.Read(buf, 0, buf.Length)) > 0) ms.Write(buf, 0, n);
                    var bytes = ms.ToArray();
                    var enc = r.Headers["Content-Encoding"];
                    if (enc != null && enc.IndexOf("gzip", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        using (var gz = new GZipStream(new MemoryStream(bytes), CompressionMode.Decompress))
                        using (var outMs = new MemoryStream())
                        {
                            var b2 = new byte[8192];
                            int n2;
                            while ((n2 = gz.Read(b2, 0, b2.Length)) > 0) outMs.Write(b2, 0, n2);
                            bytes = outMs.ToArray();
                        }
                    }
                    return Encoding.UTF8.GetString(bytes);
                }
            }
            catch (WebException we)
            {
                if (we.Response != null)
                {
                    using (var rs = we.Response.GetResponseStream())
                    using (var sr = new StreamReader(rs, Encoding.UTF8))
                        return sr.ReadToEnd();
                }
                throw;
            }
        }
    }

    // ========================================================================
    //  六、签名 + 龙湖接口
    // ========================================================================
    internal static class Sign
    {
        /// <summary>拼签名串：键名升序，k=v 用 | 连接，跳过空值 / null / 对象</summary>
        public static string Source(Dictionary<string, object> body)
        {
            var keys = new List<string>(body.Keys);
            keys.Sort(StringComparer.Ordinal);
            var parts = new List<string>();
            foreach (var k in keys)
            {
                var v = body[k];
                if (v != null && (v is Dictionary<string, object> || v is List<object>)) continue;
                string text = Json.Str(v);
                if (text.Trim().Length > 0 && text != "null") parts.Add(k + "=" + text);
            }
            return string.Join("|", parts.ToArray());
        }

        public static Dictionary<string, string> Headers(Dictionary<string, object> body, string client, string secret)
        {
            return HeadersAt(body, client, secret, Bytes.NowMs().ToString(CultureInfo.InvariantCulture));
        }

        public static Dictionary<string, string> HeadersAt(Dictionary<string, object> body, string client, string secret, string ts)
        {
            string joined = Source(body);
            string raw = (joined.Length > 0 ? joined + "&" : "") + ts + "&" + secret;
            var h = new Dictionary<string, string>();
            h["X-LONGZHU-TimeStamp"] = ts;
            h["X-Client-Type"] = client;
            h["X-LONGZHU-Sign"] = Bytes.Md5Hex(raw);
            return h;
        }
    }

    internal class ApiResult
    {
        public bool Ok;
        public string Code = "";
        public string Message = "";
        public string ExtraCode = "";
        public string ExtraMessage = "";
        public Dictionary<string, object> Data = new Dictionary<string, object>();
        public string Raw = "";

        public string Talk()
        {
            if (!string.IsNullOrEmpty(ExtraMessage)) return "[" + (string.IsNullOrEmpty(ExtraCode) ? Code : ExtraCode) + "] " + ExtraMessage;
            return "[" + Code + "] " + (string.IsNullOrEmpty(Message) ? "(无文案)" : Message);
        }
    }

    internal static class Longhu
    {
        private static Dictionary<string, string> Common()
        {
            return new Dictionary<string, string>
            {
                { "Host", Consts.Host },
                { "X-LF-Bucode", Consts.BuCode },
                { "Accept", "*/*" },
                { "X-LF-Api-Version", Consts.ApiVersion },
                { "X-LF-App-Version", Consts.AppVersion },
                { "X-LF-Stage", "RELEASE" },
                { "X-Gaia-Api-Key", Consts.ApiKeyLogin },
                { "X-LF-Channel", Consts.Channel },
                { "Accept-Language", "zh-Hans-CN;q=1.0" },
                { "User-Agent", Consts.UaApp },
                { "X-LF-Bundle-id", Consts.BundleId },
                { "Content-Type", "application/json" },
            };
        }

        private static ApiResult Post(string path, Dictionary<string, object> body)
        {
            var headers = Common();
            foreach (var kv in Sign.Headers(body, "app", Consts.SignSecretApp)) headers[kv.Key] = kv.Value;
            string json = Dump(body);
            string text = Http.HttpPostJson(Consts.Base + path, json, headers);
            return Wrap(text);
        }

        private static ApiResult Wrap(string text)
        {
            var r = new ApiResult { Raw = text };
            object root;
            try { root = Json.Parse(text); }
            catch { r.Code = "BADJSON"; r.Message = text.Length > 160 ? text.Substring(0, 160) : text; return r; }
            var d = Json.Obj(root);
            r.Code = Json.Get(d, "code");
            r.Message = Json.Get(d, "message");
            r.ExtraCode = Json.Get(d, "extraCode");
            r.ExtraMessage = Json.Get(d, "extraMessage");
            object data;
            if (d.TryGetValue("data", out data)) r.Data = Json.Obj(data);
            r.Ok = r.Code == "200" || r.Code == "0000";
            return r;
        }

        /// <summary>把字典序列化成 JSON（只用于本程序自己拼的请求体）</summary>
        public static string Dump(Dictionary<string, object> map)
        {
            var sb = new StringBuilder();
            sb.Append("{");
            bool first = true;
            foreach (var kv in map)
            {
                if (!first) sb.Append(",");
                first = false;
                sb.Append(Quote(kv.Key)).Append(":").Append(Value(kv.Value));
            }
            sb.Append("}");
            return sb.ToString();
        }

        public static string Dump(List<object> list)
        {
            var sb = new StringBuilder();
            sb.Append("[");
            for (int i = 0; i < list.Count; i++)
            {
                if (i > 0) sb.Append(",");
                sb.Append(Value(list[i]));
            }
            sb.Append("]");
            return sb.ToString();
        }

        private static string Value(object v)
        {
            if (v == null) return "null";
            if (v is string) return Quote((string)v);
            if (v is bool) return (bool)v ? "true" : "false";
            if (v is Dictionary<string, object>) return Dump((Dictionary<string, object>)v);
            if (v is List<object>) return Dump((List<object>)v);
            if (v is int || v is long) return Convert.ToString(v, CultureInfo.InvariantCulture);
            if (v is double) return ((double)v).ToString(CultureInfo.InvariantCulture);
            return Quote(v.ToString());
        }

        private static string Quote(string s)
        {
            var sb = new StringBuilder();
            sb.Append('"');
            foreach (var c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
            return sb.ToString();
        }

        // ---------------- 登录三步 ----------------

        public static ApiResult SendSms(string mobile, string fingerprint, string riskToken)
        {
            var body = new Dictionary<string, object>();
            body["channel"] = Consts.Channel;
            body["buCode"] = Consts.BuCode;
            body["mobile"] = Convert.ToBase64String(Encoding.UTF8.GetBytes(mobile));
            body["prefix"] = "+86";
            body["fingerprint"] = fingerprint;
            if (!string.IsNullOrEmpty(riskToken)) body["riskToken"] = riskToken;
            return Post(Consts.SendSmsPath, body);
        }

        public static ApiResult LoginByCode(string mobile, string code, string fingerprint)
        {
            var body = new Dictionary<string, object>();
            body["buCode"] = Consts.BuCode;
            body["channel"] = Consts.Channel;
            body["code"] = code;
            body["fingerprint"] = fingerprint;
            body["prefix"] = "+86";
            body["mobile"] = Convert.ToBase64String(Encoding.UTF8.GetBytes(mobile));
            return Post(Consts.LoginPath, body);
        }

        // ---------------- 校验 / 续期 ----------------

        public static ApiResult UserInfo(string token)
        {
            var headers = new Dictionary<string, string>
            {
                { "User-Agent", Consts.UaApp },
                { "lmToken", token },
                { "X-Gaia-Api-Key", Consts.ApiKeyLogin },
                { "X-LF-Bucode", Consts.BuCode },
                { "X-LF-Channel", Consts.Channel },
                { "X-LF-Api-Version", Consts.MemberApiVersion },
                { "Content-Type", "application/json" },
            };
            return Wrap(Http.HttpGet(Consts.Base + Consts.UserInfoPath, headers));
        }

        /// <summary>token2key -> key2token，把有效期重置成 30 天</summary>
        public static ApiResult Refresh(string token, out string newToken)
        {
            newToken = null;
            var empty = new Dictionary<string, object>();
            var headers = new Dictionary<string, string>
            {
                { "lmToken", token },
                { "X-LF-Bucode", Consts.BuCode },
                { "X-LF-Api-Version", Consts.MemberApiVersion },
                { "X-LF-Channel", Consts.Channel },
                { "X-LF-App-Version", Consts.MemberApiVersion },
                { "User-Agent", Consts.UaApp },
                { "Origin", "https://longzhu.longfor.com" },
                { "Referer", "https://longzhu.longfor.com/" },
                { "Content-Type", "application/json" },
            };
            foreach (var kv in Sign.Headers(empty, "microApp", "Q74eKtH5LePYfSjIiflUbCL2gxjTa7rF")) headers[kv.Key] = kv.Value;
            var r1 = Wrap(Http.HttpPostJson(Consts.Base + Consts.Token2KeyPath, "{}", headers));
            string key = Json.Get(r1.Data, "key");
            if (!r1.Ok || string.IsNullOrEmpty(key))
            {
                r1.Ok = false;
                return r1;
            }

            var body2 = new Dictionary<string, object>();
            body2["key"] = key;
            body2["buCode"] = Consts.BuCode;
            body2["channel"] = Consts.Channel;
            var headers2 = new Dictionary<string, string>
            {
                { "X-Gaia-Api-Key", Consts.ApiKeyWallet },
                { "systype", "WALLET" },
                { "User-Agent", Consts.UaApp },
                { "Origin", "https://longball.longhu.net" },
                { "Referer", "https://longball.longhu.net/" },
                { "Content-Type", "application/json" },
            };
            var r2 = Wrap(Http.HttpPostJson(Consts.Base + Consts.Key2TokenPath, Dump(body2), headers2));
            newToken = Json.Get(r2.Data, "token");
            return r2;
        }

        /// <summary>把龙湖的错误码翻成人话</summary>
        public static string Explain(ApiResult r)
        {
            switch (r.Code)
            {
                case "200":
                case "0000": return "成功";
                case "909001": return "需要图形验证（顶象滑块）";
                case "900004": return "验证码已过期或错误，重新获取";
                case "801001":
                case "900006": return "登录已过期，token 不可用";
                case "406": return "token 验证出错（406/" + r.ExtraCode + "），已过期";
                case "500": return "签名密钥失效（龙湖改版），需更新 exe 里的 SIGN_SECRET_APP";
                default: return r.Talk();
            }
        }
    }

    // ========================================================================
    //  七、青龙面板客户端（登录 / 读变量 / 合并写入 / 回读校验）
    // ========================================================================
    internal static class Ql
    {
        public class Conf
        {
            public string Url = Consts.QlUrlDefault;
            public string User = Consts.QlUserDefault;
            public string Pass = Consts.QlPassDefault;
        }

        public static Dictionary<string, string> H(string token)
        {
            var h = new Dictionary<string, string> { { "Content-Type", "application/json" } };
            if (!string.IsNullOrEmpty(token)) h["Authorization"] = "Bearer " + token;
            return h;
        }

        public static string Login(Conf c)
        {
            var body = new Dictionary<string, object>();
            body["username"] = c.User;
            body["password"] = c.Pass;
            string url = Trim(c.Url) + "/api/user/login";
            string text = Http.HttpPostJson(url, Longhu.Dump(body), H(null));
            var root = Json.Obj(Json.Parse(text));
            if (Json.Get(root, "code") != "200") throw new Exception("青龙登录失败：" + Short(text));
            return Json.Get(root, "data.token");
        }

        private static string Trim(string url)
        {
            var u = (url ?? "").Trim();
            while (u.EndsWith("/")) u = u.Substring(0, u.Length - 1);
            return u;
        }

        public static List<Dictionary<string, object>> Rows(object resp)
        {
            var outList = new List<Dictionary<string, object>>();
            var root = Json.Obj(resp);
            object data;
            if (!root.TryGetValue("data", out data)) return outList;
            var list = data as List<object>;
            if (list != null)
            {
                foreach (var x in list) { var d = x as Dictionary<string, object>; if (d != null) outList.Add(d); }
                return outList;
            }
            var dd = data as Dictionary<string, object>;
            if (dd != null)
            {
                object inner;
                if (dd.TryGetValue("data", out inner))
                {
                    var l2 = inner as List<object>;
                    if (l2 != null) foreach (var x in l2) { var d = x as Dictionary<string, object>; if (d != null) outList.Add(d); }
                }
            }
            return outList;
        }

        public static List<Dictionary<string, object>> GetEnvs(Conf c, string token, string name)
        {
            string text = Http.HttpGet(Trim(c.Url) + "/api/envs?searchValue=" + Uri.EscapeDataString(name), H(token));
            return Rows(Json.Parse(text));
        }

        /// <summary>合并写入一个多行变量：同 token 覆盖、不同 token 追加、注释行保留</summary>
        public static string MergeValue(List<string> oldLines, string key, string value)
        {
            var ordered = new List<string>();
            var index = new Dictionary<string, int>();
            foreach (var raw in oldLines)
            {
                string ln = (raw ?? "").Trim();
                if (ln.Length == 0) continue;
                if (ln.StartsWith("#")) { ordered.Add(ln); continue; }
                var seg = ln.Split('#');
                string tk = seg.Length >= 2 ? seg[1].Trim() : seg[0].Trim();
                string label = seg.Length >= 2 ? seg[0].Trim() : "";
                if (tk.Length == 0) continue;
                if (label == key && index.ContainsKey("label:" + label))
                {
                    // 同一备注的旧行：直接替换
                    int pos = index["label:" + label];
                    ordered[pos] = key + "#" + value;
                    index.Remove("token:" + tk);
                    index["token:" + value] = pos;
                    continue;
                }
                if (index.ContainsKey("token:" + tk))
                {
                    int pos = index["token:" + tk];
                    if (label == key) { ordered[pos] = key + "#" + value; index["label:" + key] = pos; }
                    continue;
                }
                ordered.Add(ln);
                index["token:" + tk] = ordered.Count - 1;
                if (label.Length > 0) index["label:" + label] = ordered.Count - 1;
            }

            string newLine = key + "#" + value;
            if (index.ContainsKey("token:" + value))
            {
                ordered[index["token:" + value]] = newLine;
                index["label:" + key] = index["token:" + value];
            }
            else if (index.ContainsKey("label:" + key))
            {
                ordered[index["label:" + key]] = newLine;
                index["token:" + value] = index["label:" + key];
            }
            else ordered.Add(newLine);

            return string.Join("\n", ordered.ToArray());
        }

        public static void SaveEnv(Conf c, string token, string name, string value, string remarks, Logger log)
        {
            var existing = GetEnvs(c, token, name);
            Dictionary<string, object> cur = null;
            foreach (var e in existing)
                if (Json.Get(e, "name") == name) cur = e;

            var body = new Dictionary<string, object>();
            body["name"] = name;
            body["value"] = value;
            body["remarks"] = remarks;
            string url = Trim(c.Url) + "/api/envs";
            string text;
            if (cur != null)
            {
                body["id"] = (long)Convert.ToDouble(Json.Get(cur, "id"), CultureInfo.InvariantCulture);
                text = Http.HttpPutJson(url, Longhu.Dump(body), H(token));
                if (Json.Get(Json.Obj(Json.Parse(text)), "code") != "200")
                {
                    // 有些版本 PUT 走的是同一个路径但要求不同的方法名，这里退回 POST 覆盖
                    log.Warn("PUT /api/envs 返回异常，尝试 POST：" + Short(text));
                    text = Http.HttpPostJson(url, "[" + Longhu.Dump(body) + "]", H(token));
                }
            }
            else
            {
                text = Http.HttpPostJson(url, "[" + Longhu.Dump(body) + "]", H(token));
            }
            var root = Json.Obj(Json.Parse(text));
            if (Json.Get(root, "code") != "200") throw new Exception("写变量 " + name + " 失败：" + Short(text));
        }

        public static void Put(Conf c, string token, string path, string json)
        {
            string text = Http.HttpPostJson(Trim(c.Url) + path, json, H(token));
            var root = Json.Obj(Json.Parse(text));
            if (Json.Get(root, "code") != "200") throw new Exception(path + " 失败：" + Short(text));
        }

        public static string Short(string s)
        {
            if (s == null) return "";
            s = s.Replace("\r", " ").Replace("\n", " ");
            return s.Length > 200 ? s.Substring(0, 200) + "…" : s;
        }
    }

    // ========================================================================
    //  八、日志输出接口（窗体与部署逻辑解耦）
    // ========================================================================
    internal class Logger
    {
        private readonly Action<string, Color> _sink;
        public Logger(Action<string, Color> sink) { _sink = sink; }
        public void Info(string s) { _sink(s, Color.FromArgb(40, 40, 40)); }
        public void Ok(string s) { _sink(s, Color.FromArgb(0, 128, 60)); }
        public void Warn(string s) { _sink(s, Color.FromArgb(190, 110, 0)); }
        public void Err(string s) { _sink(s, Color.FromArgb(190, 30, 30)); }
        public void Dim(string s) { _sink(s, Color.Gray); }
    }

    // ========================================================================
    //  九、滑块兜底：服务端偶尔会要求人机验证（909001）
    //     这时在 127.0.0.1 起一个临时页面，拉起本机浏览器拖一次滑块，
    //     页面跑的是龙湖自己的 dx-captcha SDK，成功后把 token 回传给程序。
    // ========================================================================
    internal class CaptchaServer
    {
        private readonly HttpListener _listener = new HttpListener();
        private readonly string _fingerprint;
        private string _token;
        private readonly ManualResetEventSlim _done = new ManualResetEventSlim(false);
        public int Port { get; private set; }

        public CaptchaServer(string fingerprint)
        {
            _fingerprint = fingerprint;
            var rnd = new Random();
            for (int i = 0; i < 20; i++)
            {
                int port = rnd.Next(18000, 28000);
                try
                {
                    _listener.Prefixes.Clear();
                    _listener.Prefixes.Add("http://127.0.0.1:" + port + "/");
                    _listener.Start();
                    Port = port;
                    break;
                }
                catch { }
            }
            if (Port == 0) throw new Exception("本机端口都占用了，无法起滑块页面");
            new Thread(Loop) { IsBackground = true }.Start();
        }

        private void Loop()
        {
            while (_listener.IsListening)
            {
                HttpListenerContext ctx;
                try { ctx = _listener.GetContext(); }
                catch { return; }
                try { Handle(ctx); }
                catch { }
            }
        }

        private void Handle(HttpListenerContext ctx)
        {
            string path = ctx.Request.Url.AbsolutePath;
            if (path == "/risk")
            {
                string t = ctx.Request.QueryString["t"];
                if (!string.IsNullOrEmpty(t))
                {
                    _token = t;
                    _done.Set();
                }
                Reply(ctx, "text/plain", Encoding.UTF8.GetBytes("ok"));
                return;
            }
            if (path == "/" || path == "/index.html")
            {
                Reply(ctx, "text/html; charset=utf-8", Encoding.UTF8.GetBytes(Page(_fingerprint)));
                return;
            }
            Reply(ctx, "text/plain", Encoding.UTF8.GetBytes("404"));
        }

        private static void Reply(HttpListenerContext ctx, string type, byte[] body)
        {
            ctx.Response.ContentType = type;
            ctx.Response.ContentLength64 = body.Length;
            ctx.Response.OutputStream.Write(body, 0, body.Length);
            ctx.Response.OutputStream.Close();
        }

        private string Page(string fp)
        {
            // 页面逻辑：把指纹写进 localStorage（SDK 会用它当 /api/a 的 c 参数），
            // 加载龙湖自己的 SDK 出题，人拖一次；钩住 /api/v1 的返回拿到 token 回传。
            string appId = Consts.CaptchaAppId;
            string api = Consts.CaptchaApi;
            string sdk = Consts.CaptchaSdk;
            string tpl = @"
<!DOCTYPE html><html><head><meta charset='utf-8'><title>龙湖滑块 · 一次就够</title>
<style>
 body{margin:0;background:#f4f5f7;font:14px/1.6 -apple-system,'Microsoft YaHei',sans-serif;color:#222}
 .box{max-width:520px;margin:40px auto;background:#fff;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.08);padding:22px 24px}
 h2{margin:0 0 6px;font-size:17px}
 .tip{color:#666;font-size:13px}
 .mount{margin:18px 0}
 #state{font-size:13px;color:#0a7d3d;min-height:20px}
 .k{color:#999}
</style></head><body>
<div class='box'>
  <h2>过一次滑块就够了</h2>
  <div class='tip'>把下面的滑块拖到缺口处。成功后这一页可以关掉，程序会自动继续。</div>
  <div class='mount' id='mount'></div>
  <div id='state'></div>
  <div class='tip' style='margin-top:14px'>设备指纹 <span class='k'>__FP__</span></div>
</div>
<script>
  (function(){
    var APP_ID='__APPID__', API='__API__', FP='__FP__';
    try { localStorage.setItem('_dx_app_'+APP_ID, FP); } catch(e){}
    function state(t){ document.getElementById('state').textContent = t; }
    function report(token){
      state('已通过，正在回传…');
      var img = new Image();
      img.onload = img.onerror = function(){ state('已回传，可以关闭本页了 ✅'); };
      img.src = 'http://127.0.0.1:__PORT__/risk?t=' + encodeURIComponent(token);
    }
    // 钩 XMLHttpRequest，只观测不替换构造器
    var xp = XMLHttpRequest.prototype, open0 = xp.open;
    xp.open = function(m,u){
      try {
        if (String(u).indexOf('/api/v1') >= 0) {
          this.addEventListener('load', function(){
            try {
              var j = JSON.parse(this.responseText);
              if (j && j.success && j.token) report(j.token);
              else if (j && j.code === '4011') state('这张图试太多次了（HIGH_RISK），关掉重开一次');
            } catch(e){}
          });
        }
      } catch(e){}
      return open0.apply(this, arguments);
    };
    var s = document.createElement('script');
    s.src = '__SDK__';
    s.onload = function(){
      try {
        new window._dx.Captcha(document.getElementById('mount'), {
          appId: APP_ID, apiServer: API,
          onSuccess: function(){ state('验证通过'); },
          onError: function(e){ state('出题失败：' + (e && e.message ? e.message : e)); }
        }).show();
      } catch(e){ state('SDK 初始化失败：' + e.message); }
    };
    s.onerror = function(){ state('SDK 下载失败，检查网络后刷新'); };
    document.body.appendChild(s);
  })();
</script></body></html>";
            return tpl.Replace("__APPID__", appId).Replace("__API__", api).Replace("__SDK__", sdk)
                      .Replace("__FP__", fp).Replace("__PORT__", Port.ToString(CultureInfo.InvariantCulture));
        }

        public string Wait(TimeSpan timeout)
        {
            if (!_done.Wait(timeout)) return null;
            return _token;
        }

        public void Stop()
        {
            try { _listener.Stop(); } catch { }
            try { _listener.Close(); } catch { }
        }
    }


    // ========================================================================
    //  九点五、指纹簿：随机模式下每个手机号固定一台设备，账本落在 exe 同目录
    // ========================================================================
    internal class FingerprintStore
    {
        public readonly string Path;
        private Dictionary<string, object> _root = new Dictionary<string, object>();

        public FingerprintStore(string dir)
        {
            Path = System.IO.Path.Combine(string.IsNullOrEmpty(dir) ? "." : dir, "取Token-指纹.json");
            try
            {
                if (File.Exists(Path)) _root = Json.Obj(Json.Parse(File.ReadAllText(Path, Encoding.UTF8)));
            }
            catch { _root = new Dictionary<string, object>(); }
        }

        public int Count { get { return _root.Count; } }

        private void Save()
        {
            var sb = new StringBuilder();
            sb.Append("{\n");
            bool first = true;
            foreach (var kv in _root)
            {
                var e = kv.Value as Dictionary<string, object>;
                if (e == null) continue;
                if (!first) sb.Append(",\n");
                first = false;
                sb.Append("  \"").Append(kv.Key).Append("\": {\"salt\": \"").Append(Json.Get(e, "salt"))
                  .Append("\", \"profile\": \"").Append(Json.Get(e, "profile"))
                  .Append("\", \"at\": \"").Append(DateTime.Now.ToString("yyyy-MM-dd HH:mm")).Append("\"}");
            }
            sb.Append("\n}\n");
            File.WriteAllText(Path, sb.ToString(), new UTF8Encoding(false));
        }

        private Dictionary<string, object> Find(string mobile)
        {
            if (string.IsNullOrEmpty(mobile) || !_root.ContainsKey(mobile)) return null;
            return _root[mobile] as Dictionary<string, object>;
        }

        public string PeekProfile(string mobile)
        {
            var e = Find(mobile);
            return e == null ? "" : Json.Get(e, "profile");
        }

        /// <summary>随机机型/未指定时，按盐稳定挑一个机型（同一账号机型不会乱跳）</summary>
        public static string PickProfile(string salt, string want)
        {
            var keys = DeviceTable.ProfileKeys;
            if (!string.IsNullOrEmpty(want))
            {
                foreach (var k in keys) if (k == want) return k;
            }
            int h = 7;
            foreach (var c in (salt ?? "")) h = (h * 131 + c) & 0x7FFFFFF;
            return keys[h % keys.Length];
        }

        public string GetOrCreate(string mobile, string wantProfile, out string profile, out bool fresh)
        {
            profile = "";
            fresh = false;
            var e = Find(mobile);
            if (e != null)
            {
                string salt0 = Json.Get(e, "salt");
                profile = Json.Get(e, "profile");
                if (salt0.Length > 0)
                {
                    if (profile.Length == 0) profile = PickProfile(salt0, wantProfile);
                    return salt0;
                }
            }
            fresh = true;
            string ns = "rnd-" + Guid.NewGuid().ToString("N").Substring(0, 16);
            profile = PickProfile(ns, wantProfile);
            _root[mobile] = new Dictionary<string, object> { { "salt", ns }, { "profile", profile } };
            Save();
            return ns;
        }

        public void Reroll(string mobile, string wantProfile, out string profile)
        {
            _root.Remove(mobile);
            bool dummy;
            GetOrCreate(mobile, wantProfile, out profile, out dummy);
        }
    }

    // ========================================================================
    //  九点八、自检：命令行 --selftest 跑一遍，结果写文件（winexe 没有控制台）
    // ========================================================================
    internal static class SelfTest
    {
        /// <summary>布局体检：越界 / 互相压盖 / 字体是否可用</summary>
        public static void Audit(Control root, StringBuilder sb, int depth)
        {
            var kids = new List<Control>();
            foreach (Control c in root.Controls) kids.Add(c);
            for (int i = 0; i < kids.Count; i++)
            {
                var c = kids[i];
                if (c.Left < 0 || c.Top < 0 || c.Right > root.ClientSize.Width || c.Bottom > root.ClientSize.Height)
                    sb.AppendLine("  ! OOB " + depth + "/" + (c.GetType().Name) + " [" + c.Text + "] " + c.Bounds + " in " + root.GetType().Name + " " + root.ClientSize);
                for (int j = i + 1; j < kids.Count; j++)
                {
                    var d = kids[j];
                    if (!c.Visible || !d.Visible) continue;
                    if (c.Bounds.IntersectsWith(d.Bounds))
                        sb.AppendLine("  ! OVERLAP " + c.GetType().Name + "[" + c.Text + "] " + c.Bounds + " x " + d.GetType().Name + "[" + d.Text + "] " + d.Bounds);
                }
                if (c.Controls.Count > 0) Audit(c, sb, depth + 1);
            }
        }

        public static void Shot(string outPath)
        {
            string target = string.IsNullOrEmpty(outPath) ? System.IO.Path.Combine(System.IO.Path.GetTempPath(), "longhu_ui.png") : outPath;
            var sb = new StringBuilder();
            MainForm f = null;
            try
            {
                f = new MainForm();
                f.StartPosition = FormStartPosition.Manual;
                f.Location = new Point(-4000, -4000);
                f.Show();
                for (int i = 0; i < 8; i++) { Application.DoEvents(); Thread.Sleep(70); }
                int w = f.Width, h = f.Height;
                using (var bmp = new Bitmap(w, h))
                {
                    f.DrawToBitmap(bmp, new Rectangle(0, 0, w, h));
                    bmp.Save(target, System.Drawing.Imaging.ImageFormat.Png);
                }
                sb.AppendLine("shot=" + w + "x" + h + " -> " + target);
                Audit(f, sb, 0);
            }
            catch (Exception e)
            {
                sb.AppendLine("EX " + e.Message);
                sb.AppendLine(e.StackTrace);
            }
            finally
            {
                if (f != null) { try { f.Close(); f.Dispose(); } catch { } }
            }
            File.WriteAllText(target + ".txt", sb.ToString(), new UTF8Encoding(false));
        }

        public static void RunQlTest(string outPath)
        {
            var sb = new StringBuilder();
            sb.AppendLine("== qltest " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " ==");
            const string name = "longhu_qltest_probe";
            try
            {
                var conf = new Ql.Conf();
                var log = new Logger((m, c) => sb.AppendLine("  " + m));
                string tk = Ql.Login(conf);
                sb.AppendLine("login=ok");

                Ql.SaveEnv(conf, tk, name, Ql.MergeValue(new List<string>(), "备注A", "aaa111"), "probe", log);
                var rows1 = Ql.GetEnvs(conf, tk, name);
                int n1 = 0; string v1 = "";
                foreach (var e in rows1) if (Json.Get(e, "name") == name) { n1++; v1 = Json.Get(e, "value"); }
                sb.AppendLine("create.count=" + n1 + " value=" + v1);
                long id1 = 0;
                foreach (var e in rows1) if (Json.Get(e, "name") == name) id1 = (long)Convert.ToDouble(Json.Get(e, "id"), CultureInfo.InvariantCulture);
                sb.AppendLine("create.id=" + id1);

                Ql.SaveEnv(conf, tk, name, Ql.MergeValue(new List<string>(v1.Split('\n')), "备注A", "bbb222"), "probe", log);
                var rows2 = Ql.GetEnvs(conf, tk, name);
                int n2 = 0; string v2 = ""; long id2 = 0;
                foreach (var e in rows2) if (Json.Get(e, "name") == name) { n2++; v2 = Json.Get(e, "value"); id2 = (long)Convert.ToDouble(Json.Get(e, "id"), CultureInfo.InvariantCulture); }
                sb.AppendLine("update.count=" + n2 + " value=" + v2 + " id=" + id2);
                sb.AppendLine("update.sameRow=" + (id1 == id2 && n2 == 1 ? "1" : "0"));

                // 合并语义：写入同一个备注 → 只留一行
                string merged = Ql.MergeValue(new List<string> { "# 说明行", "备注A#aaa111", "备注B#bbb222" }, "备注A", "ccc333");
                sb.AppendLine("merge.result=" + merged.Replace("\n", " / "));

                string del = Http.HttpDelete(conf.Url.TrimEnd('/') + "/api/envs", "[" + id2 + "]", Ql.H(tk));
                sb.AppendLine("cleanup=" + Ql.Short(del));
            }
            catch (Exception e)
            {
                sb.AppendLine("EX: " + e.Message);
            }
            string target = string.IsNullOrEmpty(outPath)
                ? System.IO.Path.Combine(System.IO.Path.GetTempPath(), "longhu_qltest.txt") : outPath;
            File.WriteAllText(target, sb.ToString(), new UTF8Encoding(false));
        }

        public static void Run(string outPath)
        {
            var sb = new StringBuilder();
            try
            {
                sb.AppendLine("== longhu TakeToken selftest " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " ==");
                const long ts = 1700000000000L;
                byte[] seed = Dx.BuildSeed("TESTSALT", DeviceTable.ProfileFields("pixel7"), ts);
                sb.AppendLine("seed.len=" + seed.Length);
                sb.AppendLine("seed.md5=" + Bytes.Md5Hex(seed));
                try
                {
                    File.WriteAllBytes((outPath ?? System.IO.Path.Combine(System.IO.Path.GetTempPath(), "longhu_selftest.txt")) + ".seed.bin", seed);
                }
                catch { }

                var body = new Dictionary<string, object>();
                body["buCode"] = "L00602";
                body["channel"] = "L0";
                body["code"] = "123456";
                body["fingerprint"] = "FPTEST";
                body["prefix"] = "+86";
                body["mobile"] = "MTM4MDAwMDAwMDA=";
                sb.AppendLine("sign.src=" + Sign.Source(body));
                var h = Sign.HeadersAt(body, "app", Consts.SignSecretApp, ts.ToString(CultureInfo.InvariantCulture));
                sb.AppendLine("sign.md5=" + h["X-LONGZHU-Sign"]);

                // 五套机型预设逐套对拍
                foreach (var prof in DeviceTable.ProfileKeys)
                {
                    var one = Dx.BuildSeed("TESTSALT", DeviceTable.ProfileFields(prof), ts);
                    sb.AppendLine("seed." + prof + ".md5=" + Bytes.Md5Hex(one));
                    try
                    {
                        File.WriteAllBytes((outPath ?? System.IO.Path.Combine(System.IO.Path.GetTempPath(), "longhu_selftest.txt")) + ".seed." + prof + ".bin", one);
                    }
                    catch { }
                }

                // 窗体能否正常创建（布局/控件都摸一遍，早发现早修）
                try
                {
                    using (var f = new MainForm())
                    {
                        f.CreateControl();
                        f.PerformLayout();
                    }
                    sb.AppendLine("ui.ok=1");
                }
                catch (Exception ue)
                {
                    sb.AppendLine("ui.err=" + ue.Message);
                }

                try
                {
                    string exeDir = System.IO.Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
                    string root2 = System.IO.Path.GetFullPath(System.IO.Path.Combine(exeDir, "..", ".."));
                    sb.AppendLine("path.exe=" + exeDir);
                    sb.AppendLine("path.root=" + root2);
                    sb.AppendLine("path.rootHasMain=" + (Directory.Exists(System.IO.Path.Combine(root2, "主脚本")) ? "1" : "0"));
                    var store2 = new FingerprintStore(Directory.Exists(System.IO.Path.Combine(root2, "主脚本")) ? root2 : exeDir);
                    sb.AppendLine("path.fpStore=" + store2.Path);
                }
                catch (Exception pe) { sb.AppendLine("path.err=" + pe.Message); }

                string err;
                string fp = Dx.Issue("TESTSALT", "pixel7", out err);
                sb.AppendLine("issue.ok=" + (fp != null ? "1" : "0"));
                if (fp != null) sb.AppendLine("issue.prefix8=" + fp.Substring(0, 8));
                else sb.AppendLine("issue.err=" + err);

                if (fp != null)
                {
                    // 活体校验：故意用错验证码。只要不是 500/小湖忙晕了，就证明签名与头部链路正确
                    var r = Longhu.LoginByCode("13800000000", "000000", fp);
                    sb.AppendLine("live.code=" + r.Code + " extra=" + r.ExtraCode + " msg=" + r.Message + " extraMsg=" + r.ExtraMessage);
                }

                // 指纹簿自检
                var store = new FingerprintStore(System.IO.Path.GetTempPath());
                string prof1, prof2;
                bool fresh;
                string saltA = store.GetOrCreate("13800000000", "", out prof1, out fresh);
                string saltB = store.GetOrCreate("13800000000", "", out prof2, out fresh);
                sb.AppendLine("store.stable=" + (saltA == saltB ? "1" : "0") + " profile=" + prof1 + " salt=" + saltA);
            }
            catch (Exception e)
            {
                sb.AppendLine("EX: " + e.Message);
                sb.AppendLine(e.StackTrace);
            }
            string target = string.IsNullOrEmpty(outPath)
                ? System.IO.Path.Combine(System.IO.Path.GetTempPath(), "longhu_selftest.txt")
                : outPath;
            File.WriteAllText(target, sb.ToString(), new UTF8Encoding(false));
        }
    }

    // ========================================================================
    //  十、设计系统：颜色 / 字体 / 圆角 / 卡片 / 按钮 / 输入框 / 开关
    //      照现代云端控制台的做法：留白优先、弱边框、单一主操作、状态用色点表达
    // ========================================================================
    internal static class Theme
    {
        public static readonly Color Bg = Color.FromArgb(246, 247, 249);
        public static readonly Color Card = Color.White;
        public static readonly Color Line = Color.FromArgb(232, 234, 238);
        public static readonly Color Text = Color.FromArgb(31, 35, 40);
        public static readonly Color Sub = Color.FromArgb(107, 114, 128);
        public static readonly Color Muted = Color.FromArgb(156, 163, 175);
        public static readonly Color Accent = Color.FromArgb(47, 107, 255);
        public static readonly Color AccentHover = Color.FromArgb(32, 89, 232);
        public static readonly Color AccentDown = Color.FromArgb(27, 79, 208);
        public static readonly Color Ok = Color.FromArgb(18, 161, 80);
        public static readonly Color Warn = Color.FromArgb(217, 119, 6);
        public static readonly Color Danger = Color.FromArgb(220, 38, 38);
        public static readonly Color InputLine = Color.FromArgb(223, 227, 232);
        public static readonly Color Field = Color.FromArgb(250, 251, 252);

        public const string FontName = "Microsoft YaHei UI";
        public static readonly Font H1 = new Font(FontName, 15f, FontStyle.Bold);
        public static readonly Font Body = new Font(FontName, 9.5f);
        public static readonly Font BodyBold = new Font(FontName, 9.5f, FontStyle.Bold);
        public static readonly Font Small = new Font(FontName, 8.5f);
        public static readonly Font Mono = new Font("Consolas", 9.5f);
        public static readonly Font MonoSm = new Font("Consolas", 8.5f);

        public static GraphicsPath Round(Rectangle r, int radius)
        {
            var path = new GraphicsPath();
            int d = Math.Max(1, Math.Min(radius * 2, Math.Min(r.Width, r.Height)));
            path.AddArc(r.X, r.Y, d, d, 180, 90);
            path.AddArc(r.Right - d - 1, r.Y, d, d, 270, 90);
            path.AddArc(r.Right - d - 1, r.Bottom - d - 1, d, d, 0, 90);
            path.AddArc(r.X, r.Bottom - d - 1, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        public static void FillRound(Graphics g, Rectangle r, int radius, Color fill)
        {
            using (var path = Round(r, radius))
            using (var b = new SolidBrush(fill)) g.FillPath(b, path);
        }

        public static void StrokeRound(Graphics g, Rectangle r, int radius, Color line, float width)
        {
            using (var path = Round(r, radius))
            using (var pen = new Pen(line, width)) g.DrawPath(pen, path);
        }

        /// <summary>整像素对齐的文本绘制（避免 ClearType 发虚）</summary>
        public static void Txt(Graphics g, string text, Font font, Color color, Rectangle box, ContentAlignment align)
        {
            TextFormatFlags flags = TextFormatFlags.NoPadding | TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine;
            if (align == ContentAlignment.MiddleLeft) flags |= TextFormatFlags.Left | TextFormatFlags.VerticalCenter;
            else if (align == ContentAlignment.MiddleRight) flags |= TextFormatFlags.Right | TextFormatFlags.VerticalCenter;
            else flags |= TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter;
            TextRenderer.DrawText(g, text ?? "", font, box, color, flags);
        }

        public static void Prep(Graphics g)
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        }
    }

    /// <summary>白色圆角卡片，替代老式 GroupBox</summary>
    internal class Card : Panel
    {
        public bool Flat;
        public Card()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                     ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw |
                     ControlStyles.SupportsTransparentBackColor, true);
            BackColor = Color.Transparent;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Theme.Prep(e.Graphics);
            var r = new Rectangle(0, 0, Width - 1, Height - 1);
            if (!Flat) Theme.FillRound(e.Graphics, r, 12, Theme.Card);
            else Theme.FillRound(e.Graphics, r, 12, Color.FromArgb(250, 251, 252));
            Theme.StrokeRound(e.Graphics, r, 12, Theme.Line, 1f);
            base.OnPaint(e);
        }
    }

    /// <summary>主按钮 / 幽灵按钮，自绘圆角 + hover/press/disabled 三态</summary>
    internal class FlatButton : Control
    {
        public enum Kind { Primary, Ghost, Link }

        public Kind Style = Kind.Primary;
        public Color Tint = Color.Empty;
        public Color TintHot = Color.Empty;
        private bool _hover;
        private bool _down;

        public FlatButton()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                     ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw |
                     ControlStyles.SupportsTransparentBackColor | ControlStyles.StandardClick, true);
            BackColor = Color.Transparent;
            Cursor = Cursors.Hand;
            Font = Theme.Body;
            Height = 36;
        }

        protected override void OnMouseEnter(EventArgs e) { _hover = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { _hover = false; _down = false; Invalidate(); base.OnMouseLeave(e); }
        protected override void OnMouseDown(MouseEventArgs e) { _down = true; Invalidate(); base.OnMouseDown(e); }
        protected override void OnMouseUp(MouseEventArgs e) { _down = false; Invalidate(); base.OnMouseUp(e); }
        protected override void OnEnabledChanged(EventArgs e) { Invalidate(); base.OnEnabledChanged(e); }

        protected override void OnPaint(PaintEventArgs e)
        {
            Theme.Prep(e.Graphics);
            var r = new Rectangle(0, 0, Width - 1, Height - 1);
            bool on = Enabled;
            if (Style == Kind.Primary)
            {
                Color fill = !on ? Color.FromArgb(191, 204, 224) : (_down ? Theme.AccentDown : (_hover ? Theme.AccentHover : Theme.Accent));
                Theme.FillRound(e.Graphics, r, 9, fill);
                Theme.Txt(e.Graphics, Text, Font, Color.White, r, ContentAlignment.MiddleCenter);
            }
            else if (Style == Kind.Ghost)
            {
                if (_hover && on) Theme.FillRound(e.Graphics, r, 9, Color.FromArgb(240, 244, 250));
                Theme.StrokeRound(e.Graphics, r, 9, on ? Theme.Line : Color.FromArgb(240, 242, 245), 1f);
                Theme.Txt(e.Graphics, Text, Font, on ? Theme.Text : Theme.Muted, r, ContentAlignment.MiddleCenter);
            }
            else
            {
                Color c = Tint.IsEmpty ? Theme.Accent : Tint;
                if (_hover && on) c = TintHot.IsEmpty ? c : TintHot;
                if (!on) c = Theme.Muted;
                Theme.Txt(e.Graphics, Text, Font, c, r, ContentAlignment.MiddleCenter);
            }
            base.OnPaint(e);
        }
    }

    /// <summary>圆角输入框：外框自绘，里面放一个无边框 TextBox</summary>
    internal class Input : Panel
    {
        private readonly TextBox _tb = new TextBox();
        private string _ph = "";
        private bool _focus;

        public Input()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                     ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw |
                     ControlStyles.SupportsTransparentBackColor, true);
            BackColor = Color.Transparent;
            Height = 38;
            _tb.BorderStyle = BorderStyle.None;
            _tb.Font = Theme.Body;
            _tb.BackColor = Theme.Field;
            _tb.ForeColor = Theme.Text;
            _tb.GotFocus += (o, e) => { _focus = true; Invalidate(); };
            _tb.LostFocus += (o, e) => { _focus = false; Invalidate(); };
            _tb.TextChanged += (o, e) => { Invalidate(); if (TextChanged2 != null) TextChanged2(this, EventArgs.Empty); };
            _tb.KeyDown += (o, e) => { if (KeyDown2 != null) KeyDown2(this, e); };
            Controls.Add(_tb);
        }

        public event EventHandler TextChanged2;
        public event KeyEventHandler KeyDown2;

        public string Placeholder { get { return _ph; } set { _ph = value ?? ""; Invalidate(); } }
        public string Value { get { return _tb.Text; } set { _tb.Text = value ?? ""; } }
        public bool ReadOnly { get { return _tb.ReadOnly; } set { _tb.ReadOnly = value; } }
        public bool UseMono { get { return _tb.Font == Theme.Mono; } set { _tb.Font = value ? Theme.Mono : Theme.Body; } }
        public bool Password { get { return _tb.UseSystemPasswordChar; } set { _tb.UseSystemPasswordChar = value; } }
        public TextBox Inner { get { return _tb; } }

        public void FocusInput() { _tb.Focus(); _tb.SelectionStart = _tb.TextLength; }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            _tb.Bounds = new Rectangle(14, (Height - _tb.PreferredHeight) / 2, Width - 28, _tb.PreferredHeight);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Theme.Prep(e.Graphics);
            var r = new Rectangle(0, 0, Width - 1, Height - 1);
            Theme.FillRound(e.Graphics, r, 9, Theme.Field);
            Theme.StrokeRound(e.Graphics, r, 9, _focus ? Theme.Accent : Theme.InputLine, _focus ? 1.6f : 1f);
            if (Value.Length == 0 && _ph.Length > 0 && !_tb.Focused)
            {
                using (var b = new SolidBrush(Theme.Muted)) e.Graphics.DrawString(_ph, Theme.Body, b, 15, (Height - Theme.Body.Height) / 2f - 1);
            }
            base.OnPaint(e);
        }
    }

    /// <summary>开关（WinForms 没有，只能画一个）</summary>
    internal class Toggle : Control
    {
        private bool _on;
        private bool _hover;

        public Toggle()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                     ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw |
                     ControlStyles.SupportsTransparentBackColor, true);
            BackColor = Color.Transparent;
            Size = new Size(40, 22);
            Cursor = Cursors.Hand;
        }

        public event EventHandler Toggled;
        public bool On { get { return _on; } set { if (_on != value) { _on = value; Invalidate(); } } }

        protected override void OnClick(EventArgs e)
        {
            _on = !_on;
            Invalidate();
            if (Toggled != null) Toggled(this, EventArgs.Empty);
            base.OnClick(e);
        }

        protected override void OnMouseEnter(EventArgs e) { _hover = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { _hover = false; Invalidate(); base.OnMouseLeave(e); }

        protected override void OnPaint(PaintEventArgs e)
        {
            Theme.Prep(e.Graphics);
            var track = new Rectangle(0, 1, Width - 1, Height - 3);
            Color fill = _on ? (_hover ? Theme.AccentHover : Theme.Accent) : (_hover ? Color.FromArgb(214, 219, 226) : Color.FromArgb(226, 230, 236));
            Theme.FillRound(e.Graphics, track, track.Height / 2, fill);
            int d = track.Height - 4;
            int x = _on ? track.Right - d - 2 : track.X + 2;
            using (var b = new SolidBrush(Color.White))
                e.Graphics.FillEllipse(b, x, track.Y + 2, d, d);
            base.OnPaint(e);
        }
    }

    /// <summary>胶囊标签</summary>
    internal class Pill : Control
    {
        public Color Tone = Theme.Ok;
        public bool Outline = true;

        public Pill()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                     ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw |
                     ControlStyles.SupportsTransparentBackColor, true);
            BackColor = Color.Transparent;
            Font = Theme.Small;
            Height = 22;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Theme.Prep(e.Graphics);
            var r = new Rectangle(0, 0, Width - 1, Height - 1);
            Color bg = Color.FromArgb(20, Tone);
            Theme.FillRound(e.Graphics, r, Height / 2, bg);
            Theme.Txt(e.Graphics, Text, Font, Tone, r, ContentAlignment.MiddleCenter);
            base.OnPaint(e);
        }
    }

    /// <summary>步骤序号（实心圆）</summary>
    internal class StepBadge : Control
    {
        public int Num = 1;
        public bool Done;

        public StepBadge()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                     ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw |
                     ControlStyles.SupportsTransparentBackColor, true);
            BackColor = Color.Transparent;
            Size = new Size(22, 22);
            Font = Theme.Small;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Theme.Prep(e.Graphics);
            var r = new Rectangle(0, 0, Width - 1, Height - 1);
            Color fill = Done ? Theme.Ok : Theme.Accent;
            using (var b = new SolidBrush(fill)) e.Graphics.FillEllipse(b, r);
            Theme.Txt(e.Graphics, Done ? "✓" : Num.ToString(), Font, Color.White, r, ContentAlignment.MiddleCenter);
            base.OnPaint(e);
        }
    }

    /// <summary>分隔线</summary>
    internal class HR : Control
    {
        public HR()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                     ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw |
                     ControlStyles.SupportsTransparentBackColor, true);
            Height = 1;
            BackColor = Color.Transparent;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            using (var pen = new Pen(Theme.Line)) e.Graphics.DrawLine(pen, 0, 0, Width, 0);
            base.OnPaint(e);
        }
    }

    internal static class Win
    {
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool ReleaseCapture();
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern IntPtr SendMessage(IntPtr hWnd, int msg, int wParam, int lParam);
        [System.Runtime.InteropServices.DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);

        /// <summary>无边框窗口按住拖动</summary>
        public static void Drag(Form f)
        {
            try
            {
                ReleaseCapture();
                SendMessage(f.Handle, 0xA1, 0x2, 0);
            }
            catch { }
        }

        /// <summary>Win11 圆角（失败就算了）</summary>
        public static void Round(Form f)
        {
            try
            {
                int pref = 2;
                DwmSetWindowAttribute(f.Handle, 33, ref pref, 4);
            }
            catch { }
        }
    }

    // ========================================================================
    //  十一、设置（落盘到项目根，下次开机不用重填）
    // ========================================================================
    internal class Cfg
    {
        public string Path;
        public string QlUrl = Consts.QlUrlDefault;
        public string QlUser = Consts.QlUserDefault;
        public string QlPass = Consts.QlPassDefault;
        public bool WriteDx = true;
        public bool WriteJson = true;
        public bool AutoWrite = true;
        public string Profile = "random";

        public Cfg(string dir)
        {
            Path = System.IO.Path.Combine(dir, "取Token-设置.json");
            try
            {
                if (!File.Exists(Path)) return;
                var d = Json.Obj(Json.Parse(File.ReadAllText(Path, Encoding.UTF8)));
                string v;
                v = Json.Get(d, "qlUrl"); if (v.Length > 0) QlUrl = v;
                v = Json.Get(d, "qlUser"); if (v.Length > 0) QlUser = v;
                v = Json.Get(d, "qlPass"); if (v.Length > 0) QlPass = v;
                v = Json.Get(d, "profile"); if (v.Length > 0) Profile = v;
                v = Json.Get(d, "writeDx"); WriteDx = v != "false";
                v = Json.Get(d, "writeJson"); WriteJson = v != "false";
                v = Json.Get(d, "autoWrite"); AutoWrite = v != "false";
            }
            catch { }
        }

        public void Save()
        {
            try
            {
                var sb = new StringBuilder();
                sb.Append("{\n");
                sb.Append("  \"qlUrl\": \"").Append(QlUrl).Append("\",\n");
                sb.Append("  \"qlUser\": \"").Append(QlUser).Append("\",\n");
                sb.Append("  \"qlPass\": \"").Append(QlPass).Append("\",\n");
                sb.Append("  \"profile\": \"").Append(Profile).Append("\",\n");
                sb.Append("  \"writeDx\": ").Append(WriteDx ? "true" : "false").Append(",\n");
                sb.Append("  \"writeJson\": ").Append(WriteJson ? "true" : "false").Append(",\n");
                sb.Append("  \"autoWrite\": ").Append(AutoWrite ? "true" : "false").Append("\n");
                sb.Append("}\n");
                File.WriteAllText(Path, sb.ToString(), new UTF8Encoding(false));
            }
            catch { }
        }
    }

    // ========================================================================
    //  十二、设置窗口（同一个设计语言，改青龙地址/密码与写入开关）
    // ========================================================================
    internal class SettingsForm : Form
    {
        private readonly Cfg _cfg;
        private Input _url, _user, _pass;
        private Toggle _dx, _json, _auto;

        public SettingsForm(Cfg cfg)
        {
            _cfg = cfg;
            Text = "设置";
            ClientSize = new Size(440, 356);
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterParent;
            BackColor = Theme.Bg;
            Font = Theme.Body;
            DoubleBuffered = true;
            KeyPreview = true;
            KeyDown += (o, e) => { if (e.KeyCode == Keys.Escape) { DialogResult = DialogResult.Cancel; Close(); } };
            Build();
        }

        protected override CreateParams CreateParams
        {
            get { var cp = base.CreateParams; cp.ClassStyle |= 0x00020000; return cp; }
        }

        private Label Cap(string text, int x, int y)
        {
            var l = new Label();
            l.Text = text;
            l.AutoSize = true;
            l.Font = Theme.Small;
            l.ForeColor = Theme.Sub;
            l.Location = new Point(x, y);
            Controls.Add(l);
            return l;
        }

        private void Build()
        {
            var head = new Panel();
            head.Bounds = new Rectangle(0, 0, 440, 56);
            head.BackColor = Theme.Card;
            Controls.Add(head);
            var t = new Label();
            t.Text = "设置";
            t.Font = new Font(Theme.FontName, 12f, FontStyle.Bold);
            t.ForeColor = Theme.Text;
            t.Bounds = new Rectangle(22, 16, 200, 26);
            head.Controls.Add(t);
            head.MouseDown += (o, e) => { Win.Drag(this); };
            head.Cursor = Cursors.SizeAll;

            var card = new Card();
            card.Bounds = new Rectangle(16, 68, 408, 214);
            Controls.Add(card);

            var cap1 = new Label(); cap1.Text = "青龙地址"; cap1.AutoSize = true; cap1.Font = Theme.Small; cap1.ForeColor = Theme.Sub; cap1.Location = new Point(18, 16); card.Controls.Add(cap1);
            _url = new Input(); _url.Bounds = new Rectangle(18, 36, 372, 38); _url.Value = _cfg.QlUrl; card.Controls.Add(_url);

            var cap2 = new Label(); cap2.Text = "账号"; cap2.AutoSize = true; cap2.Font = Theme.Small; cap2.ForeColor = Theme.Sub; cap2.Location = new Point(18, 82); card.Controls.Add(cap2);
            _user = new Input(); _user.Bounds = new Rectangle(18, 102, 170, 38); _user.Value = _cfg.QlUser; card.Controls.Add(_user);

            var cap3 = new Label(); cap3.Text = "密码"; cap3.AutoSize = true; cap3.Font = Theme.Small; cap3.ForeColor = Theme.Sub; cap3.Location = new Point(204, 82); card.Controls.Add(cap3);
            _pass = new Input(); _pass.Bounds = new Rectangle(204, 102, 186, 38); _pass.Password = true; _pass.Value = _cfg.QlPass; card.Controls.Add(_pass);

            var line = new HR(); line.Bounds = new Rectangle(18, 152, 372, 1); card.Controls.Add(line);

            _dx = new Toggle(); _dx.Bounds = new Rectangle(18, 164, 40, 22); _dx.On = _cfg.WriteDx; card.Controls.Add(_dx);
            var l1 = new Label(); l1.Text = "同时写 longhu_dx（登录与签到同一台设备）"; l1.AutoSize = true; l1.ForeColor = Theme.Text; l1.Location = new Point(66, 166); card.Controls.Add(l1);

            _json = new Toggle(); _json.Bounds = new Rectangle(18, 190, 40, 22); _json.On = _cfg.WriteJson; card.Controls.Add(_json);
            var l2 = new Label(); l2.Text = "同时写本地 longhu_token.json"; l2.AutoSize = true; l2.ForeColor = Theme.Text; l2.Location = new Point(66, 192); card.Controls.Add(l2);

            _auto = new Toggle(); _auto.Bounds = new Rectangle(240, 190, 40, 22); _auto.On = _cfg.AutoWrite; card.Controls.Add(_auto);
            var l3 = new Label(); l3.Text = "登录成功即自动写入青龙"; l3.AutoSize = true; l3.ForeColor = Theme.Text; l3.Location = new Point(288, 192); card.Controls.Add(l3);

            var btnSave = new FlatButton(); btnSave.Text = "保存"; btnSave.Bounds = new Rectangle(16, 296, 200, 40); btnSave.Click += btnSave_Click; Controls.Add(btnSave);
            var btnCancel = new FlatButton(); btnCancel.Style = FlatButton.Kind.Ghost; btnCancel.Text = "取消"; btnCancel.Bounds = new Rectangle(224, 296, 200, 40); btnCancel.Click += (o, e) => { DialogResult = DialogResult.Cancel; Close(); }; Controls.Add(btnCancel);
        }

        private void btnSave_Click(object sender, EventArgs e)
        {
            _cfg.QlUrl = _url.Value.Trim();
            _cfg.QlUser = _user.Value.Trim();
            _cfg.QlPass = _pass.Value;
            _cfg.WriteDx = _dx.On;
            _cfg.WriteJson = _json.On;
            _cfg.AutoWrite = _auto.On;
            _cfg.Save();
            DialogResult = DialogResult.OK;
            Close();
        }
    }

    // ========================================================================
    //  十三、主窗体
    // ========================================================================
    internal class MainForm : Form
    {
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern bool ReleaseCapture();
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern IntPtr SendMessage(IntPtr hWnd, int msg, int wParam, int lParam);
        [System.Runtime.InteropServices.DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);

        private string _root;
        private Cfg _cfg;
        private FingerprintStore _fpStore;
        private Logger _logger;
        private readonly List<string> _written = new List<string>();

        private Input _mobile, _remark, _code, _token;
        private FlatButton _btnSend, _btnLogin, _btnCopy, _btnProfile, _btnGear, _btnClose, _btnReroll;
        private Toggle _random;
        private Pill _fpPill;
        private StepBadge _b1, _b2, _b3;
        private Label _info, _writeNote, _status, _sessEmpty;
        private RichTextBox _log;
        private System.Windows.Forms.Timer _tick;
        private int _cooldown;

        private string _fingerprint;
        private string _gotToken;
        private string _profile;

        public MainForm()
        {
            Text = "龙湖天街 · 取 Token";
            ClientSize = new Size(520, 716);
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Theme.Bg;
            Font = Theme.Body;
            DoubleBuffered = true;
            Text = "龙湖天街 · 取 Token";

            string exeDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            _root = Path.GetFullPath(Path.Combine(exeDir, "..", ".."));
            if (!Directory.Exists(Path.Combine(_root, "主脚本"))) _root = exeDir;
            _cfg = new Cfg(_root);
            _fpStore = new FingerprintStore(_root);

            BuildUi();
            _logger = new Logger(AppendLog);
            _logger.Dim("指纹簿 " + _fpStore.Path);
            _logger.Dim("设置文件 " + _cfg.Path + (_cfg.AutoWrite ? "（已开启登录后自动写入青龙）" : "（自动写入已关闭）"));
            RefreshFpHint();
            SetStatus("就绪", Theme.Muted);
        }

        protected override CreateParams CreateParams
        {
            get { var cp = base.CreateParams; cp.ClassStyle |= 0x00020000; return cp; }
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            Win.Round(this);
        }

        // ---------------- 布局 ----------------

        private Label Cap(Control parent, string text, int x, int y, int w, Color c, Font f)
        {
            var l = new Label();
            l.Text = text;
            l.Bounds = new Rectangle(x, y, w, 18);
            l.ForeColor = c;
            l.Font = f;
            l.BackColor = Color.Transparent;
            parent.Controls.Add(l);
            return l;
        }

        private void BuildUi()
        {
            // ---- 顶栏：可拖动 + 设置 + 关闭 ----
            var head = new Panel();
            head.Bounds = new Rectangle(0, 0, 520, 68);
            head.BackColor = Theme.Card;
            Controls.Add(head);
            head.MouseDown += (o, e) => { DragMove(); };

            var title = new Label();
            title.Text = "龙湖天街";
            title.Font = Theme.H1;
            title.ForeColor = Theme.Text;
            title.Bounds = new Rectangle(22, 12, 200, 26);
            title.BackColor = Color.Transparent;
            title.MouseDown += (o, e) => { DragMove(); };
            head.Controls.Add(title);

            var sub = new Label();
            sub.Text = "取 Token · 手机号登录 · 自动续期";
            sub.Font = Theme.Small;
            sub.ForeColor = Theme.Sub;
            sub.Bounds = new Rectangle(23, 41, 300, 18);
            sub.BackColor = Color.Transparent;
            sub.MouseDown += (o, e) => { DragMove(); };
            head.Controls.Add(sub);

            _btnGear = new FlatButton();
            _btnGear.Style = FlatButton.Kind.Ghost;
            _btnGear.Text = "设置";
            _btnGear.Font = Theme.Small;
            _btnGear.Bounds = new Rectangle(408, 18, 58, 30);
            _btnGear.Click += btnGear_Click;
            head.Controls.Add(_btnGear);

            _btnClose = new FlatButton();
            _btnClose.Style = FlatButton.Kind.Link;
            _btnClose.Tint = Theme.Sub;
            _btnClose.TintHot = Theme.Danger;
            _btnClose.Text = "✕";
            _btnClose.Bounds = new Rectangle(474, 18, 28, 30);
            _btnClose.Click += (o, e) => Close();
            head.Controls.Add(_btnClose);

            var headLine = new HR();
            headLine.Bounds = new Rectangle(0, 67, 520, 1);
            head.Controls.Add(headLine);

            // ---- 步骤一：手机号 ----
            var c1 = new Card();
            c1.Bounds = new Rectangle(20, 84, 480, 124);
            Controls.Add(c1);
            _b1 = new StepBadge(); _b1.Num = 1; _b1.Bounds = new Rectangle(16, 18, 22, 22); c1.Controls.Add(_b1);
            Cap(c1, "手机号", 48, 20, 120, Theme.Sub, Theme.Small);
            _mobile = new Input();
            _mobile.Bounds = new Rectangle(16, 42, 190, 38);
            _mobile.Placeholder = "11 位手机号";
            _mobile.Inner.MaxLength = 11;
            _mobile.TextChanged2 += (o, e) => RefreshFpHint();
            c1.Controls.Add(_mobile);
            Cap(c1, "备注", 212, 20, 120, Theme.Sub, Theme.Small);
            _remark = new Input();
            _remark.Bounds = new Rectangle(212, 42, 118, 38);
            _remark.Placeholder = "可留空";
            c1.Controls.Add(_remark);

            _btnSend = new FlatButton();
            _btnSend.Style = FlatButton.Kind.Primary;
            _btnSend.Text = "获取验证码";
            _btnSend.Bounds = new Rectangle(336, 42, 128, 38);
            _btnSend.Click += btnSend_Click;
            c1.Controls.Add(_btnSend);

            _btnProfile = new FlatButton();
            _btnProfile.Style = FlatButton.Kind.Ghost;
            _btnProfile.Font = Theme.Small;
            _btnProfile.Bounds = new Rectangle(16, 88, 132, 30);
            _btnProfile.Click += (o, e) => CycleProfile();
            c1.Controls.Add(_btnProfile);

            _random = new Toggle();
            _random.Bounds = new Rectangle(160, 92, 40, 22);
            _random.On = true;
            _random.Toggled += (o, e) => RefreshFpHint();
            c1.Controls.Add(_random);
            var rlab = new Label();
            rlab.Text = "随机设备指纹";
            rlab.AutoSize = true;
            rlab.ForeColor = Theme.Text;
            rlab.Font = Theme.Small;
            rlab.Location = new Point(208, 94);
            rlab.BackColor = Color.Transparent;
            c1.Controls.Add(rlab);

            _fpPill = new Pill();
            _fpPill.Bounds = new Rectangle(336, 92, 96, 22);
            _fpPill.Tone = Theme.Muted;
            _fpPill.Text = "新号 · 待分配";
            c1.Controls.Add(_fpPill);

            _btnReroll = new FlatButton();
            _btnReroll.Style = FlatButton.Kind.Link;
            _btnReroll.Font = new Font(Theme.FontName, 11f);
            _btnReroll.Text = "⟳";
            _btnReroll.Bounds = new Rectangle(438, 86, 30, 30);
            _btnReroll.Click += btnReroll_Click;
            c1.Controls.Add(_btnReroll);
            var tip = new ToolTip();
            tip.SetToolTip(_btnReroll, "为这个号换一台设备（会重新随机指纹，签到需同步 longhu_dx）");

            // ---- 步骤二：验证码 ----
            var c2 = new Card();
            c2.Bounds = new Rectangle(20, 220, 480, 100);
            Controls.Add(c2);
            _b2 = new StepBadge(); _b2.Num = 2; _b2.Bounds = new Rectangle(16, 18, 22, 22); c2.Controls.Add(_b2);
            Cap(c2, "短信验证码", 48, 20, 200, Theme.Sub, Theme.Small);
            _code = new Input();
            _code.Bounds = new Rectangle(16, 42, 160, 38);
            _code.Placeholder = "6 位数字";
            _code.Inner.MaxLength = 8;
            _code.KeyDown2 += (o, e) => { if (e.KeyCode == Keys.Enter) btnLogin_Click(null, EventArgs.Empty); };
            c2.Controls.Add(_code);
            _btnLogin = new FlatButton();
            _btnLogin.Text = "登录并校验";
            _btnLogin.Bounds = new Rectangle(188, 42, 276, 38);
            _btnLogin.Click += btnLogin_Click;
            c2.Controls.Add(_btnLogin);

            // ---- 步骤三：Token ----
            var c3 = new Card();
            c3.Bounds = new Rectangle(20, 332, 480, 132);
            Controls.Add(c3);
            _b3 = new StepBadge(); _b3.Num = 3; _b3.Bounds = new Rectangle(16, 18, 22, 22); c3.Controls.Add(_b3);
            Cap(c3, "Token", 48, 20, 200, Theme.Sub, Theme.Small);
            _token = new Input();
            _token.Bounds = new Rectangle(16, 42, 340, 38);
            _token.Placeholder = "登录成功后自动填入";
            _token.ReadOnly = true;
            _token.UseMono = true;
            c3.Controls.Add(_token);
            _btnCopy = new FlatButton();
            _btnCopy.Style = FlatButton.Kind.Ghost;
            _btnCopy.Text = "复制";
            _btnCopy.Bounds = new Rectangle(364, 42, 100, 38);
            _btnCopy.Click += btnCopy_Click;
            c3.Controls.Add(_btnCopy);
            _info = Cap(c3, "", 16, 84, 448, Theme.Sub, Theme.Small);
            _writeNote = Cap(c3, "", 16, 104, 448, Theme.Ok, Theme.Small);

            // ---- 本次已写入 ----
            var c4 = new Card();
            c4.Flat = true;
            c4.Bounds = new Rectangle(20, 476, 480, 76);
            Controls.Add(c4);
            Cap(c4, "本次已写入", 16, 12, 200, Theme.Sub, Theme.Small);
            _sessEmpty = Cap(c4, "还没有，先把第一个号走完 ①→②→③", 16, 40, 440, Theme.Muted, Theme.Small);

            // ---- 日志 ----
            var c5 = new Card();
            c5.Bounds = new Rectangle(20, 564, 480, 104);
            Controls.Add(c5);
            Cap(c5, "运行日志", 16, 10, 200, Theme.Sub, Theme.Small);
            _log = new RichTextBox();
            _log.Bounds = new Rectangle(12, 32, 456, 62);
            _log.ReadOnly = true;
            _log.BorderStyle = BorderStyle.None;
            _log.BackColor = Theme.Card;
            _log.Font = Theme.MonoSm;
            _log.ScrollBars = RichTextBoxScrollBars.Vertical;
            c5.Controls.Add(_log);

            // ---- 底部状态 ----
            _status = Cap(this, "就绪", 20, 682, 284, Theme.Muted, Theme.Small);
            var foot = new Label();
            foot.Text = "自用工具 · 只调官方接口";
            foot.Font = Theme.Small;
            foot.ForeColor = Theme.Muted;
            foot.AutoSize = false;
            foot.TextAlign = ContentAlignment.MiddleRight;
            foot.Bounds = new Rectangle(320, 682, 180, 18);
            foot.BackColor = Color.Transparent;
            Controls.Add(foot);

            UpdateProfileButton();
        }

        private void DragMove()
        {
            Win.Drag(this);
        }

        // ---------------- 小状态 ----------------

        private void SetStatus(string text, Color tone)
        {
            if (_status == null) return;
            _status.Text = "● " + text;
            _status.ForeColor = tone;
        }

        private void AppendLog(string s, Color c)
        {
            if (_log == null) return;
            if (InvokeRequired) { BeginInvoke((Action<string, Color>)AppendLog, s, c); return; }
            _log.SelectionStart = _log.TextLength;
            _log.SelectionLength = 0;
            _log.SelectionColor = Color.FromArgb(120, 120, 120);
            _log.AppendText(DateTime.Now.ToString("HH:mm:ss") + "  ");
            _log.SelectionStart = _log.TextLength;
            _log.SelectionColor = c;
            _log.AppendText(s + "\n");
            _log.SelectionStart = _log.TextLength;
            _log.ScrollToCaret();
        }

        private void Busy(bool on)
        {
            _btnSend.Enabled = !on;
            _btnLogin.Enabled = !on;
            _btnGear.Enabled = !on;
            Cursor = on ? Cursors.WaitCursor : Cursors.Default;
        }

        private void CycleProfile()
        {
            string[] keys = DeviceTable.ProfileKeys;
            int i = Array.IndexOf(keys, _cfg.Profile);
            i++;
            _cfg.Profile = i >= keys.Length ? "random" : keys[i];
            _cfg.Save();
            UpdateProfileButton();
            RefreshFpHint();
        }

        private void UpdateProfileButton()
        {
            if (_btnProfile == null) return;
            _btnProfile.Text = _cfg.Profile == "random" ? "机型 · 随机" : "机型 · " + _cfg.Profile;
        }

        private void RefreshFpHint()
        {
            if (_fpPill == null) return;
            if (!_random.On)
            {
                _fpPill.Text = "派生 · 按手机号";
                _fpPill.Tone = Theme.Muted;
                return;
            }
            string m = _mobile == null ? "" : _mobile.Value.Trim();
            string prof = _fpStore.PeekProfile(m);
            if (prof.Length > 0)
            {
                _fpPill.Text = "已有 · " + (prof.Length > 9 ? prof.Substring(0, 9) : prof);
                _fpPill.Tone = Theme.Ok;
            }
            else
            {
                _fpPill.Text = "新号 · 待分配";
                _fpPill.Tone = Theme.Muted;
            }
        }

        private void btnReroll_Click(object sender, EventArgs e)
        {
            string mobile = _mobile.Value.Trim();
            if (!IsMobile(mobile))
            {
                SetStatus("先填手机号，再换设备", Theme.Warn);
                _mobile.FocusInput();
                return;
            }
            string prof;
            _fpStore.Reroll(mobile, _cfg.Profile, out prof);
            _logger.Warn("已为 " + MaskMobile(mobile) + " 换新设备（机型 " + prof + "），旧指纹作废");
            SetStatus("已换设备，重新发码即可", Theme.Warn);
            RefreshFpHint();
        }

        private void btnGear_Click(object sender, EventArgs e)
        {
            using (var f = new SettingsForm(_cfg))
            {
                if (f.ShowDialog(this) == DialogResult.OK)
                {
                    _logger.Info("设置已保存（自动写入青龙：" + (_cfg.AutoWrite ? "开" : "关") + "）");
                }
            }
        }

        // ---------------- ① 发码 ----------------

        private async void btnSend_Click(object sender, EventArgs e)
        {
            if (_cooldown > 0)
            {
                _logger.Warn("再等 " + _cooldown + " 秒再发，服务端有频控");
                return;
            }
            string mobile = _mobile.Value.Trim();
            if (!IsMobile(mobile))
            {
                SetStatus("手机号格式不对（11 位，1 开头）", Theme.Danger);
                _mobile.FocusInput();
                return;
            }

            string salt, profile, source;
            bool fresh;
            if (_random.On)
            {
                salt = _fpStore.GetOrCreate(mobile, _cfg.Profile, out profile, out fresh);
                source = fresh ? "随机·新记账" : "随机·复用";
            }
            else
            {
                salt = mobile;
                profile = FingerprintStore.PickProfile(salt, _cfg.Profile);
                source = "按手机号派生";
            }
            _profile = profile;
            RefreshFpHint();

            Busy(true);
            SetStatus("签发设备指纹…", Theme.Muted);
            try
            {
                string fp = null, err = null;
                await Task.Run(() => { fp = Dx.Issue(salt, profile, out err); });
                if (fp == null)
                {
                    SetStatus("指纹签发失败", Theme.Danger);
                    _logger.Err(err);
                    return;
                }
                _fingerprint = fp;
                _logger.Ok("指纹 " + Mask(fp) + "（" + source + "，机型 " + profile + "）");
                _b1.Done = false;

                SetStatus("正在发送验证码…", Theme.Muted);
                ApiResult r = null;
                await Task.Run(() => { r = Longhu.SendSms(mobile, fp, null); });

                if (r.Code == "909001")
                {
                    _logger.Warn("服务端要人机验证，正在打开浏览器让你拖一次滑块…");
                    string risk = await Task.Run(() => SolveCaptcha(fp));
                    if (string.IsNullOrEmpty(risk))
                    {
                        SetStatus("滑块没通过", Theme.Danger);
                        _logger.Err("滑块未通过；可改用抓包方式导入 token（README 方式 B）");
                        return;
                    }
                    _logger.Ok("滑块通过，继续发码");
                    await Task.Run(() => { r = Longhu.SendSms(mobile, fp, risk); });
                }

                if (r.Ok)
                {
                    _b1.Done = true;
                    _b1.Invalidate();
                    SetStatus("验证码已发送，请查收短信", Theme.Ok);
                    _logger.Ok("验证码已发出 → " + mobile);
                    StartCooldown(60);
                    _code.FocusInput();
                }
                else
                {
                    SetStatus(Longhu.Explain(r), Theme.Danger);
                    _logger.Err("发码失败 " + r.Talk());
                    if (r.Raw.Length > 0) _logger.Dim(Ql.Short(r.Raw));
                }
            }
            catch (Exception ex)
            {
                SetStatus("异常，见日志", Theme.Danger);
                _logger.Err("发码异常 " + ex.Message);
            }
            finally { Busy(false); }
        }

        private void StartCooldown(int seconds)
        {
            _cooldown = seconds;
            if (_tick == null)
            {
                _tick = new System.Windows.Forms.Timer();
                _tick.Interval = 1000;
                _tick.Tick += (o, e) =>
                {
                    if (_cooldown <= 0)
                    {
                        _tick.Stop();
                        _btnSend.Text = "获取验证码";
                        _btnSend.Enabled = true;
                        return;
                    }
                    _cooldown--;
                    _btnSend.Text = "重新发送 " + _cooldown + "s";
                    _btnSend.Enabled = false;
                };
            }
            _btnSend.Text = "重新发送 " + _cooldown + "s";
            _btnSend.Enabled = false;
            _tick.Start();
        }

        private string SolveCaptcha(string fp)
        {
            CaptchaServer srv = null;
            try
            {
                srv = new CaptchaServer(fp);
                string url = "http://127.0.0.1:" + srv.Port + "/";
                _logger.Info("滑块页 " + url + "（85 秒内拖一次）");
                try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
                catch { _logger.Warn("浏览器没拉起来，手动打开上面的地址"); }
                string tk = srv.Wait(TimeSpan.FromSeconds(85));
                return string.IsNullOrEmpty(tk) ? null : tk + ":" + fp;
            }
            catch (Exception e)
            {
                _logger.Err("滑块页启动失败 " + e.Message);
                return null;
            }
            finally { if (srv != null) srv.Stop(); }
        }

        // ---------------- ② 登录 ----------------

        private async void btnLogin_Click(object sender, EventArgs e)
        {
            string mobile = _mobile.Value.Trim();
            string code = _code.Value.Trim();
            if (!IsMobile(mobile)) { SetStatus("先填手机号", Theme.Danger); _mobile.FocusInput(); return; }
            if (code.Length < 4) { SetStatus("先填验证码", Theme.Danger); _code.FocusInput(); return; }
            if (string.IsNullOrEmpty(_fingerprint))
            {
                SetStatus("先点「获取验证码」，指纹要先签出来", Theme.Danger);
                return;
            }

            Busy(true);
            SetStatus("登录中…", Theme.Muted);
            try
            {
                ApiResult r = null;
                await Task.Run(() => { r = Longhu.LoginByCode(mobile, code, _fingerprint); });
                string token = Json.Get(r.Data, "token");
                if (!r.Ok || token.Length == 0)
                {
                    SetStatus(Longhu.Explain(r), Theme.Danger);
                    _logger.Err("登录失败 " + r.Talk());
                    if (r.Raw.Length > 0) _logger.Dim(Ql.Short(r.Raw));
                    return;
                }

                _gotToken = token;
                _token.Value = token;
                _b2.Done = true;
                _b2.Invalidate();
                SetStatus("登录成功", Theme.Ok);
                _logger.Ok("token " + token);
                if (Json.Get(r.Data, "isNew") == "true") _logger.Info("这是一个新注册的龙湖号");

                await VerifyAndRefresh(token);
                await AutoWrite(mobile);
            }
            catch (Exception ex)
            {
                SetStatus("异常，见日志", Theme.Danger);
                _logger.Err("登录异常 " + ex.Message);
            }
            finally { Busy(false); }
        }

        private async Task VerifyAndRefresh(string token)
        {
            ApiResult info = null;
            await Task.Run(() => { info = Longhu.UserInfo(token); });
            if (!info.Ok)
            {
                _logger.Err("token 校验失败 " + Longhu.Explain(info));
                return;
            }
            string nick = Json.Get(info.Data, "nickName");
            if (nick.Length == 0) nick = Json.Get(info.Data, "nickname");
            string phone = Json.Get(info.Data, "desensitizePhone");
            string growth = Json.Get(info.Data, "growthValue");
            string level = Json.Get(info.Data, "levelName");
            _info.Text = (nick.Length > 0 ? nick : "珑珠用户") + "   " + phone + "   成长值 " + growth + (level.Length > 0 ? "   " + level : "");
            _logger.Ok("校验通过：" + _info.Text);

            string newToken = null;
            ApiResult rf = null;
            await Task.Run(() => { rf = Longhu.Refresh(token, out newToken); });
            if (rf.Ok && !string.IsNullOrEmpty(newToken))
            {
                _logger.Ok("续期成功，有效期重置 30 天" + (newToken == token ? "（token 未变）" : "（已换成新 token）"));
                if (newToken != token)
                {
                    _gotToken = newToken;
                    _token.Value = newToken;
                }
            }
            else _logger.Warn("续期失败 " + Longhu.Explain(rf) + "（签到脚本每天会再试）");
        }

        // ---------------- ③ 写入青龙 ----------------

        private async Task AutoWrite(string mobile)
        {
            if (string.IsNullOrEmpty(_gotToken)) return;
            string remark = _remark.Value.Trim();
            if (remark.Length == 0) remark = MaskMobile(mobile);

            if (!_cfg.AutoWrite)
            {
                _writeNote.ForeColor = Theme.Muted;
                _writeNote.Text = "自动写入已关闭（右上「设置」里可打开）";
                return;
            }

            var conf = new Ql.Conf { Url = _cfg.QlUrl, User = _cfg.QlUser, Pass = _cfg.QlPass };
            _writeNote.ForeColor = Theme.Sub;
            _writeNote.Text = "正在写入青龙…";
            string token = _gotToken;
            try
            {
                await Task.Run(() => DoWriteQl(conf, remark, token));
                _writeNote.ForeColor = Theme.Ok;
                _writeNote.Text = "已写入青龙，会话里已有 " + _written.Count + " 个号";
                _b3.Done = true;
                _b3.Invalidate();
                SetStatus("这个号搞定了，接着填下一个", Theme.Ok);
                if (_cfg.WriteJson) await Task.Run(() => WriteLocalJson(remark, token));
                ResetForNext();
            }
            catch (Exception ex)
            {
                _writeNote.ForeColor = Theme.Danger;
                _writeNote.Text = "写入失败：" + ex.Message + "（右上「设置」检查青龙地址/密码）";
                _logger.Err("写入青龙失败 " + ex.Message);
            }
        }

        private void DoWriteQl(Ql.Conf conf, string remark, string token)
        {
            string tk = Ql.Login(conf);
            _logger.Ok("青龙登录成功 " + conf.Url);

            var old = Ql.GetEnvs(conf, tk, Consts.QlEnvName);
            var lines = new List<string>();
            foreach (var env in old)
            {
                if (Json.Get(env, "name") != Consts.QlEnvName) continue;
                foreach (var ln in Json.Get(env, "value").Split('\n')) lines.Add(ln);
            }
            string merged = Ql.MergeValue(lines, remark, token);
            Ql.SaveEnv(conf, tk, Consts.QlEnvName, merged, "龙湖天街 token，每行 备注#token", _logger);
            var check = Ql.GetEnvs(conf, tk, Consts.QlEnvName);
            string got = "";
            foreach (var env in check) if (Json.Get(env, "name") == Consts.QlEnvName) got = Json.Get(env, "value");
            if (!got.Contains(token)) throw new Exception("回读里没找到新 token");
            _logger.Ok("longhu_token 已更新并回读一致");

            if (_cfg.WriteDx && !string.IsNullOrEmpty(_fingerprint))
            {
                var oldDx = Ql.GetEnvs(conf, tk, "longhu_dx");
                var dl = new List<string>();
                foreach (var env in oldDx)
                {
                    if (Json.Get(env, "name") != "longhu_dx") continue;
                    foreach (var ln in Json.Get(env, "value").Split('\n')) dl.Add(ln);
                }
                string dm = Ql.MergeValue(dl, remark, _fingerprint);
                Ql.SaveEnv(conf, tk, "longhu_dx", dm, "龙湖天街 设备指纹，备注#指纹", _logger);
                _logger.Ok("longhu_dx 已对齐（签到用同一台设备）");
            }
        }

        private void ResetForNext()
        {
            string remark = _remark.Value.Trim();
            string label = remark.Length > 0 ? remark : MaskMobile(_mobile.Value.Trim());
            if (!_written.Contains(label)) _written.Add(label);
            DrawChips();
            _mobile.Value = "";
            _remark.Value = "";
            _code.Value = "";
            _token.Value = "";
            _info.Text = "";
            _writeNote.Text = "";
            _b1.Done = false; _b2.Done = false; _b3.Done = false;
            _b1.Invalidate(); _b2.Invalidate(); _b3.Invalidate();
            _gotToken = null;
            _fingerprint = null;
            RefreshFpHint();
            _mobile.FocusInput();
        }

        private void DrawChips()
        {
            _sessEmpty.Visible = _written.Count == 0;
            var card = _sessEmpty.Parent;
            for (int i = card.Controls.Count - 1; i >= 0; i--)
                if (card.Controls[i] is Pill) card.Controls.RemoveAt(i);

            int x = 16;
            int shown = 0;
            foreach (var name in _written)
            {
                if (shown >= 3) break;
                var p = new Pill();
                p.Tone = Theme.Ok;
                p.Text = name;
                int w = TextRenderer.MeasureText(name, Theme.Small).Width + 24;
                p.Bounds = new Rectangle(x, 38, w, 22);
                card.Controls.Add(p);
                x += w + 8;
                shown++;
            }
            if (_written.Count > 3)
            {
                var more = new Pill();
                more.Tone = Theme.Muted;
                more.Text = "+" + (_written.Count - 3);
                more.Bounds = new Rectangle(x, 38, 40, 22);
                card.Controls.Add(more);
            }
        }

        private void WriteLocalJson(string remark, string token)
        {
            try
            {
                string target = System.IO.Path.Combine(_root, "longhu_token.json");
                string json = "{\n  \"accounts\": [\n    {\n      \"token\": \"" + token + "\",\n      \"phone\": \"" + remark + "\",\n      \"savedAt\": \"" + DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss") + "\"\n    }\n  ],\n  \"source\": \"龙湖取Token.exe\"\n}\n";
                File.WriteAllText(target, json, new UTF8Encoding(false));
                _logger.Info("本地落盘 " + target);
            }
            catch (Exception e) { _logger.Warn("本地落盘失败 " + e.Message); }
        }

        private void btnCopy_Click(object sender, EventArgs e)
        {
            if (string.IsNullOrEmpty(_gotToken)) return;
            try { Clipboard.SetText(_gotToken); _logger.Info("token 已复制"); }
            catch { }
        }

        // ---------------- 工具 ----------------

        private static bool IsMobile(string s)
        {
            if (s == null || s.Length != 11 || s[0] != '1') return false;
            for (int i = 0; i < s.Length; i++) if (!char.IsDigit(s[i])) return false;
            return true;
        }

        private static string Mask(string t)
        {
            if (string.IsNullOrEmpty(t)) return "(空)";
            if (t.Length <= 10) return t.Substring(0, 2) + "****";
            return t.Substring(0, 6) + "****" + t.Substring(t.Length - 4);
        }

        private static string MaskMobile(string m)
        {
            if (string.IsNullOrEmpty(m) || m.Length < 7) return m ?? "";
            return m.Substring(0, 3) + "****" + m.Substring(m.Length - 4);
        }
    }

    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            if (args != null && args.Length > 0 && args[0] == "--selftest")
            {
                SelfTest.Run(args.Length > 1 ? args[1] : null);
                return;
            }
            if (args != null && args.Length > 0 && args[0] == "--qltest")
            {
                SelfTest.RunQlTest(args.Length > 1 ? args[1] : null);
                return;
            }
            if (args != null && args.Length > 0 && args[0] == "--shot")
            {
                SelfTest.Shot(args.Length > 1 ? args[1] : null);
                return;
            }
            try { Application.EnableVisualStyles(); } catch { }
            Application.SetCompatibleTextRenderingDefault(false);
            try { Application.Run(new MainForm()); }
            catch (Exception e)
            {
                MessageBox.Show("启动失败：" + e.Message, "龙湖天街 · 取 Token", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
