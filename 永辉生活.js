/*
永辉生活 v1.01

登录前开启捉包, 捉登录包响应里面的uid和refreshToken
把捉包或者网页登录获取的uid,refreshToken和备注(非必须)填到文件 yhshCookie.txt 里(第一次运行会自动创建), 多账号换行写
uid#refreshToken#备注
例子: 
123456789321654987#12345678-1345-3546-69c3-xxxxxxxxxxxx#doubi
679113468143213246#yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy#huoge

自动签到和组队互助
目前组队互助是积分大头, 一队需要3个号, N个号可以组满N/2队
500积分可以抵扣1元(上限貌似是抵扣20%), 小毛

cron: 16 7,8,20 * * *
const $ = new Env("永辉生活");
*/
const _0x5827a5 = _0x2f9b;
(function (_0xb42f5f, _0x591081) {
	const _0x4c7bb8 = _0x2f9b,
		_0x528619 = _0xb42f5f();
	while (true) {
		try {
			const _0x5143cf =
				(-parseInt(_0x4c7bb8(606)) / 1) * (parseInt(_0x4c7bb8(218)) / 2) +
				parseInt(_0x4c7bb8(175)) / 3 +
				(-parseInt(_0x4c7bb8(227)) / 4) * (-parseInt(_0x4c7bb8(397)) / 5) +
				(-parseInt(_0x4c7bb8(173)) / 6) * (parseInt(_0x4c7bb8(258)) / 7) +
				-parseInt(_0x4c7bb8(199)) / 8 +
				(parseInt(_0x4c7bb8(539)) / 9) * (-parseInt(_0x4c7bb8(422)) / 10) +
				parseInt(_0x4c7bb8(515)) / 11;
			if (_0x5143cf === _0x591081) {
				break;
			} else {
				_0x528619.push(_0x528619.shift());
			}
		} catch (_0x418407) {
			_0x528619.push(_0x528619.shift());
		}
	}
})(_0x5b32, 175931);
const _0x454ec0 = _0x427c74(_0x5827a5(620)),
	_0x408278 = require("fs"),
	_0xbc0ee4 = require("got"),
	{ CookieJar: _0x3e25a4 } = require("tough" + _0x5827a5(552) + "ie"),
	_0x43b4a6 = _0x5827a5(496),
	_0x4031d7 = _0x43b4a6 + "Cookie.txt",
	_0x5a1d0b = 20000,
	_0x2ca80d = 3;
function _0x5b32() {
	const _0x4aa1c6 = [
		"ogram",
		"mobil",
		"data",
		"missi",
		"3127)",
		"udgoQ",
		"9601",
		"lBTAd",
		"VvTeV",
		"16_1_",
		"now",
		"e604",
		"/user",
		"JLyMi",
		"IiCHH",
		"UEdZF",
		"PxEQN",
		"tbZvo",
		"versi",
		"9|6|1",
		"60UToNfm",
		".json",
		"DgVde",
		"filte",
		"Time",
		"file",
		"DLsvk",
		"toUpp",
		"CK文件[",
		"flag",
		"ign",
		"hasOw",
		"CWHZE",
		"ng.ne",
		"it_in",
		"wait",
		"editc",
		"e/sha",
		"rando",
		"sCode",
		"acces",
		"wkUuw",
		"abcde",
		"gap_i",
		"离目标时间",
		"joinT",
		"limit",
		"etail",
		"m/api",
		"UhbAm",
		"lient",
		"nMsg",
		"FDyYT",
		"amoun",
		"mStri",
		"updat",
		"Code/",
		"hTnCs",
		"/v2",
		"membe",
		"t/joi",
		"xSTSI",
		"valid",
		"请求[",
		"\n----",
		"userL",
		"erCas",
		"ahead",
		"ccess",
		"jKngV",
		"cf7c9",
		"，共运行了",
		"ATnid",
		"getcr",
		"yStr",
		"ms)，重",
		"---",
		"达上限",
		"dxEzF",
		"mDeta",
		"oQrsy",
		"thori",
		"nProp",
		"userI",
		"pop",
		"]请求超时",
		"|2|1|",
		"stErr",
		"-----",
		" OS X",
		"terva",
		"afxcy",
		"]返回[",
		"conds",
		"yhsh",
		"userC",
		"lengt",
		"|11|3",
		"okplw",
		"getFu",
		"eward",
		"son",
		"15E14",
		"start",
		"erty",
		"开启组队失",
		"tIXSH",
		"error",
		"16.1.",
		":ss.S",
		"获取账户信",
		"读取推送依",
		"lt_wa",
		"8411788WzJVxt",
		"need_",
		"it_ah",
		"resul",
		"qFvmh",
		"assig",
		"refre",
		"env",
		"str",
		"查询组队信",
		"llise",
		"45678",
		"nNoti",
		"lize_",
		"repla",
		"bdcmX",
		"pagei",
		"WyQLr",
		"今天已签到",
		"eJar",
		"cance",
		"floor",
		"coupo",
		"utErr",
		"445707HmcjXJ",
		"tcoup",
		"DSIDg",
		"read_",
		"shopI",
		"sendN",
		"m/web",
		"8 Mic",
		"15 (K",
		"cooki",
		"gnrew",
		"jiMuB",
		" NetT",
		"-cook",
		"FyRJM",
		" 查询积分",
		"0 (iP",
		"idcod",
		"e OS ",
		"min",
		"oEZsi",
		" like",
		"norma",
		"sSync",
		"HTML,",
		"ount",
		"fUGxZ",
		"5499e",
		"rejec",
		"://le",
		"HZpTH",
		"s_tok",
		"已完成等待",
		"_sign",
		"TFcTm",
		"team",
		"新建一个,",
		"des",
		"senge",
		"yyyy-",
		"IFI L",
		"hpRMJ",
		"WIFI",
		"hh:mm",
		"lob/m",
		"GzbdJ",
		"team_",
		"AWFOV",
		"nepgo",
		"zZBsN",
		"xxxxx",
		"未找到变量",
		"rojec",
		"/code",
		"优惠券",
		"oin_t",
		"json2",
		"time",
		"Mozil",
		"hPara",
		"YbXIU",
		"getDa",
		"exten",
		"2 lik",
		"://ap",
		"e_jso",
		"get_c",
		"20eUyVhw",
		"]失败, ",
		"/leaf",
		"CNPZl",
		"/web/",
		"VSrDM",
		"aster",
		"nse",
		"msg",
		"rid",
		"登录失败[",
		"gify",
		"reque",
		"签到失败[",
		"永辉生活",
		"MXDnJ",
		"encod",
		"padSt",
		"ip.co",
		"grZaj",
		"mesta",
		"subst",
		"WlFrO",
		"ist",
		"agent",
		"url",
		"debug",
		"0|7|4",
		"notif",
		"messa",
		"Iyazc",
		"DHVwP",
		"iPhon",
		"timeo",
		"ead",
		"ios",
		"FileS",
		"ame",
		"开启组队成",
		"utf-8",
		"]队伍失败",
		"oupon",
		"mIXaY",
		"redit",
		"]大于",
		"statu",
		"WTmah",
		"test",
		"llYea",
		"420*9",
		"Timeo",
		"mPatt",
		"41124cnGUhd",
		"lates",
		"38259aebbaa",
		"组队已完成",
		"userT",
		"wait_",
		"./sen",
		"keep-",
		"nfo_v",
		":ss",
		"credi",
		"onid",
		"heade",
		"jLRdH",
		"pbzVM",
		".codi",
		"UuoPa",
		"r/get",
		"inter",
		"加入[",
		"Sziav",
		"xcy/p",
		"DihMT",
		"eam",
		"ype/W",
		"event",
		"774784AmVcKv",
		"push",
		"signr",
		"m_cou",
		"charA",
		"JRpHf",
		" 默认为你",
		"vJxYX",
		"defau",
		"objec",
		"conso",
		" CPU ",
		" 如有需要",
		"sh_to",
		"x1800",
		"ken",
		"User-",
		"can_j",
		"_code",
		"22342jctHTh",
		"ask",
		") App",
		"，请检查文",
		"组队进度:",
		"共找到",
		"tQjQe",
		"/wxc9",
		"split",
		"1242392BccARJ",
		"查询积分失",
		"mp_le",
		"ateTe",
		"on/cr",
		"roMes",
		"kBDGu",
		"eMsg",
		"it_li",
		"until",
		"la/5.",
		"KyZsW",
		"10.4.",
		"IxNsM",
		"xxx-x",
		"wORnU",
		"ode",
		"d_tea",
		"cSHOr",
		"divid",
		"get_p",
		"keys",
		" 任务 -",
		"angua",
		"count",
		"05.1.",
		"get_a",
		"Msg",
		"teamC",
		"]请求错误",
		"fy.js",
		"301ndnDOG",
		"_deta",
		"个账号",
		"]还有",
		"form",
		"息失败[",
		"y-age",
		"follo",
		"eywGA",
		"nth",
		" 推送 =",
		"BaouM",
		"epot/",
		"nutes",
		"_in",
		"cqAJs",
		"队伍人数已",
		"getin",
		"toStr",
		"creat",
		"/coup",
		"igtzL",
		"]: ",
		"/pass",
		"o) Mo",
		"name",
		"ern",
		"zed",
		"aPTbh",
		"iVebi",
		"r/acc",
		"final",
		"join",
		"help_",
		"then",
		"kKifI",
		"版本：",
		"mIMrn",
		"_para",
		"got",
		"refix",
		"kwxsf",
		"hone;",
		"zEPRU",
		"ylXrP",
		"eTeam",
		"val",
		"，最新脚本",
		"exitN",
		"onpag",
		"auth",
		"red-d",
		"map",
		"er_op",
		"readF",
		"ommon",
		"avail",
		"]队伍成功",
		" 组队助力",
		"parse",
		"log",
		"WjyKC",
		" ----",
		"getMo",
		"aoZbW",
		"ction",
		"showm",
		"on/si",
		"helpe",
		"ALeIJ",
		"n/get",
		"====",
		"ePoin",
		"post",
		"Kit/6",
		"vflbn",
		"inclu",
		"积分: ",
		"]开始运行",
		"lDuIo",
		"YhSto",
		"ard/d",
		"minam",
		"QzKMg",
		"searc",
		"git/b",
		")，重试第",
		"ing",
		"commo",
		"e15,1",
		"\n====",
		"lt_ti",
		"lQwUb",
		"alive",
		"请检查同目",
		"=====",
		"录下是否有",
		"mit",
		"ileSy",
		"PHUwy",
		"Agent",
		"copy",
		"wRedi",
		"order",
		"]运行结束",
		"einfo",
		"uid",
		"nterv",
		" Geck",
		"urs",
		"https",
		"get",
		"teamD",
		"KHPsQ",
		"nTheP",
		"f0123",
		"AWKvC",
		"exist",
		"vCXvD",
		"write",
		"t/api",
		"fmt",
		"请填入ck",
		"Token",
		"getTi",
		"edit/",
		"yFlag",
		"ndgQS",
		"code",
		"现在运行的",
		"slukq",
		"index",
		"赖[sen",
		"nickn",
		"catch",
		"retry",
		"i.yon",
		"ghuiv",
		"t/cre",
		"5XukEyO",
		"metho",
		"rect",
		"hePar",
		"getMi",
	];
	_0x5b32 = function () {
		return _0x4aa1c6;
	};
	return _0x5b32();
}
const _0x14be7e = 1.01,
	_0x3a423f = _0x5827a5(496),
	_0x13f210 =
		_0x5827a5(368) +
		_0x5827a5(568) +
		_0x5827a5(493) +
		_0x5827a5(188) +
		"ng.ne" +
		_0x5827a5(378) +
		_0x5827a5(414) +
		_0x5827a5(608) +
		_0x5827a5(194) +
		"rojec" +
		"t/val" +
		_0x5827a5(556) +
		_0x5827a5(439) +
		_0x5827a5(309) +
		_0x5827a5(270) +
		"valid" +
		_0x5827a5(458) +
		_0x5827a5(343) +
		_0x5827a5(583) +
		_0x5827a5(612) +
		_0x5827a5(592) +
		_0x5827a5(423),
	_0x22a328 =
		_0x5827a5(597) +
		_0x5827a5(237) +
		_0x5827a5(555) +
		_0x5827a5(300) +
		_0x5827a5(210) +
		_0x5827a5(153) +
		_0x5827a5(557) +
		_0x5827a5(411) +
		_0x5827a5(602) +
		"e Mac" +
		_0x5827a5(491) +
		_0x5827a5(220) +
		"leWeb" +
		_0x5827a5(332) +
		_0x5827a5(252) +
		_0x5827a5(547) +
		_0x5827a5(563) +
		_0x5827a5(560) +
		_0x5827a5(366) +
		_0x5827a5(282) +
		"bile/" +
		_0x5827a5(504) +
		_0x5827a5(546) +
		_0x5827a5(232) +
		_0x5827a5(577) +
		"r/8.0" +
		".49(0" +
		_0x5827a5(213) +
		_0x5827a5(406) +
		_0x5827a5(551) +
		_0x5827a5(197) +
		_0x5827a5(579) +
		_0x5827a5(250) +
		"ge/zh" +
		"_CN m" +
		"iniPr" +
		_0x5827a5(402) +
		_0x5827a5(225) +
		_0x5827a5(472) +
		_0x5827a5(566) +
		_0x5827a5(413),
	_0x3814f0 = _0x5827a5(239) + "5.3",
	_0x297eb2 = _0x5827a5(408),
	_0x5b0990 = _0x297eb2,
	_0x3bd5e2 = 2000,
	_0x3989bb = 5;
function _0x2f9b(_0x4d9544, _0x5a23c5) {
	const _0x4d9f5a = _0x5b32();
	_0x2f9b = function (_0x3be884, _0x160821) {
		_0x3be884 = _0x3be884 - 144;
		let _0x35e660 = _0x4d9f5a[_0x3be884];
		return _0x35e660;
	};
	return _0x2f9b(_0x4d9544, _0x5a23c5);
}
class _0x55ea0b {
	constructor() {
		const _0x1d6b82 = _0x5827a5;
		this[_0x1d6b82(389)] = _0x454ec0.userIdx++;
		this.name = "";
		this[_0x1d6b82(464)] = false;
		const _0x33629c = {};
		_0x33629c[_0x1d6b82(448)] = 0;
		const _0xb8726f = {};
		_0xb8726f["Conne" + _0x1d6b82(323)] = _0x1d6b82(180) + _0x1d6b82(351);
		const _0x38bfa1 = {};
		_0x38bfa1[_0x1d6b82(393)] = _0x33629c;
		_0x38bfa1[_0x1d6b82(154) + "ut"] = _0x5a1d0b;
		_0x38bfa1[_0x1d6b82(265) + _0x1d6b82(360) + _0x1d6b82(399)] = false;
		_0x38bfa1[_0x1d6b82(185) + "rs"] = _0xb8726f;
		this[_0x1d6b82(297)] = _0xbc0ee4[_0x1d6b82(601) + "d"](_0x38bfa1);
	}
	[_0x5827a5(247) + _0x5827a5(298)](_0x4166ea = {}) {
		const _0x2e0714 = _0x5827a5;
		var _0x411b32 = "",
			_0x5caca2 = _0x454ec0["userC" + _0x2e0714(564)][_0x2e0714(276) + _0x2e0714(345)]()[_0x2e0714(498) + "h"];
		if (this[_0x2e0714(389)]) {
			_0x411b32 += "账号[" + _0x454ec0[_0x2e0714(623) + "r"](this[_0x2e0714(389)], _0x5caca2) + "]";
		}
		if (this[_0x2e0714(283)]) {
			_0x411b32 += "[" + this[_0x2e0714(283)] + "]";
		}
		return _0x411b32;
	}
	[_0x5827a5(318)](_0x322169, _0x1bb66a = {}) {
		const _0x104383 = _0x5827a5;
		const _0x1acfd4 = {
			DSIDg: function (_0x207b5c, _0x3989a3) {
				return _0x207b5c + _0x3989a3;
			},
		};
		let _0x232f8a = this[_0x104383(247) + "refix"]();
		_0x454ec0[_0x104383(318)](_0x1acfd4[_0x104383(541)](_0x232f8a, _0x322169), _0x1bb66a);
	}
	async [_0x5827a5(618) + "st"](_0x5adfb9) {
		const _0xec2715 = _0x5827a5,
			_0x1bcf2b = {
				WlFrO: _0xec2715(171) + _0xec2715(538) + "or",
				hTnCs: _0xec2715(208) + "t",
				IqZzX: function (_0x839ad6, _0x2e623b) {
					return _0x839ad6(_0x2e623b);
				},
				NvqoJ: "https-prox" + _0xec2715(264) + "nt",
				Sziav: function (_0x528c9b, _0x531ad6) {
					return _0x528c9b < _0x531ad6;
				},
				ohuJQ: function (_0x546aa8, _0x251df8) {
					return _0x546aa8 > _0x251df8;
				},
				KHPsQ: function (_0x5b570e, _0x5079cc) {
					return _0x5b570e * _0x5079cc;
				},
				vJxYX: _0xec2715(393) + _0xec2715(311) + "t",
				TFcTm: function (_0x361472, _0x18af8e, _0x2e2675) {
					return _0x361472(_0x18af8e, _0x2e2675);
				},
				kwxsf: function (_0x596348, _0x3bdfa9) {
					return _0x596348(_0x3bdfa9);
				},
				JLyMi: function (_0x4060f3, _0x54025a) {
					return _0x4060f3(_0x54025a);
				},
				tQjQe: function (_0x174302, _0x522455) {
					return _0x174302 - _0x522455;
				},
				FyRJM: function (_0x33d000, _0x365aa0) {
					return _0x33d000 || _0x365aa0;
				},
				wktOa: function (_0x46764f, _0x333d60) {
					return _0x46764f === _0x333d60;
				},
				Yluuf: "decod" + _0xec2715(604) + "n",
			},
			_0x847a9a = ["Reque" + _0xec2715(489) + "or"],
			_0x576188 = [_0x1bcf2b[_0xec2715(628)]];
		let _0x54fbe8 = _0x454ec0[_0xec2715(359)](_0x5adfb9),
			_0x5892e3 = {};
		try {
			let _0x41dc1e = null,
				_0x487db1 = 0,
				_0x5ae7cb = _0x54fbe8.fn || _0x54fbe8[_0xec2715(146)],
				_0x5c1049 = _0x54fbe8[_0xec2715(464) + _0xec2715(217)] || [200];
			if (_0x54fbe8[_0xec2715(262)]) {
				for (let _0x2699e9 in _0x54fbe8[_0xec2715(262)]) {
					typeof _0x54fbe8.form[_0x2699e9] == _0x1bcf2b.hTnCs &&
						(_0x54fbe8.form[_0x2699e9] = JSON["strin" + _0xec2715(617)](_0x54fbe8[_0xec2715(262)][_0x2699e9]));
				}
			}
			_0x54fbe8[_0xec2715(398) + "d"] = _0x54fbe8?.[_0xec2715(398) + "d"]?.["toUpperCase"]() || "GET";
			if (_0x54fbe8["searc" + _0xec2715(598) + "ms"]) {
				for (let _0x5d7789 in _0x54fbe8.searchParams) {
					typeof _0x54fbe8["searc" + _0xec2715(598) + "ms"][_0x5d7789] == _0x1bcf2b[_0xec2715(459)] &&
						(_0x54fbe8["searc" + _0xec2715(598) + "ms"][_0x5d7789] = JSON["strin" + _0xec2715(617)](
							_0x54fbe8[_0xec2715(342) + _0xec2715(598) + "ms"][_0x5d7789]
						));
				}
			}
			let _0x1acf6b = _0x54fbe8["got_c" + _0xec2715(452)] || this[_0xec2715(297)];
			_0x54fbe8[_0xec2715(147) + _0xec2715(272)] && console[_0xec2715(318)](_0x54fbe8);
			while (_0x1bcf2b[_0xec2715(193)](_0x487db1, _0x2ca80d)) {
				if (_0x1bcf2b.ohuJQ(_0x487db1, 0)) {
					await _0x454ec0.wait(_0x1bcf2b[_0xec2715(371)](_0x3bd5e2, _0x487db1));
					let _0x2d61dc = _0x454ec0[_0xec2715(369)](_0x54fbe8, _0xec2715(393) + "er", null);
					if (_0x2d61dc) {
						let _0x4cacdd = _0x454ec0[_0xec2715(369)](_0x54fbe8, _0x1bcf2b[_0xec2715(206)], {});
						await _0x1bcf2b[_0xec2715(573)](_0x2d61dc, _0x54fbe8, _0x4cacdd);
					}
				}
				_0x487db1++;
				let _0x1f5fee = null;
				try {
					let _0x26051d = _0x1bcf2b[_0xec2715(299)](
							Number,
							_0x54fbe8?.[_0xec2715(154) + "ut"]?.[_0xec2715(618) + "st"] ||
								_0x54fbe8?.[_0xec2715(154) + "ut"] ||
								_0x5a1d0b
						),
						_0x4b6e22 = false,
						_0x2ba956 = Date[_0xec2715(412)](),
						_0x438927 = _0x1bcf2b[_0xec2715(415)](_0x1acf6b, _0x54fbe8),
						_0x329f0b = setTimeout(() => {
							const _0x37d0f8 = _0xec2715;
							_0x4b6e22 = true;
							_0x438927[_0x37d0f8(535) + "l"]();
						}, _0x26051d);
					await _0x438927[_0xec2715(292)](
						(_0x32218e) => {
							_0x41dc1e = _0x32218e;
						},
						(_0xb670ca) => {
							const _0x372c60 = _0xec2715;
							_0x1f5fee = _0xb670ca;
							_0x41dc1e = _0xb670ca["respo" + _0x372c60(613)];
						}
					)[_0xec2715(289) + "ly"](() => clearTimeout(_0x329f0b));
					let _0x2e4856 = Date.now(),
						_0x151e7e = _0x1bcf2b[_0xec2715(224)](_0x2e4856, _0x2ba956),
						_0x2c8400 = _0x41dc1e?.[_0xec2715(166) + _0xec2715(441)] || null;
					if (_0x4b6e22 || _0x576188[_0xec2715(334) + _0xec2715(576)](_0x1f5fee?.[_0xec2715(283)])) {
						let _0x10f960 = "";
						_0x1f5fee?.[_0xec2715(386)] &&
							((_0x10f960 += "(" + _0x1f5fee.code),
							_0x1f5fee?.[_0xec2715(198)] && (_0x10f960 += ":" + _0x1f5fee.event),
							(_0x10f960 += ")"));
						this[_0xec2715(318)](
							"[" +
								_0x5ae7cb +
								_0xec2715(487) +
								_0x10f960 +
								"(" +
								_0x151e7e +
								(_0xec2715(477) + "试第") +
								_0x487db1 +
								"次"
						);
					} else {
						if (_0x847a9a["inclu" + _0xec2715(576)](_0x1f5fee?.[_0xec2715(283)])) {
							this[_0xec2715(318)](
								"[" +
									_0x5ae7cb +
									(_0xec2715(256) + "(") +
									_0x1f5fee[_0xec2715(386)] +
									")(" +
									_0x151e7e +
									(_0xec2715(477) + "试第") +
									_0x487db1 +
									"次"
							);
						} else {
							if (_0x2c8400) {
								_0x1f5fee &&
									!_0x5c1049[_0xec2715(334) + _0xec2715(576)](_0x2c8400) &&
									this[_0xec2715(318)](_0xec2715(465) + _0x5ae7cb + _0xec2715(494) + _0x2c8400 + "]");
							} else {
								let { code = "unknown", name = "unknown" } = _0x1bcf2b[_0xec2715(553)](_0x1f5fee, {});
								this[_0xec2715(318)](_0xec2715(465) + _0x5ae7cb + "]错误[" + code + "][" + name + "]");
							}
							break;
						}
					}
				} catch (_0x25b471) {
					this.log("[" + _0x5ae7cb + (_0xec2715(256) + "(") + _0x25b471.message + _0xec2715(344) + _0x487db1 + "次");
				}
			}
			if (_0x1bcf2b.wktOa(_0x41dc1e, null) || _0x41dc1e === undefined) {
				const _0x5602c3 = {};
				_0x5602c3[_0xec2715(166) + _0xec2715(441)] = -1;
				_0x5602c3.headers = null;
				_0x5602c3[_0xec2715(518) + "t"] = null;
				return _0x5602c3;
			}
			let { statusCode: _0x73cc5d, headers: _0x15aff2, body: _0x58c221 } = _0x41dc1e,
				_0x39b9b1 = _0x454ec0[_0xec2715(369)](_0x54fbe8, _0x1bcf2b.Yluuf, true);
			if (_0x58c221 && _0x39b9b1) {
				try {
					_0x58c221 = JSON[_0xec2715(317)](_0x58c221);
				} catch {}
			}
			const _0x47806c = {
				statusCode: _0x73cc5d,
				headers: _0x15aff2,
				result: _0x58c221,
			};
			_0x5892e3 = _0x47806c;
			_0x54fbe8.debug_out && console[_0xec2715(318)](_0x5892e3);
		} catch (_0x16826f) {
			console[_0xec2715(318)](_0x16826f);
		} finally {
			return _0x5892e3;
		}
	}
}
let _0x43afe8 = new _0x55ea0b();
class _0x35e111 extends _0x55ea0b {
	constructor(_0x3abc2a) {
		const _0xbaf87b = _0x5827a5;
		super();
		let _0x652d60 = _0x3abc2a[_0xbaf87b(226)]("#");
		this[_0xbaf87b(364)] = _0x652d60[0];
		this[_0xbaf87b(521) + _0xbaf87b(212) + _0xbaf87b(214)] = _0x652d60[1];
		this[_0xbaf87b(283)] = _0x652d60?.[2] || "";
		this[_0xbaf87b(442) + _0xbaf87b(570) + "en"] = "";
		this[_0xbaf87b(403) + "e"] = "";
		this[_0xbaf87b(391) + _0xbaf87b(158)] = "";
		this[_0xbaf87b(516) + "help_" + _0xbaf87b(585) + _0xbaf87b(251)] = 0;
		this[_0xbaf87b(326) + _0xbaf87b(244) + _0xbaf87b(202) + "nt"] = 0;
		this[_0xbaf87b(516) + "help_" + _0xbaf87b(574)] = true;
		this[_0xbaf87b(216) + _0xbaf87b(594) + _0xbaf87b(196)] = true;
		this[_0xbaf87b(548) + _0xbaf87b(534)] = new _0x3e25a4();
		const _0x5d2a9d = {};
		_0x5d2a9d[_0xbaf87b(215) + _0xbaf87b(358)] = _0x22a328;
		this[_0xbaf87b(297)] = this[_0xbaf87b(297)][_0xbaf87b(601) + "d"]({
			cookieJar: this[_0xbaf87b(548) + "eJar"],
			headers: _0x5d2a9d,
		});
	}
	["get_s" + _0x5827a5(432)]() {
		const _0x3d4451 = _0x5827a5;
		return _0x454ec0[_0x3d4451(440) + _0x3d4451(456) + "ng"]();
	}
	[_0x5827a5(605) + _0x5827a5(313) + _0x5827a5(296) + "m"]() {
		const _0x55f848 = _0x5827a5,
			_0x1e3327 = {};
		_0x1e3327[_0x55f848(350)] = "ios";
		_0x1e3327.CNPZl = "iPhone";
		_0x1e3327[_0x55f848(295)] = _0x55f848(510) + "0";
		_0x1e3327[_0x55f848(385)] = _0x55f848(170) + "10";
		const _0x2a9dc8 = _0x1e3327;
		let _0x450629 = {
			timestamp: Date.now(),
			channel: _0x2a9dc8.lQwUb,
			platform: _0x2a9dc8[_0x55f848(350)],
			v: _0x3814f0,
			app_version: _0x3814f0,
			sellerid: "",
			channelSub: "",
			jysessionid: "",
			brand: _0x2a9dc8[_0x55f848(609)],
			model: "iPhon" + _0x55f848(347),
			os: _0x55f848(156),
			osVersion: _0x2a9dc8[_0x55f848(295)],
			networkType: _0x55f848(581),
			screen: _0x2a9dc8.ndgQS,
			productLine: _0x55f848(338) + "re",
			appType: "h5",
			cityid: "",
			deviceid: "",
			shopid: _0x297eb2,
			memberid: this[_0x55f848(364)],
			access_token: this.access_token,
			sign: "",
		};
		return _0x450629;
	}
	async [_0x5827a5(253) + _0x5827a5(470) + _0x5827a5(381)](_0x44f116 = {}) {
		const _0x51f7cd = _0x5827a5,
			_0xbea44a = {
				eywGA: _0x51f7cd(253) + _0x51f7cd(470) + _0x51f7cd(381),
				cSHOr: _0x51f7cd(331),
				slukq: _0x51f7cd(386),
				KyZsW: function (_0x2103e6, _0x6df1e2) {
					return _0x2103e6 == _0x6df1e2;
				},
				wORnU: function (_0x51d32e, _0x344ff6) {
					return _0x51d32e != _0x344ff6;
				},
				grZaj: function (_0x17b1c1) {
					return _0x17b1c1();
				},
				kBDGu: _0x51f7cd(150) + "ge",
			};
		let _0xce5fc5 = false;
		try {
			let _0x1dc8a1 = {
					fn: _0xbea44a[_0x51f7cd(266)],
					method: _0xbea44a[_0x51f7cd(245)],
					url:
						_0x51f7cd(368) +
						_0x51f7cd(603) +
						_0x51f7cd(394) +
						_0x51f7cd(395) +
						_0x51f7cd(624) +
						"m/web" +
						_0x51f7cd(281) +
						"port/" +
						"membe" +
						_0x51f7cd(288) +
						"essTo" +
						"ken/7" +
						"75",
					searchParams: this[_0x51f7cd(605) + _0x51f7cd(313) + "_para" + "m"](),
					json: {
						uid: this[_0x51f7cd(364)],
						refresh_token: this[_0x51f7cd(521) + _0x51f7cd(212) + _0x51f7cd(214)],
					},
				},
				{ result: _0x44fe16, statusCode: _0x4dccc0 } = await this[_0x51f7cd(618) + "st"](_0x1dc8a1),
				_0x4afae9 = _0x454ec0[_0x51f7cd(369)](_0x44fe16, _0xbea44a[_0x51f7cd(388)], _0x4dccc0);
			if (_0xbea44a[_0x51f7cd(238)](_0x4afae9, 0)) {
				let { refresh_token: _0x1c286b, access_token: _0x2aecb6 } = _0x44fe16?.[_0x51f7cd(404)];
				this[_0x51f7cd(442) + "s_tok" + "en"] = _0x2aecb6;
				_0xbea44a[_0x51f7cd(242)](_0x1c286b, this[_0x51f7cd(521) + "sh_to" + _0x51f7cd(214)]) &&
					((this[_0x51f7cd(521) + _0x51f7cd(212) + "ken"] = _0x1c286b), _0xbea44a[_0x51f7cd(625)](_0x462bc1));
				_0xce5fc5 = true;
				this.valid = true;
			} else {
				let _0x4af38c = _0x454ec0[_0x51f7cd(369)](_0x44fe16, _0xbea44a[_0x51f7cd(233)], "");
				const _0x2beb2d = {};
				_0x2beb2d[_0x51f7cd(149) + "y"] = true;
				this.log(_0x51f7cd(616) + _0x4afae9 + "]: " + _0x4af38c, _0x2beb2d);
			}
		} catch (_0x3b7716) {
			console.log(_0x3b7716);
		} finally {
			return _0xce5fc5;
		}
	}
	async [_0x5827a5(275) + "fo"](_0x3c37e6 = {}) {
		const _0x3e4d01 = _0x5827a5,
			_0x297a13 = {};
		_0x297a13[_0x3e4d01(240)] = _0x3e4d01(275) + "fo";
		_0x297a13.kKifI = function (_0x27d905, _0x2a3f64) {
			return _0x27d905 == _0x2a3f64;
		};
		_0x297a13[_0x3e4d01(376)] = "message";
		const _0x16bd3c = _0x297a13;
		try {
			let _0x27a276 = {
					fn: _0x16bd3c[_0x3e4d01(240)],
					method: _0x3e4d01(369),
					url:
						_0x3e4d01(368) +
						_0x3e4d01(603) +
						_0x3e4d01(394) +
						"ghuiv" +
						_0x3e4d01(624) +
						_0x3e4d01(450) +
						_0x3e4d01(610) +
						"user/" +
						_0x3e4d01(461) +
						_0x3e4d01(190) +
						"info/" +
						"760",
					searchParams: this[_0x3e4d01(605) + "ommon" + "_para" + "m"](),
				},
				{ result: _0x2f37d0, statusCode: _0x489688 } = await this[_0x3e4d01(618) + "st"](_0x27a276),
				_0x3d6a0c = _0x454ec0[_0x3e4d01(369)](_0x2f37d0, "code", _0x489688);
			if (_0x16bd3c[_0x3e4d01(293)](_0x3d6a0c, 0)) {
				let { mobile: _0x32f9c8, memberid: _0x4338c0, nickname: _0x4eedef } = _0x2f37d0?.[_0x3e4d01(404)];
				this.name = this[_0x3e4d01(283)] || _0x32f9c8;
				this[_0x3e4d01(461) + _0x3e4d01(615)] = _0x4338c0;
				this["nickn" + _0x3e4d01(158)] = _0x4eedef;
			} else {
				let _0x3804df = _0x454ec0.get(_0x2f37d0, _0x16bd3c[_0x3e4d01(376)], "");
				this[_0x3e4d01(318)](_0x3e4d01(512) + _0x3e4d01(263) + _0x3d6a0c + _0x3e4d01(280) + _0x3804df);
			}
		} catch (_0xed813f) {
			console[_0x3e4d01(318)](_0xed813f);
		}
	}
	async [_0x5827a5(201) + "eward" + _0x5827a5(259) + "il"](_0x15a6e1 = {}) {
		const _0x1bf9dc = _0x5827a5,
			_0x13400e = {};
		_0x13400e[_0x1bf9dc(163)] = _0x1bf9dc(369);
		_0x13400e[_0x1bf9dc(151)] = _0x1bf9dc(386);
		_0x13400e.WTmah = function (_0x49b186, _0x4a916b) {
			return _0x49b186 == _0x4a916b;
		};
		_0x13400e.HZpTH = _0x1bf9dc(150) + "ge";
		const _0x4caf58 = _0x13400e;
		try {
			let _0x139c58 = {
					fn: _0x1bf9dc(201) + _0x1bf9dc(502) + _0x1bf9dc(259) + "il",
					method: _0x4caf58.mIXaY,
					url:
						_0x1bf9dc(368) +
						_0x1bf9dc(603) +
						_0x1bf9dc(394) +
						"ghuiv" +
						"ip.co" +
						"m/web" +
						_0x1bf9dc(278) +
						_0x1bf9dc(325) +
						_0x1bf9dc(549) +
						_0x1bf9dc(339) +
						_0x1bf9dc(449),
					searchParams: this[_0x1bf9dc(605) + _0x1bf9dc(313) + _0x1bf9dc(296) + "m"](),
				},
				{ result: _0x1d4db0, statusCode: _0x294401 } = await this[_0x1bf9dc(618) + "st"](_0x139c58),
				_0x4b889e = _0x454ec0[_0x1bf9dc(369)](_0x1d4db0, _0x4caf58[_0x1bf9dc(151)], _0x294401);
			if (_0x4caf58[_0x1bf9dc(167)](_0x4b889e, 0)) {
				let { signflag: _0x2c224a, missionid: _0x588166 } = _0x1d4db0?.[_0x1bf9dc(404)];
				_0x2c224a
					? this[_0x1bf9dc(318)](_0x1bf9dc(533))
					: await this[_0x1bf9dc(201) + _0x1bf9dc(502) + _0x1bf9dc(572)](_0x588166);
			} else {
				let _0x362e9a = _0x454ec0[_0x1bf9dc(369)](_0x1d4db0, _0x4caf58[_0x1bf9dc(569)], "");
				this[_0x1bf9dc(318)](_0x1bf9dc(619) + _0x4b889e + "]: " + _0x362e9a);
			}
		} catch (_0x5a2de0) {
			console.log(_0x5a2de0);
		}
	}
	async [_0x5827a5(201) + "eward" + "_sign"](_0x8a6836, _0x1673fe = {}) {
		const _0x5f44c3 = _0x5827a5,
			_0x3e6b8a = {};
		_0x3e6b8a[_0x5f44c3(584)] = _0x5f44c3(201) + _0x5f44c3(502) + _0x5f44c3(572);
		_0x3e6b8a[_0x5f44c3(424)] = "post";
		_0x3e6b8a[_0x5f44c3(416)] = _0x5f44c3(386);
		_0x3e6b8a[_0x5f44c3(337)] = function (_0x1c33e3, _0x562aef) {
			return _0x1c33e3 == _0x562aef;
		};
		_0x3e6b8a[_0x5f44c3(279)] = "message";
		const _0x27d5d0 = _0x3e6b8a;
		try {
			const _0x37d8d8 = {};
			_0x37d8d8[_0x5f44c3(543) + "d"] = _0x5b0990;
			_0x37d8d8[_0x5f44c3(405) + _0x5f44c3(184)] = _0x8a6836;
			let _0x2ee2d0 = {
					fn: _0x27d5d0[_0x5f44c3(584)],
					method: _0x27d5d0[_0x5f44c3(424)],
					url:
						_0x5f44c3(368) +
						_0x5f44c3(603) +
						_0x5f44c3(394) +
						_0x5f44c3(395) +
						_0x5f44c3(624) +
						_0x5f44c3(545) +
						_0x5f44c3(278) +
						_0x5f44c3(325) +
						_0x5f44c3(549) +
						"ard/s" +
						_0x5f44c3(432),
					searchParams: this[_0x5f44c3(605) + _0x5f44c3(313) + _0x5f44c3(296) + "m"](),
					json: _0x37d8d8,
				},
				{ result: _0x4d56c6, statusCode: _0x4dd145 } = await this[_0x5f44c3(618) + "st"](_0x2ee2d0),
				_0x4ceae8 = _0x454ec0[_0x5f44c3(369)](_0x4d56c6, _0x27d5d0[_0x5f44c3(416)], _0x4dd145);
			if (_0x27d5d0[_0x5f44c3(337)](_0x4ceae8, 0)) {
				let { credit = 0, couponvos: _0x2c723e } =
					_0x4d56c6?.[_0x5f44c3(404)]?.[_0x5f44c3(201) + _0x5f44c3(502) + "vo"];
				this[_0x5f44c3(318)]("签到成功: " + credit + "积分");
				if (_0x2c723e && _0x2c723e?.["length"]) {
					let _0x4bf8b4 = _0x2c723e[_0x5f44c3(310)](
						(_0x2922d0) =>
							_0x2922d0[_0x5f44c3(361) + _0x5f44c3(340) + "ount"] / 100 +
							"减" +
							_0x2922d0[_0x5f44c3(455) + "t"] / 100 +
							_0x5f44c3(593)
					);
					this[_0x5f44c3(318)]("签到获得: " + _0x4bf8b4[_0x5f44c3(290)](", "));
				}
			} else {
				let _0x3c6707 = _0x454ec0[_0x5f44c3(369)](_0x4d56c6, _0x27d5d0.igtzL, "");
				this.log("签到失败[" + _0x4ceae8 + _0x5f44c3(280) + _0x3c6707);
			}
		} catch (_0x2774b4) {
			console[_0x5f44c3(318)](_0x2774b4);
		}
	}
	async [_0x5827a5(370) + _0x5827a5(449)](_0x629a6d = {}) {
		const _0xd8c2ca = _0x5827a5,
			_0x559d4b = {
				UxyNf: _0xd8c2ca(331),
			};
		_0x559d4b.UxyNf = _0xd8c2ca(331);
		_0x559d4b[_0xd8c2ca(269)] = function (_0x512068, _0x2f2116) {
			return _0x512068 == _0x2f2116;
		};
		_0x559d4b.UuoPa = function (_0x5de2f8, _0x2491ea) {
			return _0x5de2f8 > _0x2491ea;
		};
		_0x559d4b[_0xd8c2ca(333)] = _0xd8c2ca(150) + "ge";
		const _0x49cd1d = _0x559d4b;
		try {
			const _0x29933b = {};
			_0x29933b[_0xd8c2ca(543) + "d"] = _0x5b0990;
			let _0x18a974 = {
					fn: "teamD" + _0xd8c2ca(449),
					method: _0x49cd1d.UxyNf,
					url:
						_0xd8c2ca(368) +
						_0xd8c2ca(603) +
						_0xd8c2ca(394) +
						_0xd8c2ca(395) +
						_0xd8c2ca(624) +
						_0xd8c2ca(545) +
						_0xd8c2ca(278) +
						"on/cr" +
						"edit/" +
						_0xd8c2ca(246) +
						_0xd8c2ca(330) +
						"t/tea" +
						_0xd8c2ca(481) +
						"il",
					searchParams: this[_0xd8c2ca(605) + "ommon" + _0xd8c2ca(296) + "m"](),
					json: _0x29933b,
				},
				{ result: _0x4a4e26, statusCode: _0x24abbd } = await this[_0xd8c2ca(618) + "st"](_0x18a974),
				_0x873253 = _0x454ec0[_0xd8c2ca(369)](_0x4a4e26, "code", _0x24abbd);
			if (_0x49cd1d[_0xd8c2ca(269)](_0x873253, 0)) {
				let {
					hasTeam: _0xfa23dd,
					teamSize: _0x2f9c21,
					teamStatus: _0x3fb874,
					teamCode: _0x25a0c0,
					teamDetailList: _0x278558,
				} = _0x4a4e26?.["data"];
				_0xfa23dd
					? ((this[_0xd8c2ca(255) + _0xd8c2ca(243)] = _0x25a0c0),
					  (this[_0xd8c2ca(516) + _0xd8c2ca(291) + _0xd8c2ca(585) + _0xd8c2ca(251)] = _0x2f9c21),
					  (this[_0xd8c2ca(326) + _0xd8c2ca(244) + _0xd8c2ca(202) + "nt"] = _0x278558.length),
					  _0x49cd1d[_0xd8c2ca(189)](
							this[_0xd8c2ca(516) + _0xd8c2ca(291) + _0xd8c2ca(585) + "count"],
							this[_0xd8c2ca(326) + "d_tea" + "m_cou" + "nt"]
					  )
							? (this[_0xd8c2ca(516) + "help_" + "team"] = true)
							: (this["need_" + _0xd8c2ca(291) + "team"] = false))
					: await this[_0xd8c2ca(277) + _0xd8c2ca(303)]();
				this[_0xd8c2ca(318)](
					_0xd8c2ca(222) +
						" " +
						this["helpe" + _0xd8c2ca(244) + _0xd8c2ca(202) + "nt"] +
						"/" +
						this[_0xd8c2ca(516) + _0xd8c2ca(291) + _0xd8c2ca(585) + "count"]
				);
			} else {
				let _0x4dcf57 = _0x454ec0.get(_0x4a4e26, _0x49cd1d[_0xd8c2ca(333)], "");
				this[_0xd8c2ca(318)](_0xd8c2ca(524) + "息失败[" + _0x873253 + _0xd8c2ca(280) + _0x4dcf57);
			}
		} catch (_0x30874e) {
			console[_0xd8c2ca(318)](_0x30874e);
		}
	}
	async ["creat" + _0x5827a5(303)](_0x1d4ffb = {}) {
		const _0x1ac724 = _0x5827a5,
			_0x1f0ca8 = {};
		_0x1f0ca8[_0x1ac724(187)] = _0x1ac724(277) + _0x1ac724(303);
		_0x1f0ca8.fJVgV = _0x1ac724(386);
		_0x1f0ca8[_0x1ac724(482)] = _0x1ac724(150) + "ge";
		const _0x4a0b8f = _0x1f0ca8;
		try {
			const _0x4e67a5 = {};
			_0x4e67a5[_0x1ac724(543) + "d"] = _0x5b0990;
			let _0x52346a = {
					fn: _0x4a0b8f[_0x1ac724(187)],
					method: _0x1ac724(331),
					url:
						_0x1ac724(368) +
						_0x1ac724(603) +
						"i.yon" +
						"ghuiv" +
						_0x1ac724(624) +
						"m/web" +
						"/coup" +
						_0x1ac724(231) +
						_0x1ac724(383) +
						_0x1ac724(246) +
						_0x1ac724(330) +
						_0x1ac724(396) +
						_0x1ac724(230) +
						"am",
					searchParams: this[_0x1ac724(605) + _0x1ac724(313) + _0x1ac724(296) + "m"](),
					json: _0x4e67a5,
				},
				{ result: _0x42f020, statusCode: _0x16f7b6 } = await this[_0x1ac724(618) + "st"](_0x52346a),
				_0x3a9825 = _0x454ec0[_0x1ac724(369)](_0x42f020, _0x4a0b8f.fJVgV, _0x16f7b6);
			if (_0x3a9825 == 0) {
				let {
					teamSize: _0x10d817,
					teamStatus: _0x5a4cde,
					teamCode: _0x4f6b44,
					teamDetailList: _0x5b800a,
				} = _0x42f020?.[_0x1ac724(404)];
				this[_0x1ac724(255) + _0x1ac724(243)] = _0x4f6b44;
				this[_0x1ac724(516) + "help_" + _0x1ac724(585) + _0x1ac724(251)] = _0x10d817;
				this["helpe" + _0x1ac724(244) + _0x1ac724(202) + "nt"] = _0x5b800a.length;
				this[_0x1ac724(516) + _0x1ac724(291) + _0x1ac724(585) + _0x1ac724(251)] >
				this[_0x1ac724(326) + _0x1ac724(244) + _0x1ac724(202) + "nt"]
					? (this[_0x1ac724(516) + "help_" + _0x1ac724(574)] = true)
					: (this[_0x1ac724(516) + _0x1ac724(291) + "team"] = false);
				this[_0x1ac724(318)](_0x1ac724(159) + "功");
			} else {
				let _0x4c347a = _0x454ec0[_0x1ac724(369)](_0x42f020, _0x4a0b8f[_0x1ac724(482)], "");
				this[_0x1ac724(318)](_0x1ac724(507) + "败[" + _0x3a9825 + _0x1ac724(280) + _0x4c347a);
			}
		} catch (_0x2f938d) {
			console[_0x1ac724(318)](_0x2f938d);
		}
	}
	async [_0x5827a5(447) + _0x5827a5(400) + "ty"](_0x4fe00d, _0x359bba = {}) {
		const _0x391073 = _0x5827a5,
			_0x4d140b = {
				brbKJ: _0x391073(447) + _0x391073(400) + "ty",
				AWFOV: function (_0x3797e9, _0x548b4e) {
					return _0x3797e9 == _0x548b4e;
				},
			};
		_0x4d140b.brbKJ = _0x391073(447) + _0x391073(400) + "ty";
		_0x4d140b.AWFOV = function (_0x3797e9, _0x548b4e) {
			return _0x3797e9 == _0x548b4e;
		};
		_0x4d140b[_0x391073(417)] = function (_0x4a8b55, _0x20519c) {
			return _0x4a8b55 >= _0x20519c;
		};
		_0x4d140b[_0x391073(519)] = "message";
		_0x4d140b[_0x391073(186)] = _0x391073(274) + _0x391073(479);
		const _0x2fab10 = _0x4d140b;
		try {
			let _0x20a96c = _0x4fe00d[_0x391073(283)] || "账号" + _0x4fe00d[_0x391073(389)];
			const _0x440144 = {};
			_0x440144[_0x391073(255) + "ode"] = _0x4fe00d["teamC" + _0x391073(243)];
			_0x440144[_0x391073(543) + "d"] = _0x5b0990;
			let _0x46d128 = {
					fn: _0x2fab10.brbKJ,
					method: _0x391073(331),
					url:
						"https" +
						_0x391073(603) +
						"i.yon" +
						_0x391073(395) +
						_0x391073(624) +
						_0x391073(545) +
						"/coup" +
						_0x391073(231) +
						_0x391073(383) +
						"divid" +
						"ePoin" +
						_0x391073(462) +
						_0x391073(372) +
						"arty",
					searchParams: this[_0x391073(605) + _0x391073(313) + _0x391073(296) + "m"](),
					json: _0x440144,
				},
				{ result: _0x131869, statusCode: _0x2aa84d } = await this.request(_0x46d128),
				_0xbb601a = _0x454ec0.get(_0x131869, "code", _0x2aa84d);
			if (_0x2fab10[_0x391073(586)](_0xbb601a, 0)) {
				this["can_j" + _0x391073(594) + _0x391073(196)] = false;
				this[_0x391073(318)](_0x391073(192) + _0x20a96c + _0x391073(315));
				_0x4fe00d["helped_tea" + _0x391073(202) + "nt"]++;
				_0x2fab10.UEdZF(
					_0x4fe00d[_0x391073(326) + _0x391073(244) + _0x391073(202) + "nt"],
					_0x4fe00d[_0x391073(516) + "help_" + _0x391073(585) + "count"]
				) &&
					((_0x4fe00d[_0x391073(516) + _0x391073(291) + _0x391073(574)] = false),
					_0x4fe00d[_0x391073(318)](_0x391073(176)));
			} else {
				let _0x3095d5 = _0x454ec0[_0x391073(369)](_0x131869, _0x2fab10[_0x391073(519)], "");
				this.log(_0x391073(192) + _0x20a96c + (_0x391073(161) + "[") + _0xbb601a + _0x391073(280) + _0x3095d5);
				if (_0x3095d5?.[_0x391073(334) + "des"](_0x2fab10[_0x391073(186)])) {
					_0x4fe00d["need_" + _0x391073(291) + _0x391073(574)] = false;
				} else {
					_0x3095d5?.["inclu" + _0x391073(576)]("组队上限") &&
						(this[_0x391073(216) + _0x391073(594) + _0x391073(196)] = false);
				}
			}
		} catch (_0x2cdbce) {
			console[_0x391073(318)](_0x2cdbce);
		}
	}
	async [_0x5827a5(475) + "editc" + _0x5827a5(162) + _0x5827a5(531) + _0x5827a5(181) + "2"](_0x4d1ee3 = {}) {
		const _0x44181a = _0x5827a5,
			_0x315e64 = {};
		_0x315e64[_0x44181a(471)] = _0x44181a(475) + _0x44181a(438) + "oupon" + "pagei" + "nfo_v" + "2";
		_0x315e64.PxEQN = "get";
		const _0x532b88 = _0x315e64;
		try {
			let _0x198a62 = {
					fn: _0x532b88.jKngV,
					method: _0x532b88[_0x44181a(418)],
					url:
						_0x44181a(368) +
						"://ap" +
						_0x44181a(394) +
						_0x44181a(395) +
						"ip.co" +
						_0x44181a(545) +
						"/coup" +
						_0x44181a(231) +
						_0x44181a(383) +
						_0x44181a(537) +
						_0x44181a(328) +
						_0x44181a(183) +
						_0x44181a(540) +
						_0x44181a(307) +
						_0x44181a(363) +
						_0x44181a(460),
					searchParams: this[_0x44181a(605) + _0x44181a(313) + "_para" + "m"](),
				},
				{ result: _0x568e34, statusCode: _0x53a888 } = await this[_0x44181a(618) + "st"](_0x198a62),
				_0x1c5e8c = _0x454ec0.get(_0x568e34, _0x44181a(386), _0x53a888);
			if (_0x1c5e8c == 0) {
				this[_0x44181a(183) + "t"] = _0x568e34?.[_0x44181a(404)]?.[_0x44181a(314) + "ableC" + _0x44181a(164)] || 0;
				const _0x3e72f8 = {};
				_0x3e72f8[_0x44181a(149) + "y"] = true;
				this.log(_0x44181a(335) + this[_0x44181a(183) + "t"], _0x3e72f8);
			} else {
				let _0x34cbbf = _0x454ec0.get(_0x568e34, _0x44181a(150) + "ge", "");
				const _0x235642 = {
					notify: true,
				};
				this.log(_0x44181a(228) + "败[" + _0x1c5e8c + _0x44181a(280) + _0x34cbbf, _0x235642);
			}
		} catch (_0x4efa9e) {
			console[_0x44181a(318)](_0x4efa9e);
		}
	}
	async [_0x5827a5(177) + _0x5827a5(219)](_0xc73f9f = {}) {
		const _0x31d010 = _0x5827a5;
		if (!(await this[_0x31d010(253) + _0x31d010(470) + _0x31d010(381)]())) {
			return;
		}
		await this[_0x31d010(201) + _0x31d010(502) + _0x31d010(259) + "il"]();
		await this[_0x31d010(370) + _0x31d010(449)]();
	}
}
function _0x5d5328() {
	const _0x25057d = _0x5827a5;
	if (_0x408278[_0x25057d(375) + _0x25057d(562)]("./" + _0x4031d7)) {
		const _0x11946c = {};
		_0x11946c[_0x25057d(431)] = "r";
		_0x11946c[_0x25057d(622) + _0x25057d(345)] = "utf-8";
		let _0x1e7f43 = _0x408278[_0x25057d(312) + _0x25057d(356) + "nc"]("./" + _0x4031d7, _0x11946c);
		_0x1e7f43 =
			_0x1e7f43?.[_0x25057d(529) + "ce"](/\r/g, "")
				?.[_0x25057d(226)]("\n")
				?.[_0x25057d(425) + "r"]((_0x53b306) => _0x53b306) || [];
		for (let _0x448a94 of _0x1e7f43) {
			_0x454ec0["userL" + _0x25057d(144)][_0x25057d(200)](new _0x35e111(_0x448a94));
		}
	} else {
		const _0x1f304a = {};
		_0x1f304a[_0x25057d(431)] = "w";
		_0x1f304a[_0x25057d(622) + "ing"] = _0x25057d(160);
		_0x408278[_0x25057d(377) + _0x25057d(157) + "ync"]("./" + _0x4031d7, "", _0x1f304a);
		_0x454ec0[_0x25057d(318)](
			_0x25057d(430) + _0x4031d7 + ("]不存在," + _0x25057d(205) + _0x25057d(575) + _0x25057d(211) + _0x25057d(380))
		);
	}
	_0x454ec0[_0x25057d(497) + "ount"] = _0x454ec0[_0x25057d(467) + _0x25057d(144)][_0x25057d(498) + "h"];
	if (!_0x454ec0["userC" + _0x25057d(564)]) {
		const _0xb11180 = {};
		_0xb11180[_0x25057d(149) + "y"] = true;
		_0x454ec0.log(_0x25057d(590) + _0x25057d(221) + "件[" + _0x4031d7 + "]", _0xb11180);
		return false;
	}
	_0x454ec0[_0x25057d(318)](_0x25057d(223) + _0x454ec0[_0x25057d(497) + _0x25057d(564)] + "个账号");
	return true;
}
function _0x462bc1() {
	const _0x2df057 = _0x5827a5,
		_0x33814a = {};
	_0x33814a[_0x2df057(195)] = "utf-8";
	const _0x553222 = _0x33814a;
	let _0x3a0e01 = [];
	for (let _0x398211 of _0x454ec0["userL" + _0x2df057(144)]) {
		let _0x37b7d3 = _0x398211[_0x2df057(283)] || _0x398211[_0x2df057(403) + "e"] || "";
		_0x3a0e01[_0x2df057(200)](
			_0x398211.uid + "#" + _0x398211[_0x2df057(521) + _0x2df057(212) + _0x2df057(214)] + "#" + _0x37b7d3
		);
	}
	if (_0x3a0e01[_0x2df057(498) + "h"]) {
		const _0x325451 = {};
		_0x325451[_0x2df057(431)] = "w";
		_0x325451[_0x2df057(622) + _0x2df057(345)] = _0x553222.DihMT;
		_0x408278[_0x2df057(377) + _0x2df057(157) + "ync"]("./" + _0x4031d7, _0x3a0e01[_0x2df057(290)]("\n"), _0x325451);
	}
}
!(async () => {
	const _0x269d49 = _0x5827a5,
		_0x29aa83 = {
			aPTbh: function (_0x36424d) {
				return _0x36424d();
			},
		};
	// if (!(await _0x29aa83[_0x269d49(286)](_0x1976a1))) {
	// 	return;
	// }
	if (!_0x5d5328()) {
		return;
	}
	_0x454ec0[_0x269d49(318)](
		_0x269d49(466) +
			"-----" +
			_0x269d49(490) +
			_0x269d49(490) +
			_0x269d49(249) +
			_0x269d49(490) +
			_0x269d49(490) +
			_0x269d49(490) +
			_0x269d49(478)
	);
	for (let _0x2c7835 of _0x454ec0[_0x269d49(467) + _0x269d49(144)]) {
		await _0x2c7835[_0x269d49(177) + _0x269d49(219)]();
	}
	let _0x99ee20 = _0x454ec0[_0x269d49(467) + _0x269d49(144)][_0x269d49(425) + "r"](
		(_0x10efa2) => _0x10efa2[_0x269d49(464)]
	);
	_0x454ec0[_0x269d49(318)](
		_0x269d49(466) +
			"-----" +
			_0x269d49(490) +
			_0x269d49(490) +
			_0x269d49(316) +
			" ----" +
			"-----" +
			_0x269d49(490) +
			_0x269d49(490)
	);
	for (let _0x115179 of _0x99ee20[_0x269d49(425) + "r"](
		(_0x3b5ab2) => _0x3b5ab2[_0x269d49(516) + _0x269d49(291) + _0x269d49(574)]
	)) {
		for (let _0x546299 of _0x99ee20[_0x269d49(425) + "r"](
			(_0x51a672) =>
				_0x51a672[_0x269d49(216) + _0x269d49(594) + _0x269d49(196)] &&
				_0x51a672[_0x269d49(389)] != _0x115179[_0x269d49(389)]
		)) {
			if (!_0x115179[_0x269d49(516) + _0x269d49(291) + "team"]) {
				break;
			}
			await _0x546299[_0x269d49(447) + _0x269d49(400) + "ty"](_0x115179);
		}
	}
	_0x454ec0[_0x269d49(318)](
		_0x269d49(466) +
			_0x269d49(490) +
			_0x269d49(490) +
			_0x269d49(490) +
			_0x269d49(554) +
			_0x269d49(320) +
			_0x269d49(490) +
			_0x269d49(490) +
			_0x269d49(490)
	);
	for (let _0x22a19d of _0x99ee20) {
		await _0x22a19d["getcreditc" + _0x269d49(162) + "pagei" + _0x269d49(181) + "2"]();
	}
})()
	[_0x5827a5(392)]((_0x2cd514) => _0x454ec0.log(_0x2cd514))
	.finally(() => _0x454ec0[_0x5827a5(306) + "ow"]());
async function _0x1976a1(_0x4d12f6 = 0) {
	const _0x28b479 = _0x5827a5,
		_0x224809 = {
			oEZsi: _0x28b479(308),
			nepgo: _0x28b479(369),
			wkUuw: function (_0x50e074, _0x11224e) {
				return _0x50e074 != _0x11224e;
			},
			PHUwy: function (_0x5bb37a, _0xe3ce19) {
				return _0x5bb37a < _0xe3ce19;
			},
			udgoQ: function (_0x3083c4, _0x548890) {
				return _0x3083c4(_0x548890);
			},
			VvTeV: function (_0x3c36ee, _0x290329) {
				return _0x3c36ee == _0x290329;
			},
			KuQir: function (_0x466de9, _0x938808) {
				return _0x466de9 > _0x938808;
			},
		};
	let _0x129863 = false;
	try {
		const _0x431c3e = {
			fn: _0x224809[_0x28b479(559)],
		};
		_0x431c3e.fn = _0x224809[_0x28b479(559)];
		_0x431c3e[_0x28b479(398) + "d"] = _0x224809[_0x28b479(587)];
		_0x431c3e.url = _0x13f210;
		_0x431c3e[_0x28b479(154) + "ut"] = 20000;
		let _0x3cb372 = _0x431c3e,
			{ statusCode: _0x4edbd5, result: _0x10312b } = await _0x43afe8[_0x28b479(618) + "st"](_0x3cb372);
		if (_0x224809[_0x28b479(443)](_0x4edbd5, 200)) {
			_0x224809[_0x28b479(357)](_0x4d12f6++, _0x3989bb) &&
				(_0x129863 = await _0x224809[_0x28b479(407)](_0x1976a1, _0x4d12f6));
			return _0x129863;
		}
		if (_0x224809[_0x28b479(410)](_0x10312b?.[_0x28b479(386)], 0)) {
			_0x10312b = JSON[_0x28b479(317)](_0x10312b[_0x28b479(404)][_0x28b479(427)].data);
			if (
				_0x10312b?.["commo" + _0x28b479(527) + "fy"] &&
				_0x224809.KuQir(_0x10312b[_0x28b479(346) + "nNoti" + "fy"][_0x28b479(498) + "h"], 0)
			) {
				const _0x10553b = {};
				_0x10553b[_0x28b479(149) + "y"] = true;
				_0x454ec0[_0x28b479(318)](
					_0x10312b[_0x28b479(346) + _0x28b479(527) + "fy"][_0x28b479(290)]("\n") + "\n",
					_0x10553b
				);
			}
			_0x10312b?.["commo" + _0x28b479(453)] &&
				_0x10312b[_0x28b479(346) + _0x28b479(453)][_0x28b479(498) + "h"] > 0 &&
				_0x454ec0.log(_0x10312b[_0x28b479(346) + "nMsg"].join("\n") + "\n");
			if (_0x10312b[_0x3a423f]) {
				let _0x3240cc = _0x10312b[_0x3a423f];
				_0x3240cc[_0x28b479(166) + "s"] == 0
					? _0x14be7e >= _0x3240cc[_0x28b479(420) + "on"]
						? ((_0x129863 = true),
						  _0x454ec0[_0x28b479(318)](_0x3240cc[_0x28b479(614)][_0x3240cc.status]),
						  _0x454ec0[_0x28b479(318)](_0x3240cc[_0x28b479(457) + _0x28b479(234)]),
						  _0x454ec0[_0x28b479(318)](
								_0x28b479(387) +
									"脚本版本是" +
									"：" +
									_0x14be7e +
									(_0x28b479(305) + _0x28b479(294)) +
									_0x3240cc[_0x28b479(174) + "tVers" + "ion"]
						  ))
						: _0x454ec0[_0x28b479(318)](_0x3240cc[_0x28b479(420) + "onMsg"])
					: _0x454ec0[_0x28b479(318)](_0x3240cc.msg[_0x3240cc[_0x28b479(166) + "s"]]);
			} else {
				_0x454ec0[_0x28b479(318)](_0x10312b[_0x28b479(509) + _0x28b479(254)]);
			}
		} else {
			_0x224809.PHUwy(_0x4d12f6++, _0x3989bb) && (_0x129863 = await _0x224809[_0x28b479(407)](_0x1976a1, _0x4d12f6));
		}
	} catch (_0x14af46) {
		_0x454ec0.log(_0x14af46);
	} finally {
		return _0x129863;
	}
}
function _0x427c74(_0xb7969a) {
	const _0x13bdb2 = _0x5827a5,
		_0x1f223e = {
			VSrDM: "5|0|8" + _0x13bdb2(488) + _0x13bdb2(421) + _0x13bdb2(148) + _0x13bdb2(499),
			zEPRU: function (_0x3b48b0, _0x40cae4) {
				return _0x3b48b0 * _0x40cae4;
			},
			CWHZE: function (_0x54ef9b, _0x49ca9a) {
				return _0x54ef9b * _0x49ca9a;
			},
			dxEzF: _0x13bdb2(582) + _0x13bdb2(182),
			MXDnJ: function (_0x3f2639, _0x4e5c07) {
				return _0x3f2639 + _0x4e5c07;
			},
			tIXSH: function (_0x5b1aad, _0x2bf36d) {
				return _0x5b1aad / _0x2bf36d;
			},
			AWKvC: function (_0x27ae77, _0x23e3fe) {
				return _0x27ae77 + _0x23e3fe;
			},
			ALeIJ: function (_0x55b4e2, _0x20d380) {
				return _0x55b4e2 - _0x20d380;
			},
			tbZvo: function (_0x236d89, _0x14d9f0) {
				return _0x236d89 == _0x14d9f0;
			},
			AambM: function (_0x209e97, _0x5a90f5) {
				return _0x209e97 + _0x5a90f5;
			},
			DHVwP: function (_0x5be58f, _0x367ecc) {
				return _0x5be58f(_0x367ecc);
			},
			LAXiK: _0x13bdb2(179) + "dNoti" + "fy",
			WjyKC:
				_0x13bdb2(348) + _0x13bdb2(353) + _0x13bdb2(353) + _0x13bdb2(268) + _0x13bdb2(353) + _0x13bdb2(353) + "===",
			ylXrP: function (_0x9c25ea, _0x27e27b) {
				return _0x9c25ea > _0x27e27b;
			},
			aoZbW: function (_0x2d16f2, _0x51e73b) {
				return _0x2d16f2 < _0x51e73b;
			},
			ATnid: function (_0x323303, _0x390813) {
				return _0x323303 + _0x390813;
			},
			zZBsN: function (_0x2bafae, _0xeb6232) {
				return _0x2bafae && _0xeb6232;
			},
			JRpHf: function (_0x2e66ae, _0x543401) {
				return _0x2e66ae(_0x543401);
			},
			QzKMg: function (_0x3e7463, _0xc2abd2) {
				return _0x3e7463 == _0xc2abd2;
			},
			xSTSI: function (_0x41a457, _0x5c5681) {
				return _0x41a457 == _0x5c5681;
			},
			UhbAm:
				_0x13bdb2(589) +
				_0x13bdb2(241) +
				_0x13bdb2(241) +
				_0x13bdb2(241) +
				"xxx-x" +
				_0x13bdb2(589) +
				_0x13bdb2(589) +
				"x",
			okplw: function (_0x586443, _0x28a537) {
				return _0x586443 < _0x28a537;
			},
			SFwgQ: function (_0x55389b, _0x20fc76) {
				return _0x55389b * _0x20fc76;
			},
			zOlrm: function (_0x1a8505, _0x5568a1) {
				return _0x1a8505 / _0x5568a1;
			},
			FDyYT: function (_0x57e147, _0x53e672) {
				return _0x57e147 == _0x53e672;
			},
			YbXIU: "string",
			hpRMJ: _0x13bdb2(578) + "MM-dd" + " ",
			iVebi: function (_0x474717, _0x4434e4) {
				return _0x474717 - _0x4434e4;
			},
			bdcmX: "hh:mm" + _0x13bdb2(511),
			WyQLr: function (_0x34c4ac, _0x1e704e) {
				return _0x34c4ac * _0x1e704e;
			},
			DLsvk: function (_0x17b4c7, _0x1aec2d) {
				return _0x17b4c7 / _0x1aec2d;
			},
			fUGxZ: function (_0x52cee2, _0x14e354) {
				return _0x52cee2 / _0x14e354;
			},
			cqAJs: function (_0xfa8875, _0x4481f3) {
				return _0xfa8875 > _0x4481f3;
			},
			jiMuB: function (_0x366e25, _0x2dafc0) {
				return _0x366e25 - _0x2dafc0;
			},
			lBTAd: function (_0x267220, _0x260335) {
				return _0x267220 < _0x260335;
			},
		};
	return new (class {
		constructor(_0x1b26b1) {
			const _0x5db502 = _0x13bdb2,
				_0x1c496c = _0x1f223e[_0x5db502(611)][_0x5db502(226)]("|");
			let _0x49b339 = 0;
			while (true) {
				switch (_0x1c496c[_0x49b339++]) {
					case "0":
						this[_0x5db502(505) + _0x5db502(426)] = Date.now();
						continue;
					case "1":
						this.notifyFlag = true;
						continue;
					case "2":
						this[_0x5db502(149) + "yStr"] = [];
						continue;
					case "3":
						this[_0x5db502(207) + "lt_wa" + _0x5db502(517) + _0x5db502(155)] = 0;
						continue;
					case "4":
						this[_0x5db502(207) + _0x5db502(514) + _0x5db502(436) + _0x5db502(492) + "l"] = 1000;
						continue;
					case "5":
						this[_0x5db502(283)] = _0x1b26b1;
						continue;
					case "6":
						this[_0x5db502(467) + _0x5db502(144)] = [];
						continue;
					case "7":
						this["default_timesta" + _0x5db502(229) + "n"] = 13;
						continue;
					case "8":
						const _0x57824c = {};
						_0x57824c[_0x5db502(596)] = true;
						this[_0x5db502(318)]("[" + this.name + (_0x5db502(336) + "\n"), _0x57824c);
						continue;
					case "9":
						this[_0x5db502(485) + "dx"] = 0;
						continue;
					case "10":
						this[_0x5db502(497) + _0x5db502(564)] = 0;
						continue;
					case "11":
						this[_0x5db502(207) + _0x5db502(514) + "it_li" + _0x5db502(355)] = _0x1f223e[_0x5db502(301)](
							_0x1f223e.CWHZE(60, 60),
							1000
						);
						continue;
				}
				break;
			}
		}
		[_0x13bdb2(318)](_0x2e1db9, _0x3087f3 = {}) {
			const _0x372eb1 = _0x13bdb2,
				_0x516dc1 = {};
			_0x516dc1[_0x372eb1(209) + "le"] = true;
			let _0x53bae5 = _0x516dc1;
			Object[_0x372eb1(520) + "n"](_0x53bae5, _0x3087f3);
			if (_0x53bae5.time) {
				let _0x11376f = _0x53bae5[_0x372eb1(379)] || _0x1f223e[_0x372eb1(480)];
				_0x2e1db9 = "[" + this[_0x372eb1(596)](_0x11376f) + "]" + _0x2e1db9;
			}
			if (_0x53bae5[_0x372eb1(149) + "y"]) {
				this[_0x372eb1(149) + _0x372eb1(476)].push(_0x2e1db9);
			}
			if (_0x53bae5[_0x372eb1(209) + "le"]) {
				console.log(_0x2e1db9);
			}
		}
		[_0x13bdb2(369)](_0x231fbf, _0x109846, _0x528a07 = "") {
			const _0x2d6894 = _0x13bdb2;
			let _0x8db8d2 = _0x528a07;
			_0x231fbf?.[_0x2d6894(433) + "nProp" + _0x2d6894(506)](_0x109846) && (_0x8db8d2 = _0x231fbf[_0x109846]);
			return _0x8db8d2;
		}
		[_0x13bdb2(486)](_0x4587e2, _0x27e058, _0x10e405 = "") {
			const _0x1828f3 = _0x13bdb2;
			let _0x909233 = _0x10e405;
			_0x4587e2?.[_0x1828f3(433) + _0x1828f3(484) + _0x1828f3(506)](_0x27e058) &&
				((_0x909233 = _0x4587e2[_0x27e058]), delete _0x4587e2[_0x27e058]);
			return _0x909233;
		}
		copy(_0x25ee1d) {
			const _0x280399 = _0x13bdb2;
			return Object[_0x280399(520) + "n"]({}, _0x25ee1d);
		}
		[_0x13bdb2(542) + "env"](_0xfeac9a) {
			const _0x1a2cdb = _0x13bdb2;
			let _0x140825 = ckNames[_0x1a2cdb(310)]((_0x5c5257) => process[_0x1a2cdb(522)][_0x5c5257]);
			for (let _0x2562d8 of _0x140825.filter((_0x136531) => !!_0x136531)) {
				for (let _0x1d07da of _0x2562d8[_0x1a2cdb(226)](envSplitor)[_0x1a2cdb(425) + "r"]((_0xc11955) => !!_0xc11955)) {
					this[_0x1a2cdb(467) + _0x1a2cdb(144)][_0x1a2cdb(200)](new _0xfeac9a(_0x1d07da));
				}
			}
			this[_0x1a2cdb(497) + _0x1a2cdb(564)] = this[_0x1a2cdb(467) + _0x1a2cdb(144)][_0x1a2cdb(498) + "h"];
			if (!this[_0x1a2cdb(497) + _0x1a2cdb(564)]) {
				const _0x5e3f06 = {
					notify: true,
				};
				this[_0x1a2cdb(318)](
					_0x1a2cdb(590) +
						"，请检查变" +
						"量" +
						ckNames[_0x1a2cdb(310)]((_0x743ea9) => "[" + _0x743ea9 + "]").join("或"),
					_0x5e3f06
				);
				return false;
			}
			this.log(_0x1a2cdb(223) + this[_0x1a2cdb(497) + _0x1a2cdb(564)] + _0x1a2cdb(260));
			return true;
		}
		[_0x13bdb2(596)](_0x4e1333, _0x2ad27f = null) {
			const _0x132e78 = _0x13bdb2;
			let _0x2c3121 = _0x2ad27f ? new Date(_0x2ad27f) : new Date(),
				_0x45d059 = {
					"M+": _0x1f223e[_0x132e78(621)](_0x2c3121[_0x132e78(321) + _0x132e78(267)](), 1),
					"d+": _0x2c3121[_0x132e78(600) + "te"](),
					"h+": _0x2c3121["getHo" + _0x132e78(367)](),
					"m+": _0x2c3121[_0x132e78(401) + _0x132e78(271)](),
					"s+": _0x2c3121["getSe" + _0x132e78(495)](),
					"q+": Math[_0x132e78(536)](_0x1f223e[_0x132e78(508)](_0x2c3121[_0x132e78(321) + _0x132e78(267)]() + 3, 3)),
					S: this[_0x132e78(623) + "r"](_0x2c3121[_0x132e78(401) + _0x132e78(525) + "conds"](), 3),
				};
			/(y+)/[_0x132e78(168)](_0x4e1333) &&
				(_0x4e1333 = _0x4e1333[_0x132e78(529) + "ce"](
					RegExp.$1,
					_0x1f223e
						.AWKvC(_0x2c3121[_0x132e78(501) + _0x132e78(169) + "r"](), "")
						[_0x132e78(627) + "r"](_0x1f223e.ALeIJ(4, RegExp.$1[_0x132e78(498) + "h"]))
				));
			for (let _0x420378 in _0x45d059)
				new RegExp(_0x1f223e[_0x132e78(621)]("(", _0x420378) + ")")[_0x132e78(168)](_0x4e1333) &&
					(_0x4e1333 = _0x4e1333[_0x132e78(529) + "ce"](
						RegExp.$1,
						_0x1f223e.tbZvo(1, RegExp.$1[_0x132e78(498) + "h"])
							? _0x45d059[_0x420378]
							: _0x1f223e[_0x132e78(621)]("00", _0x45d059[_0x420378]).substr(
									_0x1f223e.AambM("", _0x45d059[_0x420378])[_0x132e78(498) + "h"]
							  )
					));
			return _0x4e1333;
		}
		async [_0x13bdb2(324) + "sg"]() {
			const _0x16b45f = _0x13bdb2;
			if (!this[_0x16b45f(149) + _0x16b45f(384)]) {
				return;
			}
			if (!this[_0x16b45f(149) + _0x16b45f(476)].length) {
				return;
			}
			try {
				var _0x23b8d2 = _0x1f223e[_0x16b45f(152)](require, _0x1f223e.LAXiK);
				this.log(_0x1f223e[_0x16b45f(319)]);
				await _0x23b8d2[_0x16b45f(544) + "otify"](
					this[_0x16b45f(283)],
					this[_0x16b45f(149) + _0x16b45f(476)][_0x16b45f(290)]("\n")
				);
			} catch {
				this.log(
					_0x16b45f(348) +
						_0x16b45f(353) +
						_0x16b45f(353) +
						_0x16b45f(353) +
						_0x16b45f(353) +
						_0x16b45f(353) +
						_0x16b45f(329)
				);
				this[_0x16b45f(318)](
					_0x16b45f(513) +
						_0x16b45f(390) +
						"dNoti" +
						_0x16b45f(257) +
						_0x16b45f(607) +
						_0x16b45f(352) +
						_0x16b45f(354) +
						"依赖"
				);
			}
		}
		[_0x13bdb2(623) + "r"](_0x207b14, _0x4c5df8, _0x2a0033 = {}) {
			const _0x45b4d6 = _0x13bdb2;
			let _0x1e40df = _0x2a0033.padding || "0",
				_0xc9ab61 = _0x2a0033.mode || "l",
				_0x125900 = _0x1f223e[_0x45b4d6(152)](String, _0x207b14),
				_0x3e10d8 = _0x1f223e.ylXrP(_0x4c5df8, _0x125900[_0x45b4d6(498) + "h"])
					? _0x4c5df8 - _0x125900[_0x45b4d6(498) + "h"]
					: 0,
				_0x38482b = "";
			for (let _0x397370 = 0; _0x1f223e[_0x45b4d6(322)](_0x397370, _0x3e10d8); _0x397370++) {
				_0x38482b += _0x1e40df;
			}
			_0x1f223e[_0x45b4d6(419)](_0xc9ab61, "r")
				? (_0x125900 = _0x1f223e[_0x45b4d6(474)](_0x125900, _0x38482b))
				: (_0x125900 = _0x38482b + _0x125900);
			return _0x125900;
		}
		[_0x13bdb2(595) + _0x13bdb2(523)](_0x3cc57f, _0x2bd0ec, _0x59a36d = false) {
			const _0xa205d0 = _0x13bdb2;
			let _0x4f6c1c = [];
			for (let _0x43827d of Object[_0xa205d0(248)](_0x3cc57f).sort()) {
				let _0x1a57cb = _0x3cc57f[_0x43827d];
				if (_0x1f223e[_0xa205d0(588)](_0x1a57cb, _0x59a36d)) {
					_0x1a57cb = _0x1f223e.JRpHf(encodeURIComponent, _0x1a57cb);
				}
				_0x4f6c1c[_0xa205d0(200)](_0x1f223e[_0xa205d0(374)](_0x43827d + "=", _0x1a57cb));
			}
			return _0x4f6c1c[_0xa205d0(290)](_0x2bd0ec);
		}
		["str2j" + _0x13bdb2(503)](_0x5dd8a9, _0x4dfef0 = false) {
			const _0x1f85a6 = _0x13bdb2;
			let _0x49e746 = {};
			for (let _0x259052 of _0x5dd8a9[_0x1f85a6(226)]("&")) {
				if (!_0x259052) {
					continue;
				}
				let _0x30854f = _0x259052.indexOf("=");
				if (_0x1f223e.tbZvo(_0x30854f, -1)) {
					continue;
				}
				let _0x51b33b = _0x259052.substr(0, _0x30854f),
					_0x2201f0 = _0x259052.substr(_0x30854f + 1);
				if (_0x4dfef0) {
					_0x2201f0 = _0x1f223e[_0x1f85a6(152)](decodeURIComponent, _0x2201f0);
				}
				_0x49e746[_0x51b33b] = _0x2201f0;
			}
			return _0x49e746;
		}
		[_0x13bdb2(440) + _0x13bdb2(172) + _0x13bdb2(284)](
			_0x56a7a2,
			_0x1e86b1 = "abcde" + _0x13bdb2(373) + _0x13bdb2(526) + "9"
		) {
			const _0xfbce52 = _0x13bdb2;
			let _0x13cad6 = "";
			for (let _0x32c259 of _0x56a7a2) {
				if (_0x1f223e[_0xfbce52(341)](_0x32c259, "x")) {
					_0x13cad6 += _0x1e86b1[_0xfbce52(203) + "t"](
						Math[_0xfbce52(536)](Math.random() * _0x1e86b1[_0xfbce52(498) + "h"])
					);
				} else {
					_0x1f223e[_0xfbce52(463)](_0x32c259, "X")
						? (_0x13cad6 += _0x1e86b1[_0xfbce52(203) + "t"](
								Math[_0xfbce52(536)](_0x1f223e[_0xfbce52(434)](Math.random(), _0x1e86b1[_0xfbce52(498) + "h"]))
						  )[_0xfbce52(429) + _0xfbce52(468) + "e"]())
						: (_0x13cad6 += _0x32c259);
				}
			}
			return _0x13cad6;
		}
		[_0x13bdb2(440) + "mUuid"]() {
			const _0x191eab = _0x13bdb2;
			return this["rando" + _0x191eab(172) + "ern"](_0x1f223e[_0x191eab(451)]);
		}
		[_0x13bdb2(440) + _0x13bdb2(456) + "ng"](
			_0x98302f = 32,
			_0x251fc3 = _0x13bdb2(444) + _0x13bdb2(373) + "45678" + "9"
		) {
			const _0x212849 = _0x13bdb2;
			let _0x27b7e0 = "";
			for (let _0x140d01 = 0; _0x1f223e[_0x212849(500)](_0x140d01, _0x98302f); _0x140d01++) {
				_0x27b7e0 += _0x251fc3.charAt(Math.floor(_0x1f223e.SFwgQ(Math[_0x212849(440) + "m"](), _0x251fc3.length)));
			}
			return _0x27b7e0;
		}
		randomList(_0x3174c0) {
			const _0x18b059 = _0x13bdb2;
			let _0x1ca8be = Math[_0x18b059(536)](Math[_0x18b059(440) + "m"]() * _0x3174c0[_0x18b059(498) + "h"]);
			return _0x3174c0[_0x1ca8be];
		}
		[_0x13bdb2(437)](_0x5d71f8) {
			return new Promise((_0x13e2e7) => setTimeout(_0x13e2e7, _0x5d71f8));
		}
		async [_0x13bdb2(306) + "ow"]() {
			const _0x1dffea = _0x13bdb2;
			await this[_0x1dffea(324) + "sg"]();
			let _0x12cc86 = Date[_0x1dffea(412)](),
				_0x15d519 = _0x1f223e.zOlrm(_0x12cc86 - this.startTime, 1000);
			this[_0x1dffea(318)]("");
			const _0x5967f7 = {};
			_0x5967f7[_0x1dffea(596)] = true;
			this.log("[" + this[_0x1dffea(283)] + (_0x1dffea(362) + _0x1dffea(473)) + _0x15d519 + "秒", _0x5967f7);
			process.exit(0);
		}
		[_0x13bdb2(561) + _0x13bdb2(528) + _0x13bdb2(596)](_0x33d355, _0x32b915 = {}) {
			const _0x586d9e = _0x13bdb2;
			let _0x1740d5 = _0x32b915.len || this["defau" + _0x586d9e(349) + _0x586d9e(626) + _0x586d9e(229) + "n"];
			_0x33d355 = _0x33d355[_0x586d9e(276) + _0x586d9e(345)]();
			let _0x5a38fe = _0x33d355[_0x586d9e(498) + "h"];
			while (_0x5a38fe < _0x1740d5) {
				_0x33d355 += "0";
			}
			_0x5a38fe > _0x1740d5 && (_0x33d355 = _0x33d355.slice(0, 13));
			return _0x1f223e[_0x586d9e(204)](parseInt, _0x33d355);
		}
		async [_0x13bdb2(178) + _0x13bdb2(236)](_0x509a30, _0x9acf04 = {}) {
			const _0x68eea6 = _0x13bdb2;
			let _0x15913e = _0x9acf04.logger || this,
				_0x56db21 = _0x9acf04[_0x68eea6(191) + _0x68eea6(304)] || this["default_wait_in" + _0x68eea6(492) + "l"],
				_0x292a98 = _0x9acf04[_0x68eea6(448)] || this["defau" + _0x68eea6(514) + _0x68eea6(235) + "mit"],
				_0x48bacf = _0x9acf04[_0x68eea6(469)] || this[_0x68eea6(207) + _0x68eea6(514) + _0x68eea6(517) + "ead"];
			if (
				_0x1f223e[_0x68eea6(454)](typeof _0x509a30, _0x1f223e[_0x68eea6(599)]) &&
				_0x509a30[_0x68eea6(334) + _0x68eea6(576)](":")
			) {
				if (_0x509a30["inclu" + _0x68eea6(576)]("-")) {
					_0x509a30 = new Date(_0x509a30)[_0x68eea6(382) + "me"]();
				} else {
					let _0x970a75 = this[_0x68eea6(596)](_0x1f223e[_0x68eea6(580)]);
					_0x509a30 = new Date(_0x970a75 + _0x509a30)[_0x68eea6(382) + "me"]();
				}
			}
			let _0x2c9980 = _0x1f223e[_0x68eea6(287)](
					this[_0x68eea6(561) + _0x68eea6(528) + _0x68eea6(596)](_0x509a30),
					_0x48bacf
				),
				_0x5e7e0d = this[_0x68eea6(596)](_0x1f223e[_0x68eea6(530)], _0x2c9980),
				_0xc66caa = Date[_0x68eea6(412)]();
			_0x1f223e[_0x68eea6(302)](_0xc66caa, _0x2c9980) && (_0x2c9980 += _0x1f223e[_0x68eea6(532)](86400, 1000));
			let _0x53be30 = _0x1f223e[_0x68eea6(287)](_0x2c9980, _0xc66caa);
			if (_0x53be30 > _0x292a98) {
				const _0x72d8c5 = {};
				_0x72d8c5[_0x68eea6(596)] = true;
				_0x15913e[_0x68eea6(318)](
					_0x68eea6(446) + "[" + _0x5e7e0d + _0x68eea6(165) + _0x1f223e[_0x68eea6(428)](_0x292a98, 1000) + "秒,不等待",
					_0x72d8c5
				);
			} else {
				const _0x4bebd1 = {
					time: true,
				};
				_0x15913e.log(
					"离目标时间[" + _0x5e7e0d + _0x68eea6(261) + _0x1f223e[_0x68eea6(565)](_0x53be30, 1000) + "秒,开始等待",
					_0x4bebd1
				);
				while (_0x1f223e[_0x68eea6(273)](_0x53be30, 0)) {
					let _0x412b22 = Math[_0x68eea6(558)](_0x53be30, _0x56db21);
					await this[_0x68eea6(437)](_0x412b22);
					_0xc66caa = Date[_0x68eea6(412)]();
					_0x53be30 = _0x1f223e[_0x68eea6(327)](_0x2c9980, _0xc66caa);
				}
				const _0x49822b = {};
				_0x49822b[_0x68eea6(596)] = true;
				_0x15913e[_0x68eea6(318)](_0x68eea6(571), _0x49822b);
			}
		}
		async [_0x13bdb2(178) + _0x13bdb2(445) + _0x13bdb2(365) + "al"](_0x162518, _0x52edcc) {
			const _0x45eb0a = _0x13bdb2;
			let _0x37b01d = _0x1f223e[_0x45eb0a(550)](Date.now(), _0x162518);
			_0x1f223e[_0x45eb0a(409)](_0x37b01d, _0x52edcc) &&
				(await this.wait(_0x1f223e[_0x45eb0a(287)](_0x52edcc, _0x37b01d)));
		}
	})(_0xb7969a);
}
