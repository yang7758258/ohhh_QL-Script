/*
朴朴超市 v1.01

自动签到和组队赚朴分, 朴分可以抵扣50%的金额
组队瓜分需要4人成团, 每个号每天只能开团和入队各一次
每天跑一两次即可


把获取的refreshToken和备注(非必须)填到文件pupuCookie.txt里(第一次运行会自动创建), 多账号换行或&或@隔开
export pupuCookie="refreshToken#备注"

cron: 26 8,19 * * *
const $ = new Env("朴朴超市");
*/
function _0x48fa(_0x54f820, _0x12bebc) {
	const _0x5332b8 = _0x3527();
	_0x48fa = function (_0x1de8c4, _0x23d74c) {
		_0x1de8c4 = _0x1de8c4 - 187;
		let _0x54d1ea = _0x5332b8[_0x1de8c4];
		return _0x54d1ea;
	};
	return _0x48fa(_0x54f820, _0x12bebc);
}
const _0x4f5288 = _0x48fa;
(function (_0x43b8d7, _0x5d2d2f) {
	const _0x2ca1c4 = _0x48fa,
		_0x25505b = _0x43b8d7();
	while (true) {
		try {
			const _0x2eb464 =
				(parseInt(_0x2ca1c4(619)) / 1) * (parseInt(_0x2ca1c4(423)) / 2) +
				parseInt(_0x2ca1c4(484)) / 3 +
				-parseInt(_0x2ca1c4(264)) / 4 +
				-parseInt(_0x2ca1c4(658)) / 5 +
				(parseInt(_0x2ca1c4(596)) / 6) * (-parseInt(_0x2ca1c4(618)) / 7) +
				(parseInt(_0x2ca1c4(559)) / 8) * (-parseInt(_0x2ca1c4(593)) / 9) +
				(-parseInt(_0x2ca1c4(207)) / 10) * (-parseInt(_0x2ca1c4(501)) / 11);
			if (_0x2eb464 === _0x5d2d2f) {
				break;
			} else {
				_0x25505b.push(_0x25505b.shift());
			}
		} catch (_0x424b0a) {
			_0x25505b.push(_0x25505b.shift());
		}
	}
})(_0x3527, 956733);
const _0x37cb99 = _0x128935(_0x4f5288(382)),
	_0x2561d9 = require("fs"),
	_0x493a69 = require(_0x4f5288(560)),
	_0x5e14f3 = _0x4f5288(232),
	_0x464627 = _0x5e14f3 + (_0x4f5288(239) + _0x4f5288(567)),
	_0x10d311 = 20000,
	_0x229b73 = 3;
function _0x3527() {
	const _0x4dc067 = [
		"idcod",
		"reque",
		"getMi",
		"y_cit",
		"readF",
		"User-",
		"onMsg",
		"]请求超时",
		"lskCF",
		" 如有需要",
		"]错误[",
		"lize_",
		"getTi",
		"请检查同目",
		"decod",
		"drbvV",
		"ity/v",
		"norma",
		"xvpiU",
		"lengt",
		"qTvzk",
		"15 (K",
		"ge/zh",
		"yNCgt",
		"ype/W",
		"FynqW",
		"h/use",
		"e/nea",
		"]队伍失败",
		"s_tok",
		"ZQlnE",
		"resul",
		"axTtS",
		", 获得了",
		"IGIT",
		"kwGrG",
		".46(0",
		"got_c",
		"LKrYV",
		"ction",
		"USSjZ",
		"errms",
		"t/val",
		"jSApi",
		"-----",
		"Mozil",
		"AWrKj",
		"\n====",
		"GkEUH",
		"NHMuw",
		"ECaxO",
		"OEtkw",
		"=====",
		"sCode",
		"Kit/6",
		"leWeb",
		"store",
		"msg",
		"3487470VbqIfl",
		"ecFlM",
		"LSCJS",
		"it_in",
		"rando",
		"nutes",
		"IlbQH",
		"]返回[",
		"roEQj",
		"r_loc",
		"账号[",
		" ----",
		"/wx12",
		"|2|7|",
		"VpIuw",
		"coin",
		"vrnci",
		"2695iGgotC",
		"赖[sen",
		"sSync",
		"sendN",
		"mount",
		"game/",
		"/code",
		"keys",
		"userT",
		"mode",
		"_id",
		"mp_le",
		"dzSZt",
		"catch",
		"erty",
		"uHMpF",
		"lng",
		"HrCan",
		"iNcUY",
		"flag",
		"jutwF",
		"tion_",
		"CUJxr",
		"yVyZC",
		"MM-dd",
		"Agent",
		"]: ",
		"charA",
		"点失败[",
		"SXxgQ",
		"]开始运行",
		"dex",
		"exten",
		"toStr",
		"keep-",
		"r/8.0",
		"getMo",
		"_CN m",
		"str2j",
		"utErr",
		"team",
		"limit",
		"upuap",
		"i.com",
		"wiAFH",
		"auth",
		"rojec",
		"pnfyE",
		"aster",
		"Timeo",
		"rejec",
		"roMes",
		"asdfg",
		"gify",
		"BBjya",
		"mUuid",
		"conds",
		":ss.S",
		"56tEJIrS",
		"got",
		"8 Mic",
		"TAEGF",
		"read_",
		"个账号",
		"bbxZB",
		"ount",
		"e.txt",
		"event",
		"lt_ti",
		"slice",
		"AHNce",
		"now",
		"invit",
		"ion_b",
		"test",
		"脚本版本是",
		"组队未完成",
		"]队伍成功",
		"code",
		"请求[",
		"_coin",
		"uIMCH",
		"mStri",
		"follo",
		"ms)，重",
		"unkno",
		"ahead",
		"join_",
		"MZnTf",
		"suppl",
		"kjqSD",
		"hNWgh",
		"2039373kzQoJf",
		"ist",
		"erCas",
		"678TADrcR",
		"final",
		"t/api",
		"tRRHy",
		"EEgZB",
		"BuSqd",
		"DyJfN",
		"MSVBs",
		"Ouciv",
		"notif",
		"form",
		"ogram",
		"/plac",
		"_code",
		".pupu",
		")，重试第",
		"condi",
		"fmt",
		"urs",
		"ng.ne",
		"DcjyC",
		"/user",
		"74361NmhfkI",
		"42069TunnsE",
		"lHxXR",
		"log",
		"post",
		"JbCEp",
		"eam",
		"do_si",
		"秒,开始等",
		"eMsg",
		"IEfRN",
		"_by_c",
		"helpe",
		"https",
		"JUqSz",
		"otify",
		"push",
		"coin_",
		"ion",
		"IFI L",
		"exitN",
		" NetT",
		"-prox",
		"ead",
		"rknyj",
		"map",
		"nProp",
		" OS X",
		"WEuKf",
		"Beare",
		"KMYiE",
		"LPHAB",
		"Dzgiy",
		"versi",
		"defau",
		"thori",
		"01234",
		"write",
		"repla",
		"userL",
		"7284810JYiYWf",
		"jbXQM",
		"SMzZV",
		"11|8|",
		"refre",
		"hasOw",
		"unt_a",
		"token",
		"senge",
		"现在运行的",
		"查询签到信",
		"---",
		"OfQxf",
		"start",
		"angua",
		"ing",
		"://ca",
		"strin",
		"padSt",
		"getSe",
		"eam_c",
		"mesta",
		"objec",
		"encod",
		"qNlBj",
		"请填入ck",
		"共找到",
		" 默认为你",
		"xxx-x",
		"miVLK",
		"udjnu",
		"sQVZT",
		"xcvbn",
		"git/b",
		"]运行结束",
		"]不存在,",
		"inter",
		"userC",
		"userI",
		"disco",
		"copy",
		"heade",
		"vXHqz",
		"2eb4",
		"179590FuDrFP",
		"team_",
		"未找到变量",
		"user_",
		"wait",
		"jtiot",
		"ntaut",
		"name",
		"sh_to",
		"val",
		"iniPr",
		"Time",
		"hbUEc",
		"locat",
		"读取推送依",
		"json2",
		"15E14",
		"valid",
		"\n----",
		"lates",
		"v2/in",
		"subst",
		"check",
		"YuNLm",
		"已组队成功",
		"pupu",
		"BrvWS",
		"3|1|0",
		"toUpp",
		"hPara",
		"息失败[",
		"HZagL",
		"Cooki",
		"conso",
		"gap_i",
		"url",
		"share",
		"sign/",
		"xPoDI",
		"son",
		"://le",
		"nth",
		"/team",
		"it_ah",
		"time",
		"then",
		"ient/",
		"ALL_D",
		"/leaf",
		"elp",
		"max_h",
		"query",
		"YLkQk",
		"terva",
		"]请求错误",
		"Msg",
		"zgKgv",
		"6328692xUCrZI",
		"stErr",
		"searc",
		" Geck",
		"ern",
		"IifHj",
		"13|5|",
		"sKyxC",
		"f0123",
		"mit",
		"data",
		"floor",
		"cance",
		"05.1.",
		"until",
		"rXGGj",
		"get_p",
		"ZthsV",
		"朴分将于",
		" 推送 =",
		"CK文件[",
		"，共运行了",
		"getFu",
		"IhpLO",
		"commo",
		"ChtQx",
		"WKayh",
		"min",
		"lient",
		"/clie",
		"jGsLO",
		"FhxOj",
		"get_t",
		"ozehq",
		"Code/",
		"FDIsw",
		"help",
		" 签到组队",
		"CRtCV",
		"info",
		"ask",
		"mList",
		"respo",
		"lat",
		"AlLcv",
		"iYxKv",
		"assig",
		"EdCGZ",
		"获取组队码",
		"e/sha",
		"_my_t",
		" 登录 -",
		"can_h",
		"phone",
		"api.c",
		"r/inf",
		"e OS ",
		"_out",
		"acces",
		"nterv",
		"e_jso",
		"edCIS",
		"yStr",
		"签到失败[",
		"pp_st",
		"showm",
		"statu",
		"新建一个,",
		" like",
		"加入账号[",
		"nMsg",
		"pop",
		"26.06",
		".json",
		"join",
		"error",
		"yFlag",
		"nNoti",
		"zyPpg",
		"fy.js",
		"d_cou",
		"x1800",
		"split",
		"inclu",
		"cDUlU",
		"mPatt",
		" 查询 -",
		"]失败, ",
		"，请检查变",
		"56789",
		"remar",
		" CPU ",
		"，最新脚本",
		"wait_",
		"zed",
		"6|12|",
		"cabvt",
		"HAR",
		"near_",
		"oHnKw",
		"alive",
		"组队已满",
		"2 lik",
		"get",
		"om/cl",
		"index",
		"oheAB",
		"ode",
		"afxcy",
		"timeo",
		"OSGgI",
		"ZvYBG",
		"ALL_A",
		"llYea",
		"xxxxx",
		"exit",
		"查询用户信",
		"KdPvi",
		"朴朴超市",
		"IOPar",
		"uth.p",
		"ync",
		"xcy/p",
		"retry",
		"metho",
		"paddi",
		"er_op",
		"parse",
		"env",
		"16_1_",
		"tyzip",
		"aqbXy",
		"epot/",
		"toFix",
		"zip",
		"离目标时间",
		"FBnAm",
		"刷新tok",
		"====",
		"hjklz",
		"Reque",
		"://j1",
		"ken",
		"oreid",
		"SEOat",
		"errco",
		"dkZmZ",
		"sign_",
		"need_",
		"45678",
		"lob/m",
		"e Mac",
		"cXXZc",
		"des",
		"iPhon",
		"filte",
		"lt_wa",
		"utf-8",
		"qwert",
		"58nwTEFn",
		"录下是否有",
		"refix",
	];
	_0x3527 = function () {
		return _0x4dc067;
	};
	return _0x3527();
}
const _0x452dab = 1.01,
	_0x13e27e = _0x4f5288(232),
	_0x198ea4 =
		"https://le" +
		_0x4f5288(372) +
		".codi" +
		_0x4f5288(615) +
		_0x4f5288(598) +
		"/user" +
		_0x4f5288(255) +
		_0x4f5288(386) +
		"rojec" +
		_0x4f5288(468) +
		_0x4f5288(426) +
		_0x4f5288(313) +
		"red-d" +
		_0x4f5288(396) +
		"valid" +
		"Code/" +
		_0x4f5288(196) +
		_0x4f5288(414) +
		_0x4f5288(549) +
		_0x4f5288(507) +
		_0x4f5288(337),
	_0x4b9874 =
		_0x4f5288(471) +
		"la/5." +
		"0 (iP" +
		"hone;" +
		_0x4f5288(355) +
		_0x4f5288(418) +
		_0x4f5288(320) +
		_0x4f5288(393) +
		_0x4f5288(366) +
		_0x4f5288(415) +
		_0x4f5288(645) +
		") App" +
		_0x4f5288(481) +
		_0x4f5288(480) +
		_0x4f5288(277) +
		_0x4f5288(447) +
		"HTML," +
		_0x4f5288(332) +
		_0x4f5288(267) +
		"o) Mo" +
		"bile/" +
		_0x4f5288(223) +
		_0x4f5288(561) +
		_0x4f5288(552) +
		_0x4f5288(666) +
		_0x4f5288(536) +
		_0x4f5288(462) +
		_0x4f5288(345) +
		"2e2c)" +
		_0x4f5288(639) +
		_0x4f5288(450) +
		_0x4f5288(637) +
		_0x4f5288(672) +
		_0x4f5288(448) +
		_0x4f5288(538) +
		_0x4f5288(217) +
		_0x4f5288(607) +
		_0x4f5288(496) +
		"2ef87" +
		"6a713" +
		_0x4f5288(206),
	_0x5b285d = 2000,
	_0x592e57 = 5;
class _0x5dc3bb {
	constructor() {
		const _0x20a081 = _0x4f5288,
			_0x24c645 = {};
		_0x24c645[_0x20a081(486)] = _0x20a081(535) + _0x20a081(364);
		const _0x1f83a7 = _0x24c645;
		this[_0x20a081(369)] = _0x37cb99[_0x20a081(201) + "dx"]++;
		this[_0x20a081(214)] = "";
		this[_0x20a081(224)] = false;
		const _0x2e7047 = {};
		_0x2e7047[_0x20a081(542)] = 0;
		const _0x5015ad = {};
		_0x5015ad["Conne" + _0x20a081(465)] = _0x1f83a7.LSCJS;
		const _0x4081e3 = {
			retry: _0x2e7047,
		};
		_0x4081e3.retry = _0x2e7047;
		_0x4081e3[_0x20a081(373) + "ut"] = _0x10d311;
		_0x4081e3[_0x20a081(584) + "wRedi" + "rect"] = false;
		_0x4081e3.headers = _0x5015ad;
		this[_0x20a081(560)] = _0x493a69[_0x20a081(533) + "d"](_0x4081e3);
	}
	[_0x4f5288(280) + _0x4f5288(425)](_0x4f5787 = {}) {
		const _0x2dbbf6 = _0x4f5288;
		var _0x1f2f74 = "",
			_0x76b73a = _0x37cb99[_0x2dbbf6(200) + _0x2dbbf6(566)].toString().length;
		if (this[_0x2dbbf6(369)]) {
			_0x1f2f74 += _0x2dbbf6(494) + _0x37cb99[_0x2dbbf6(676) + "r"](this[_0x2dbbf6(369)], _0x76b73a) + "]";
		}
		if (this[_0x2dbbf6(214)]) {
			_0x1f2f74 += "[" + this.name + "]";
		}
		return _0x1f2f74;
	}
	[_0x4f5288(621)](_0xbfb8d9, _0x53db7f = {}) {
		const _0x41572b = _0x4f5288,
			_0x39bb6a = {};
		_0x39bb6a[_0x41572b(623)] = function (_0x3d5b8a, _0x210b4c) {
			return _0x3d5b8a + _0x210b4c;
		};
		const _0xb14f1e = _0x39bb6a;
		let _0x53e40b = this["get_p" + _0x41572b(425)]();
		_0x37cb99[_0x41572b(621)](_0xb14f1e[_0x41572b(623)](_0x53e40b, _0xbfb8d9), _0x53db7f);
	}
	async [_0x4f5288(427) + "st"](_0x445864) {
		const _0x28f797 = _0x4f5288,
			_0x4654b1 = {
				DyJfN: _0x28f797(404) + _0x28f797(265) + "or",
				SMzZV: _0x28f797(550) + _0x28f797(540) + "or",
				USSjZ: function (_0x4daabe, _0x30eb18) {
					return _0x4daabe == _0x30eb18;
				},
				uHMpF: _0x28f797(680) + "t",
				vRWtR: "GET",
				FynqW: function (_0x18680b, _0x588609) {
					return _0x18680b(_0x588609);
				},
				YuNLm: _0x28f797(631) + _0x28f797(640) + "y-age" + "nt",
				pnfyE: function (_0x278b1f, _0x2edbb4) {
					return _0x278b1f < _0x2edbb4;
				},
				yNCgt: function (_0x3bbc9b, _0x285897) {
					return _0x3bbc9b > _0x285897;
				},
				dzSZt: function (_0x2110f2, _0x484318) {
					return _0x2110f2 * _0x484318;
				},
				AHNce: _0x28f797(387) + "er",
				DcjyC: function (_0x9129f1, _0x500a80, _0xb234c0) {
					return _0x9129f1(_0x500a80, _0xb234c0);
				},
				VpIuw: function (_0x29f999, _0x2ea9a3, _0x25017f) {
					return _0x29f999(_0x2ea9a3, _0x25017f);
				},
				cXXZc: function (_0x41daa3, _0x1eaf59) {
					return _0x41daa3 - _0x1eaf59;
				},
				oheAB: _0x28f797(586) + "wn",
				lskCF: function (_0x335edc, _0x30ab98) {
					return _0x335edc || _0x30ab98;
				},
				vrnci: function (_0x1d192b, _0x179add) {
					return _0x1d192b === _0x179add;
				},
				rXGGj: _0x28f797(440) + _0x28f797(324) + "n",
				mSUxr: function (_0x28ea24, _0x56f4b4) {
					return _0x28ea24 && _0x56f4b4;
				},
			},
			_0x575d5a = [_0x4654b1[_0x28f797(602)]],
			_0x459041 = [_0x4654b1[_0x28f797(660)]];
		let _0x50d695 = _0x37cb99[_0x28f797(203)](_0x445864),
			_0x4a2d70 = {};
		try {
			let _0x415a30 = null,
				_0x54ce61 = 0,
				_0x5e578a = _0x50d695.fn || _0x50d695[_0x28f797(242)],
				_0x5e600f = _0x50d695["valid" + _0x28f797(609)] || [200];
			if (_0x50d695[_0x28f797(606)]) {
				for (let _0x25dc9f in _0x50d695.form) {
					_0x4654b1[_0x28f797(466)](typeof _0x50d695[_0x28f797(606)][_0x25dc9f], _0x4654b1[_0x28f797(516)]) &&
						(_0x50d695[_0x28f797(606)][_0x25dc9f] = JSON[_0x28f797(675) + _0x28f797(554)](
							_0x50d695[_0x28f797(606)][_0x25dc9f]
						));
				}
			}
			_0x50d695[_0x28f797(388) + "d"] =
				_0x50d695?.[_0x28f797(388) + "d"]?.[_0x28f797(235) + _0x28f797(595) + "e"]() || _0x4654b1.vRWtR;
			if (_0x50d695.searchParams) {
				for (let _0x3f228a in _0x50d695.searchParams) {
					_0x4654b1.USSjZ(
						typeof _0x50d695[_0x28f797(266) + _0x28f797(236) + "ms"][_0x3f228a],
						_0x4654b1[_0x28f797(516)]
					) &&
						(_0x50d695[_0x28f797(266) + _0x28f797(236) + "ms"][_0x3f228a] = JSON["strin" + _0x28f797(554)](
							_0x50d695["searc" + _0x28f797(236) + "ms"][_0x3f228a]
						));
				}
			}
			let _0xc8f535 = _0x50d695[_0x28f797(463) + _0x28f797(292)] || this[_0x28f797(560)];
			_0x50d695.debug_in && console[_0x28f797(621)](_0x50d695);
			while (_0x4654b1[_0x28f797(548)](_0x54ce61, _0x229b73)) {
				if (_0x4654b1[_0x28f797(449)](_0x54ce61, 0)) {
					await _0x37cb99[_0x28f797(211)](_0x4654b1[_0x28f797(513)](_0x5b285d, _0x54ce61));
					let _0x1b0e51 = _0x37cb99[_0x28f797(367)](_0x50d695, _0x4654b1[_0x28f797(571)], null);
					if (_0x1b0e51) {
						let _0x5d2f0a = _0x37cb99[_0x28f797(367)](_0x50d695, "retry" + _0x28f797(390) + "t", {});
						await _0x4654b1[_0x28f797(616)](_0x1b0e51, _0x50d695, _0x5d2f0a);
					}
				}
				_0x54ce61++;
				let _0x576406 = null;
				try {
					let _0x2c9984 = Number(
							_0x50d695?.[_0x28f797(373) + "ut"]?.[_0x28f797(427) + "st"] ||
								_0x50d695?.[_0x28f797(373) + "ut"] ||
								_0x10d311
						),
						_0x3b590e = false,
						_0x6cad05 = Date[_0x28f797(572)](),
						_0x254ba0 = _0x4654b1.FynqW(_0xc8f535, _0x50d695),
						_0x4d7e58 = _0x4654b1[_0x28f797(498)](
							setTimeout,
							() => {
								const _0x396e75 = _0x28f797;
								_0x3b590e = true;
								_0x254ba0[_0x396e75(276) + "l"]();
							},
							_0x2c9984
						);
					await _0x254ba0[_0x28f797(252)](
						(_0xc8827d) => {
							_0x415a30 = _0xc8827d;
						},
						(_0x3e9f7c) => {
							const _0x48dab4 = _0x28f797;
							_0x576406 = _0x3e9f7c;
							_0x415a30 = _0x3e9f7c[_0x48dab4(306) + "nse"];
						}
					)[_0x28f797(597) + "ly"](() => clearTimeout(_0x4d7e58));
					let _0x208981 = Date.now(),
						_0x3c8fbb = _0x4654b1[_0x28f797(416)](_0x208981, _0x6cad05),
						_0x5329ce = _0x415a30?.[_0x28f797(330) + _0x28f797(479)] || null;
					if (_0x3b590e || _0x459041[_0x28f797(347) + _0x28f797(417)](_0x576406?.[_0x28f797(214)])) {
						let _0x1a2906 = "";
						_0x576406?.[_0x28f797(579)] &&
							((_0x1a2906 += "(" + _0x576406[_0x28f797(579)]),
							_0x576406?.[_0x28f797(568)] && (_0x1a2906 += ":" + _0x576406[_0x28f797(568)]),
							(_0x1a2906 += ")"));
						this[_0x28f797(621)](
							"[" +
								_0x5e578a +
								_0x28f797(433) +
								_0x1a2906 +
								"(" +
								_0x3c8fbb +
								(_0x28f797(585) + "试第") +
								_0x54ce61 +
								"次"
						);
					} else {
						if (_0x575d5a[_0x28f797(347) + _0x28f797(417)](_0x576406?.[_0x28f797(214)])) {
							this.log(
								"[" +
									_0x5e578a +
									(_0x28f797(261) + "(") +
									_0x576406.code +
									")(" +
									_0x3c8fbb +
									(_0x28f797(585) + "试第") +
									_0x54ce61 +
									"次"
							);
						} else {
							if (_0x5329ce) {
								_0x576406 &&
									!_0x5e600f["inclu" + _0x28f797(417)](_0x5329ce) &&
									this[_0x28f797(621)](_0x28f797(580) + _0x5e578a + _0x28f797(491) + _0x5329ce + "]");
							} else {
								let { code = _0x4654b1[_0x28f797(370)], name = _0x4654b1.oheAB } = _0x4654b1[_0x28f797(434)](
									_0x576406,
									{}
								);
								this[_0x28f797(621)](_0x28f797(580) + _0x5e578a + _0x28f797(436) + code + "][" + name + "]");
							}
							break;
						}
					}
				} catch (_0x498eee) {
					this[_0x28f797(621)](
						"[" + _0x5e578a + (_0x28f797(261) + "(") + _0x498eee.message + _0x28f797(611) + _0x54ce61 + "次"
					);
				}
			}
			if (_0x4654b1[_0x28f797(500)](_0x415a30, null) || _0x415a30 === undefined) {
				const _0x307026 = {};
				_0x307026["statu" + _0x28f797(479)] = -1;
				_0x307026.headers = null;
				_0x307026[_0x28f797(457) + "t"] = null;
				return _0x307026;
			}
			let { statusCode: _0x219ff0, headers: _0x92c309, body: _0x38c00a } = _0x415a30,
				_0x2a980f = _0x37cb99[_0x28f797(367)](_0x50d695, _0x4654b1[_0x28f797(279)], true);
			if (_0x4654b1.mSUxr(_0x38c00a, _0x2a980f)) {
				try {
					_0x38c00a = JSON[_0x28f797(391)](_0x38c00a);
				} catch {}
			}
			const _0x2d2919 = {};
			_0x2d2919["statu" + _0x28f797(479)] = _0x219ff0;
			_0x2d2919[_0x28f797(204) + "rs"] = _0x92c309;
			_0x2d2919[_0x28f797(457) + "t"] = _0x38c00a;
			_0x4a2d70 = _0x2d2919;
			_0x50d695["debug" + _0x28f797(321)] && console[_0x28f797(621)](_0x4a2d70);
		} catch (_0xb0ab57) {
			console[_0x28f797(621)](_0xb0ab57);
		} finally {
			return _0x4a2d70;
		}
	}
}
let _0x2f36fb = new _0x5dc3bb();
class _0x5f4758 extends _0x5dc3bb {
	constructor(_0x1ca9d3) {
		const _0x56dde1 = _0x4f5288;
		super();
		let _0xde21fd = _0x1ca9d3[_0x56dde1(346)]("#");
		this[_0x56dde1(662) + "sh_to" + _0x56dde1(406)] = _0xde21fd[0];
		this.remark = _0xde21fd?.[1] || "";
		this[_0x56dde1(208) + _0x56dde1(579)] = "";
		this["team_" + _0x56dde1(412) + "help"] = false;
		this[_0x56dde1(208) + _0x56dde1(316) + "elp"] = true;
		this[_0x56dde1(208) + "max_h" + "elp"] = 0;
		this[_0x56dde1(208) + _0x56dde1(630) + _0x56dde1(344) + "nt"] = 0;
		const _0x3583a6 = {};
		_0x3583a6[_0x56dde1(431) + _0x56dde1(526)] = _0x4b9874;
		const _0x545ce9 = {};
		_0x545ce9[_0x56dde1(204) + "rs"] = _0x3583a6;
		this.got = this[_0x56dde1(560)][_0x56dde1(533) + "d"](_0x545ce9);
	}
	async ["user_" + _0x4f5288(662) + _0x4f5288(215) + "ken"](_0x5a0d61 = {}) {
		const _0x45192c = _0x4f5288,
			_0x1b1fd9 = {
				cDUlU: _0x45192c(210) + _0x45192c(662) + _0x45192c(215) + "ken",
				FhxOj: _0x45192c(409) + "de",
				kwGrG: function (_0x1ff220, _0x5995f1) {
					return _0x1ff220 == _0x5995f1;
				},
				EdCGZ: function (_0x329c56, _0x46ec15) {
					return _0x329c56 + _0x46ec15;
				},
				iYxKv: _0x45192c(647) + "r ",
				Ouciv: function (_0x34c3a8) {
					return _0x34c3a8();
				},
				hbUEc: _0x45192c(467) + "g",
			};
		let _0x48da77 = false;
		try {
			const _0x235528 = {};
			_0x235528[_0x45192c(662) + _0x45192c(215) + _0x45192c(406)] =
				this[_0x45192c(662) + _0x45192c(215) + _0x45192c(406)];
			const _0x282a7a = {
				fn: _0x1b1fd9[_0x45192c(348)],
			};
			_0x282a7a.fn = _0x1b1fd9[_0x45192c(348)];
			_0x282a7a[_0x45192c(388) + "d"] = "put";
			_0x282a7a[_0x45192c(242)] =
				_0x45192c(631) +
				"://ca" +
				_0x45192c(384) +
				_0x45192c(543) +
				_0x45192c(544) +
				"/clie" +
				_0x45192c(213) +
				_0x45192c(452) +
				"r/ref" +
				"resh_" +
				_0x45192c(665);
			_0x282a7a.json = _0x235528;
			let _0x2919c3 = _0x282a7a,
				{ result: _0x1fb5ad, statusCode: _0x574cc9 } = await this[_0x45192c(427) + "st"](_0x2919c3),
				_0x3dbfd8 = _0x37cb99[_0x45192c(367)](_0x1fb5ad, _0x1b1fd9[_0x45192c(295)], _0x574cc9);
			if (_0x1b1fd9[_0x45192c(461)](_0x3dbfd8, 0)) {
				this[_0x45192c(224)] = true;
				let {
					access_token: _0x42c57d,
					refresh_token: _0x26b5f6,
					user_id: _0x5b96ca,
					nick_name: _0x312ba1,
				} = _0x1fb5ad?.[_0x45192c(274)];
				this[_0x45192c(322) + _0x45192c(455) + "en"] = _0x42c57d;
				this[_0x45192c(662) + _0x45192c(215) + _0x45192c(406)] = _0x26b5f6;
				this.user_id = _0x5b96ca;
				this[_0x45192c(214)] = this[_0x45192c(354) + "k"] || _0x312ba1;
				this[_0x45192c(560)] = this[_0x45192c(560)][_0x45192c(533) + "d"]({
					headers: {
						Authorization: _0x1b1fd9[_0x45192c(311)](_0x1b1fd9[_0x45192c(309)], _0x42c57d),
						"pp-userid": _0x5b96ca,
					},
				});
				_0x48da77 = true;
				await this["user_" + _0x45192c(303)]();
				_0x1b1fd9[_0x45192c(604)](_0x163725);
			} else {
				let _0x46ff18 = _0x37cb99[_0x45192c(367)](_0x1fb5ad, _0x1b1fd9[_0x45192c(219)], "");
				this[_0x45192c(621)](_0x45192c(401) + "en失败[" + _0x3dbfd8 + _0x45192c(527) + _0x46ff18);
			}
		} catch (_0x1b1755) {
			console.log(_0x1b1755);
		} finally {
			return _0x48da77;
		}
	}
	async [_0x4f5288(210) + _0x4f5288(303)](_0x139c5b = {}) {
		const _0x1502d3 = _0x4f5288,
			_0x1496d7 = {
				vXHqz: _0x1502d3(409) + "de",
				edCIS: function (_0xcb5862, _0x2961ca) {
					return _0xcb5862 == _0x2961ca;
				},
			};
		_0x1496d7.vXHqz = _0x1502d3(409) + "de";
		_0x1496d7.edCIS = function (_0xcb5862, _0x2961ca) {
			return _0xcb5862 == _0x2961ca;
		};
		_0x1496d7[_0x1502d3(194)] = _0x1502d3(467) + "g";
		const _0x1d80aa = _0x1496d7;
		try {
			const _0x2ae655 = {
				fn: "user_" + _0x1502d3(303),
			};
			_0x2ae655.fn = "user_" + _0x1502d3(303);
			_0x2ae655[_0x1502d3(388) + "d"] = _0x1502d3(367);
			_0x2ae655[_0x1502d3(242)] =
				"https" +
				_0x1502d3(674) +
				"uth.p" +
				_0x1502d3(543) +
				_0x1502d3(544) +
				_0x1502d3(293) +
				_0x1502d3(213) +
				"h/use" +
				_0x1502d3(319) +
				"o";
			let _0x5aaf61 = _0x2ae655,
				{ result: _0x25b2d6, statusCode: _0x39e815 } = await this.request(_0x5aaf61),
				_0x544d92 = _0x37cb99[_0x1502d3(367)](_0x25b2d6, _0x1d80aa[_0x1502d3(205)], _0x39e815);
			if (_0x1d80aa[_0x1502d3(325)](_0x544d92, 0)) {
				let { phone: _0x3ae7ad, invite_code: _0x44d5ab } = _0x25b2d6?.[_0x1502d3(274)];
				this[_0x1502d3(317)] = _0x3ae7ad;
				this[_0x1502d3(214)] = this.remark || _0x3ae7ad || this.name;
				this[_0x1502d3(573) + "e_cod" + "e"] = _0x44d5ab;
				this[_0x1502d3(621)]("登录成功");
			} else {
				let _0x17cf4b = _0x37cb99[_0x1502d3(367)](_0x25b2d6, _0x1d80aa[_0x1502d3(194)], "");
				this[_0x1502d3(621)](_0x1502d3(380) + _0x1502d3(237) + _0x544d92 + _0x1502d3(527) + _0x17cf4b);
			}
		} catch (_0x43c449) {
			console[_0x1502d3(621)](_0x43c449);
		}
	}
	async [_0x4f5288(362) + _0x4f5288(220) + _0x4f5288(574) + _0x4f5288(429) + "y"](_0x3d0f8a = {}) {
		const _0x469487 = _0x4f5288,
			_0x50e6c8 = {
				HKWRT: function (_0x25404d, _0x23882d) {
					return _0x25404d + _0x23882d;
				},
				ChtQx: function (_0x322e15, _0x2329cd) {
					return _0x322e15 + _0x2329cd;
				},
			};
		_0x50e6c8.HKWRT = function (_0x25404d, _0x23882d) {
			return _0x25404d + _0x23882d;
		};
		_0x50e6c8.ChtQx = function (_0x322e15, _0x2329cd) {
			return _0x322e15 + _0x2329cd;
		};
		_0x50e6c8[_0x469487(446)] = _0x469487(336);
		_0x50e6c8[_0x469487(521)] = _0x469487(409) + "de";
		_0x50e6c8[_0x469487(192)] = function (_0x57ef12, _0x2dd994) {
			return _0x57ef12 == _0x2dd994;
		};
		_0x50e6c8.IhpLO = _0x469487(467) + "g";
		const _0x408d90 = _0x50e6c8;
		try {
			let _0x17df4b = {
					fn: _0x469487(362) + _0x469487(220) + _0x469487(574) + "y_cit" + "y",
					method: "get",
					url:
						"https://j1" +
						_0x469487(610) +
						_0x469487(318) +
						_0x469487(368) +
						_0x469487(253) +
						_0x469487(482) +
						_0x469487(608) +
						_0x469487(453) +
						_0x469487(493) +
						"ation" +
						_0x469487(629) +
						_0x469487(442) +
						"2",
					searchParams: {
						lng: _0x408d90.HKWRT(
							"119.31",
							_0x37cb99[_0x469487(488) + "mStri" + "ng"](4, _0x37cb99[_0x469487(254) + _0x469487(460)])
						),
						lat: _0x408d90[_0x469487(289)](
							_0x408d90[_0x469487(446)],
							_0x37cb99[_0x469487(488) + _0x469487(583) + "ng"](4, _0x37cb99[_0x469487(254) + _0x469487(460)])
						),
					},
				},
				{ result: _0x50fbab, statusCode: _0x513e95 } = await this[_0x469487(427) + "st"](_0x17df4b),
				_0x5a7eab = _0x37cb99[_0x469487(367)](_0x50fbab, _0x408d90[_0x469487(521)], _0x513e95);
			if (_0x408d90.miVLK(_0x5a7eab, 0)) {
				let _0x19bc4f = _0x50fbab?.["data"];
				this[_0x469487(220) + _0x469487(636)] = _0x37cb99[_0x469487(488) + _0x469487(305)](_0x19bc4f);
				let {
					service_store_id: _0x5b4d12,
					city_zip: _0x541f2e,
					lng_x: _0x4bbe23,
					lat_y: _0x183d9f,
				} = this["locat" + _0x469487(636)];
				this[_0x469487(482) + _0x469487(511)] = _0x5b4d12;
				this[_0x469487(398)] = _0x541f2e;
				this[_0x469487(517)] = _0x4bbe23;
				this[_0x469487(307)] = _0x183d9f;
				const _0x1d8d57 = {};
				_0x1d8d57[_0x469487(328) + _0x469487(407)] = _0x5b4d12;
				_0x1d8d57["pp-ci" + _0x469487(394)] = _0x541f2e;
				const _0x22c4d1 = {};
				_0x22c4d1[_0x469487(204) + "rs"] = _0x1d8d57;
				this.got = this.got[_0x469487(533) + "d"](_0x22c4d1);
			} else {
				let _0x58af6c = _0x37cb99[_0x469487(367)](_0x50fbab, _0x408d90[_0x469487(287)], "");
				this[_0x469487(621)]("选取随机地" + _0x469487(529) + _0x5a7eab + _0x469487(527) + _0x58af6c);
			}
		} catch (_0x55e1d2) {
			console[_0x469487(621)](_0x55e1d2);
		}
	}
	async [_0x4f5288(411) + _0x4f5288(369)](_0x5624af = {}) {
		const _0xfdc119 = _0x4f5288,
			_0x4af5cf = {};
		_0x4af5cf[_0xfdc119(302)] = "sign_" + _0xfdc119(369);
		_0x4af5cf[_0xfdc119(259)] = _0xfdc119(367);
		_0x4af5cf[_0xfdc119(628)] = _0xfdc119(409) + "de";
		_0x4af5cf.taUyg = function (_0x3fae64, _0x2f6e09) {
			return _0x3fae64 == _0x2f6e09;
		};
		_0x4af5cf[_0xfdc119(193)] = _0xfdc119(467) + "g";
		const _0x1b506d = _0x4af5cf;
		try {
			const _0x2786c4 = {
				fn: _0x1b506d[_0xfdc119(302)],
			};
			_0x2786c4.fn = _0x1b506d[_0xfdc119(302)];
			_0x2786c4[_0xfdc119(388) + "d"] = _0x1b506d[_0xfdc119(259)];
			_0x2786c4[_0xfdc119(242)] =
				_0xfdc119(631) +
				"://j1" +
				_0xfdc119(610) +
				_0xfdc119(318) +
				_0xfdc119(368) +
				_0xfdc119(253) +
				"game/" +
				_0xfdc119(244) +
				_0xfdc119(227) +
				_0xfdc119(532);
			let _0x32309f = _0x2786c4,
				{ result: _0x43451f, statusCode: _0x579d63 } = await this[_0xfdc119(427) + "st"](_0x32309f),
				_0x3eb9e3 = _0x37cb99[_0xfdc119(367)](_0x43451f, _0x1b506d.IEfRN, _0x579d63);
			if (_0x1b506d.taUyg(_0x3eb9e3, 0)) {
				let { is_signed: _0x2e7fe6 } = _0x43451f?.[_0xfdc119(274)];
				_0x2e7fe6 ? this[_0xfdc119(621)]("今天已签到") : await this[_0xfdc119(625) + "gn"]();
			} else {
				let _0x5ccc3c = _0x37cb99[_0xfdc119(367)](_0x43451f, _0x1b506d[_0xfdc119(193)], "");
				this[_0xfdc119(621)](_0xfdc119(668) + _0xfdc119(237) + _0x3eb9e3 + _0xfdc119(527) + _0x5ccc3c);
			}
		} catch (_0x4ed99c) {
			console[_0xfdc119(621)](_0x4ed99c);
		}
	}
	async [_0x4f5288(625) + "gn"](_0x1ba8d8 = {}) {
		const _0x5aabba = _0x4f5288,
			_0x512063 = {};
		_0x512063[_0x5aabba(363)] = _0x5aabba(625) + "gn";
		_0x512063[_0x5aabba(620)] = _0x5aabba(622);
		_0x512063.zgKgv = _0x5aabba(409) + "de";
		_0x512063.wvkms = function (_0x5233e8, _0x4b1ea4) {
			return _0x5233e8 == _0x4b1ea4;
		};
		_0x512063[_0x5aabba(601)] = function (_0x238500, _0x2125c2) {
			return _0x238500 / _0x2125c2;
		};
		_0x512063[_0x5aabba(591)] = "errmsg";
		const _0x529626 = _0x512063;
		try {
			const _0x366b8e = {};
			_0x366b8e[_0x5aabba(590) + "ement" + _0x5aabba(511)] = "";
			const _0x35a735 = {
				fn: _0x529626[_0x5aabba(363)],
			};
			_0x35a735.fn = _0x529626[_0x5aabba(363)];
			_0x35a735[_0x5aabba(388) + "d"] = _0x529626[_0x5aabba(620)];
			_0x35a735.url =
				"https" +
				_0x5aabba(405) +
				_0x5aabba(610) +
				_0x5aabba(318) +
				_0x5aabba(368) +
				_0x5aabba(253) +
				_0x5aabba(506) +
				_0x5aabba(244) +
				"v2";
			_0x35a735["searc" + _0x5aabba(236) + "ms"] = _0x366b8e;
			let _0x27870f = _0x35a735,
				{ result: _0x108eb4, statusCode: _0x2ccbc6 } = await this.request(_0x27870f),
				_0xa4620b = _0x37cb99[_0x5aabba(367)](_0x108eb4, _0x529626[_0x5aabba(263)], _0x2ccbc6);
			if (_0x529626.wvkms(_0xa4620b, 0)) {
				let { daily_sign_coin: _0x5759b6, coupon_list = [] } = _0x108eb4?.[_0x5aabba(274)],
					_0x14ee44 = [];
				_0x14ee44.push(_0x5759b6 + "积分");
				for (let _0x22c711 of coupon_list) {
					let _0x2aa7f5 = _0x529626[_0x5aabba(601)](_0x22c711[_0x5aabba(612) + _0x5aabba(522) + "amoun" + "t"], 100)[
							_0x5aabba(397) + "ed"
						](2),
						_0x3e30fa = _0x529626[_0x5aabba(601)](_0x22c711[_0x5aabba(202) + _0x5aabba(664) + _0x5aabba(505)], 100)[
							_0x5aabba(397) + "ed"
						](2);
					_0x14ee44.push("满" + _0x2aa7f5 + "减" + _0x3e30fa + "券");
				}
				this.log("签到成功: " + _0x14ee44[_0x5aabba(338)](", "));
			} else {
				let _0x57bc27 = _0x37cb99[_0x5aabba(367)](_0x108eb4, _0x529626[_0x5aabba(591)], "");
				this[_0x5aabba(621)](_0x5aabba(327) + _0xa4620b + "]: " + _0x57bc27);
			}
		} catch (_0x304e31) {
			console[_0x5aabba(621)](_0x304e31);
		}
	}
	async [_0x4f5288(296) + _0x4f5288(678) + "ode"](_0x617f6 = {}) {
		const _0x25e302 = _0x4f5288,
			_0x408d23 = {
				AWrKj: "get_t" + _0x25e302(678) + _0x25e302(371),
			};
		_0x408d23.AWrKj = "get_t" + _0x25e302(678) + _0x25e302(371);
		_0x408d23[_0x25e302(375)] = _0x25e302(622);
		_0x408d23[_0x25e302(565)] = "errcode";
		_0x408d23[_0x25e302(290)] = function (_0x2f54d7, _0x13e762) {
			return _0x2f54d7 == _0x13e762;
		};
		_0x408d23[_0x25e302(670)] = _0x25e302(467) + "g";
		const _0x191ed5 = _0x408d23;
		try {
			const _0x54e581 = {
				fn: _0x191ed5[_0x25e302(472)],
			};
			_0x54e581.fn = _0x191ed5[_0x25e302(472)];
			_0x54e581[_0x25e302(388) + "d"] = _0x191ed5.ZvYBG;
			_0x54e581[_0x25e302(242)] =
				_0x25e302(631) +
				"://j1" +
				_0x25e302(610) +
				_0x25e302(318) +
				_0x25e302(368) +
				_0x25e302(253) +
				"game/" +
				_0x25e302(635) +
				"share" +
				"/team";
			let _0x580586 = _0x54e581,
				{ result: _0x56792a, statusCode: _0x1454c3 } = await this[_0x25e302(427) + "st"](_0x580586),
				_0x331002 = _0x37cb99.get(_0x56792a, _0x191ed5[_0x25e302(565)], _0x1454c3);
			if (_0x191ed5.WKayh(_0x331002, 0)) {
				this[_0x25e302(208) + _0x25e302(579)] = _0x56792a?.[_0x25e302(274)] || "";
				await this[_0x25e302(229) + _0x25e302(314) + _0x25e302(624)]();
			} else {
				let _0x384910 = _0x37cb99[_0x25e302(367)](_0x56792a, _0x191ed5.OfQxf, "");
				this[_0x25e302(621)](_0x25e302(312) + "失败[" + _0x331002 + _0x25e302(527) + _0x384910);
			}
		} catch (_0x1ed6c3) {
			console[_0x25e302(621)](_0x1ed6c3);
		}
	}
	async [_0x4f5288(229) + _0x4f5288(314) + _0x4f5288(624)](_0x1a9c65 = {}) {
		const _0x5422cd = _0x4f5288,
			_0x11787f = {};
		_0x11787f[_0x5422cd(648)] = "check" + _0x5422cd(314) + "eam";
		_0x11787f[_0x5422cd(518)] = _0x5422cd(409) + "de";
		_0x11787f[_0x5422cd(281)] = _0x5422cd(467) + "g";
		const _0x10220b = _0x11787f;
		try {
			let _0x4dcdfe = {
					fn: _0x10220b[_0x5422cd(648)],
					method: _0x5422cd(367),
					url:
						_0x5422cd(631) +
						_0x5422cd(405) +
						_0x5422cd(610) +
						_0x5422cd(318) +
						_0x5422cd(368) +
						"ient/" +
						"game/" +
						_0x5422cd(635) +
						"share" +
						_0x5422cd(249) +
						"s/" +
						this[_0x5422cd(208) + _0x5422cd(579)],
				},
				{ result: _0x9f0d12, statusCode: _0x4ce78d } = await this[_0x5422cd(427) + "st"](_0x4dcdfe),
				_0x37e7db = _0x37cb99[_0x5422cd(367)](_0x9f0d12, _0x10220b[_0x5422cd(518)], _0x4ce78d);
			if (_0x37e7db == 0) {
				let {
					status: _0x5a036f,
					target_team_member_num: _0xb4aaa,
					current_team_member_num: _0x23893e,
					current_user_reward_coin: _0x3ad227,
				} = _0x9f0d12?.[_0x5422cd(274)];
				switch (_0x5a036f) {
					case 10: {
						this[_0x5422cd(208) + "need_" + "help"] = true;
						this["team_max_h" + _0x5422cd(256)] = _0xb4aaa;
						this[_0x5422cd(208) + _0x5422cd(630) + _0x5422cd(344) + "nt"] = _0x23893e;
						this[_0x5422cd(621)](_0x5422cd(577) + ": " + _0x23893e + "/" + _0xb4aaa);
						break;
					}
					case 30: {
						this.log(_0x5422cd(231) + _0x5422cd(459) + _0x3ad227 + "积分");
						break;
					}
					default: {
						this[_0x5422cd(621)]("组队状态[" + _0x5a036f + "]");
						this[_0x5422cd(621)](": " + JSON["strin" + _0x5422cd(554)](_0x9f0d12?.[_0x5422cd(274)]));
					}
				}
			} else {
				let _0x24a20f = _0x37cb99.get(_0x9f0d12, _0x10220b[_0x5422cd(281)], "");
				this[_0x5422cd(621)]("查询组队信息失败[" + _0x37e7db + _0x5422cd(527) + _0x24a20f);
			}
		} catch (_0x4a0a53) {
			console.log(_0x4a0a53);
		}
	}
	async [_0x4f5288(588) + "team"](_0xa523bd, _0x5e42ba = {}) {
		const _0xffdf5 = _0x4f5288,
			_0x36b079 = {};
		_0x36b079[_0xffdf5(374)] = _0xffdf5(588) + _0xffdf5(541);
		_0x36b079[_0xffdf5(408)] = _0xffdf5(622);
		_0x36b079[_0xffdf5(271)] = _0xffdf5(409) + "de";
		_0x36b079[_0xffdf5(441)] = function (_0x32dba3, _0x40e8a0) {
			return _0x32dba3 == _0x40e8a0;
		};
		_0x36b079[_0xffdf5(308)] = function (_0x1852b0, _0x4adfd9) {
			return _0x1852b0 >= _0x4adfd9;
		};
		_0x36b079[_0xffdf5(269)] = _0xffdf5(467) + "g";
		const _0x1ebb22 = _0x36b079;
		try {
			const _0x2bc811 = {
				fn: _0x1ebb22.OSGgI,
			};
			_0x2bc811.fn = _0x1ebb22.OSGgI;
			_0x2bc811[_0xffdf5(388) + "d"] = _0x1ebb22[_0xffdf5(408)];
			_0x2bc811.url =
				"https" +
				_0xffdf5(405) +
				".pupu" +
				_0xffdf5(318) +
				_0xffdf5(368) +
				_0xffdf5(253) +
				_0xffdf5(506) +
				_0xffdf5(635) +
				_0xffdf5(243) +
				_0xffdf5(249) +
				"s/" +
				_0xa523bd[_0xffdf5(208) + _0xffdf5(579)] +
				"/join";
			let _0x3a13c4 = _0x2bc811,
				{ result: _0x285f2c, statusCode: _0x56fa78 } = await this[_0xffdf5(427) + "st"](_0x3a13c4),
				_0x1424b4 = _0x37cb99.get(_0x285f2c, _0x1ebb22[_0xffdf5(271)], _0x56fa78);
			if (_0x1ebb22.drbvV(_0x1424b4, 0)) {
				this[_0xffdf5(208) + _0xffdf5(316) + _0xffdf5(256)] = false;
				_0xa523bd[_0xffdf5(208) + _0xffdf5(630) + _0xffdf5(344) + "nt"] += 1;
				this[_0xffdf5(621)](
					_0xffdf5(333) +
						_0xa523bd[_0xffdf5(369)] +
						"][" +
						_0xa523bd[_0xffdf5(214)] +
						(_0xffdf5(578) + ": ") +
						_0xa523bd[_0xffdf5(208) + "helpe" + _0xffdf5(344) + "nt"] +
						"/" +
						_0xa523bd[_0xffdf5(208) + _0xffdf5(257) + _0xffdf5(256)]
				);
				_0x1ebb22.AlLcv(
					_0xa523bd["team_" + _0xffdf5(630) + "d_cou" + "nt"],
					_0xa523bd[_0xffdf5(208) + _0xffdf5(257) + "elp"]
				) &&
					((_0xa523bd[_0xffdf5(208) + _0xffdf5(412) + _0xffdf5(300)] = false), _0xa523bd[_0xffdf5(621)](_0xffdf5(365)));
			} else {
				let _0x3cd5d1 = _0x37cb99[_0xffdf5(367)](_0x285f2c, _0x1ebb22[_0xffdf5(269)], "");
				this.log(
					_0xffdf5(333) +
						_0xa523bd[_0xffdf5(369)] +
						"][" +
						_0xa523bd[_0xffdf5(214)] +
						(_0xffdf5(454) + "[") +
						_0x1424b4 +
						_0xffdf5(527) +
						_0x3cd5d1
				);
				switch (_0x1424b4) {
					case 100007: {
						_0xa523bd["team_" + _0xffdf5(412) + _0xffdf5(300)] = false;
						break;
					}
					case 100009: {
						this[_0xffdf5(208) + "can_h" + _0xffdf5(256)] = false;
						break;
					}
				}
			}
		} catch (_0x39b1e) {
			console[_0xffdf5(621)](_0x39b1e);
		}
	}
	async ["query" + _0x4f5288(581)](_0x562a07 = {}) {
		const _0x1df86b = _0x4f5288,
			_0x3cfdc8 = {};
		_0x3cfdc8[_0x1df86b(524)] = _0x1df86b(258) + _0x1df86b(581);
		_0x3cfdc8.IOPar = _0x1df86b(367);
		_0x3cfdc8.YSvle = _0x1df86b(409) + "de";
		_0x3cfdc8[_0x1df86b(400)] = function (_0x5568d0, _0x5d093e) {
			return _0x5568d0 == _0x5d093e;
		};
		_0x3cfdc8[_0x1df86b(410)] = function (_0x530b57, _0x521e4c) {
			return _0x530b57 && _0x521e4c;
		};
		_0x3cfdc8[_0x1df86b(545)] = "yyyy-MM-dd";
		_0x3cfdc8[_0x1df86b(297)] = "errmsg";
		const _0x2416eb = _0x3cfdc8;
		try {
			const _0x11c6e5 = {
				fn: _0x2416eb[_0x1df86b(524)],
				method: _0x2416eb[_0x1df86b(383)],
			};
			_0x11c6e5.fn = _0x2416eb[_0x1df86b(524)];
			_0x11c6e5.method = _0x2416eb[_0x1df86b(383)];
			_0x11c6e5[_0x1df86b(242)] =
				_0x1df86b(631) + _0x1df86b(405) + _0x1df86b(610) + _0x1df86b(318) + _0x1df86b(368) + "ient/" + _0x1df86b(499);
			let _0x559a8e = _0x11c6e5,
				{ result: _0x4b47df, statusCode: _0x5a10ab } = await this[_0x1df86b(427) + "st"](_0x559a8e),
				_0x24bb2e = _0x37cb99[_0x1df86b(367)](_0x4b47df, _0x2416eb.YSvle, _0x5a10ab);
			if (_0x2416eb[_0x1df86b(400)](_0x24bb2e, 0)) {
				let { balance: _0x3ac9d0, expiring_coin: _0x2d5517, expire_time: _0x184244 } = _0x4b47df?.["data"];
				const _0x5f2e20 = {};
				_0x5f2e20[_0x1df86b(605) + "y"] = true;
				this[_0x1df86b(621)]("朴分: " + _0x3ac9d0, _0x5f2e20);
				if (_0x2416eb[_0x1df86b(410)](_0x2d5517, _0x184244)) {
					let _0x4ab83a = _0x37cb99[_0x1df86b(251)](_0x2416eb[_0x1df86b(545)], _0x184244);
					const _0xca13c2 = {};
					_0xca13c2[_0x1df86b(605) + "y"] = true;
					this.log("有" + _0x2d5517 + _0x1df86b(282) + _0x4ab83a + "过期", _0xca13c2);
				}
			} else {
				let _0x1b4f29 = _0x37cb99.get(_0x4b47df, _0x2416eb.ozehq, "");
				const _0x4ad6b2 = {};
				_0x4ad6b2[_0x1df86b(605) + "y"] = true;
				this[_0x1df86b(621)]("查询朴分失败[" + _0x24bb2e + _0x1df86b(527) + _0x1b4f29, _0x4ad6b2);
			}
		} catch (_0x2a45eb) {
			console[_0x1df86b(621)](_0x2a45eb);
		}
	}
	async [_0x4f5288(509) + _0x4f5288(304)](_0x57bb07 = {}) {
		const _0x3cb412 = _0x4f5288;
		await this[_0x3cb412(210) + _0x3cb412(303)]();
		await this["near_" + _0x3cb412(220) + "ion_b" + "y_cit" + "y"]();
		await this[_0x3cb412(411) + _0x3cb412(369)]();
		await this[_0x3cb412(296) + _0x3cb412(678) + _0x3cb412(371)]();
	}
}
function _0x3a159d() {
	const _0x2be9aa = _0x4f5288,
		_0x4616d9 = {};
	_0x4616d9[_0x2be9aa(519)] = "utf-8";
	const _0x2333ea = _0x4616d9;
	if (_0x2561d9["exist" + _0x2be9aa(503)]("./" + _0x464627)) {
		const _0x56113a = {
			flag: "r",
		};
		_0x56113a.flag = "r";
		_0x56113a[_0x2be9aa(681) + "ing"] = _0x2333ea[_0x2be9aa(519)];
		let _0x42cae9 = _0x2561d9[_0x2be9aa(430) + "ileSy" + "nc"]("./" + _0x464627, _0x56113a);
		_0x42cae9 =
			_0x42cae9?.[_0x2be9aa(656) + "ce"](/\r/g, "")
				?.["split"]("\n")
				?.[_0x2be9aa(419) + "r"]((_0x232085) => _0x232085) || [];
		for (let _0x3c3316 of _0x42cae9) {
			_0x37cb99[_0x2be9aa(657) + _0x2be9aa(594)].push(new _0x5f4758(_0x3c3316));
		}
	} else {
		const _0x497815 = {};
		_0x497815[_0x2be9aa(520)] = "w";
		_0x497815[_0x2be9aa(681) + _0x2be9aa(673)] = _0x2333ea[_0x2be9aa(519)];
		_0x2561d9[_0x2be9aa(655) + "FileS" + _0x2be9aa(385)]("./" + _0x464627, "", _0x497815);
		_0x37cb99[_0x2be9aa(621)](
			_0x2be9aa(284) + _0x464627 + (_0x2be9aa(198) + _0x2be9aa(190) + _0x2be9aa(331) + _0x2be9aa(435) + _0x2be9aa(188))
		);
	}
	_0x37cb99.userCount = _0x37cb99["userL" + _0x2be9aa(594)][_0x2be9aa(445) + "h"];
	if (!_0x37cb99[_0x2be9aa(200) + "ount"]) {
		const _0x2447a3 = {};
		_0x2447a3[_0x2be9aa(605) + "y"] = true;
		_0x37cb99.log(_0x2be9aa(209) + "，请检查文" + "件[" + _0x464627 + "]", _0x2447a3);
		return false;
	}
	_0x37cb99[_0x2be9aa(621)](_0x2be9aa(189) + _0x37cb99[_0x2be9aa(200) + "ount"] + _0x2be9aa(564));
	return true;
}
function _0x163725() {
	const _0x49d461 = _0x4f5288,
		_0x26e855 = {};
	_0x26e855[_0x49d461(360)] = _0x49d461(421);
	const _0x15bc2d = _0x26e855;
	let _0x3532b5 = [];
	for (let _0x3c70b9 of _0x37cb99[_0x49d461(657) + _0x49d461(594)]) {
		let _0x463db9 = _0x3c70b9[_0x49d461(354) + "k"] || _0x3c70b9.mobile || _0x3c70b9[_0x49d461(214)] || "",
			_0x3dc6fa = _0x3c70b9.refresh_token;
		_0x3532b5[_0x49d461(634)](_0x3dc6fa + "#" + _0x463db9);
	}
	if (_0x3532b5[_0x49d461(445) + "h"]) {
		const _0x5358a7 = {};
		_0x5358a7[_0x49d461(520)] = "w";
		_0x5358a7.encoding = _0x15bc2d[_0x49d461(360)];
		_0x2561d9[_0x49d461(655) + "FileS" + _0x49d461(385)]("./" + _0x464627, _0x3532b5[_0x49d461(338)]("\n"), _0x5358a7);
	}
}
!(async () => {
	const _0x14afa1 = _0x4f5288,
		_0x1d42f4 = {
			ECaxO: function (_0x22eee1) {
				return _0x22eee1();
			},
			BBjya: function (_0x2c7296) {
				return _0x2c7296();
			},
		};
	// if (!(await _0x1d42f4[_0x14afa1(476)](_0x5d7660))) {
	// 	return;
	// }
	if (!_0x1d42f4[_0x14afa1(555)](_0x3a159d)) {
		return;
	}
	_0x37cb99[_0x14afa1(621)](
		"\n----" +
			_0x14afa1(470) +
			_0x14afa1(470) +
			"-----" +
			_0x14afa1(315) +
			_0x14afa1(470) +
			_0x14afa1(470) +
			_0x14afa1(470) +
			_0x14afa1(669)
	);
	for (let _0x28910e of _0x37cb99["userL" + _0x14afa1(594)]) {
		await _0x28910e[_0x14afa1(210) + _0x14afa1(662) + _0x14afa1(215) + _0x14afa1(406)]();
	}
	let _0xb0aaa5 = _0x37cb99["userL" + _0x14afa1(594)][_0x14afa1(419) + "r"]((_0x2d95a7) => _0x2d95a7[_0x14afa1(224)]);
	_0x37cb99[_0x14afa1(621)](
		_0x14afa1(225) +
			"-----" +
			_0x14afa1(470) +
			_0x14afa1(470) +
			_0x14afa1(301) +
			_0x14afa1(495) +
			_0x14afa1(470) +
			"-----" +
			_0x14afa1(470)
	);
	for (let _0x2f3629 of _0xb0aaa5) {
		await _0x2f3629["userT" + _0x14afa1(304)]();
	}
	_0x37cb99[_0x14afa1(621)](
		_0x14afa1(225) +
			_0x14afa1(470) +
			"-----" +
			_0x14afa1(470) +
			" 助力 -" +
			"-----" +
			_0x14afa1(470) +
			_0x14afa1(470) +
			_0x14afa1(669)
	);
	for (let _0x3003b6 of _0xb0aaa5[_0x14afa1(419) + "r"](
		(_0x4431eb) => _0x4431eb[_0x14afa1(208) + "need_" + _0x14afa1(300)]
	)) {
		for (let _0x1261ff of _0xb0aaa5[_0x14afa1(419) + "r"](
			(_0x41013f) =>
				_0x41013f[_0x14afa1(208) + "can_h" + "elp"] && _0x41013f[_0x14afa1(369)] != _0x3003b6[_0x14afa1(369)]
		)) {
			if (!_0x3003b6[_0x14afa1(208) + _0x14afa1(412) + _0x14afa1(300)]) {
				break;
			}
			await _0x1261ff.join_team(_0x3003b6);
		}
	}
	_0x37cb99.log(
		_0x14afa1(225) +
			_0x14afa1(470) +
			"-----" +
			"-----" +
			_0x14afa1(350) +
			_0x14afa1(470) +
			_0x14afa1(470) +
			"-----" +
			_0x14afa1(669)
	);
	for (let _0x239fb0 of _0xb0aaa5) {
		await _0x239fb0[_0x14afa1(258) + _0x14afa1(581)]();
	}
})()
	[_0x4f5288(514)]((_0x2bd776) => _0x37cb99[_0x4f5288(621)](_0x2bd776))
	.finally(() => _0x37cb99.exitNow());
async function _0x5d7660(_0xfea13c = 0) {
	const _0x423fc1 = _0x4f5288,
		_0x528f84 = {
			uIMCH: _0x423fc1(546),
			EEgZB: _0x423fc1(367),
			axTtS: function (_0x4178d5, _0x35d261) {
				return _0x4178d5 != _0x35d261;
			},
			OtZQx: function (_0x1c9e55, _0x43edcf) {
				return _0x1c9e55 < _0x43edcf;
			},
			TAEGF: function (_0x2088f6, _0x534777) {
				return _0x2088f6 > _0x534777;
			},
			WCoIk: function (_0x3ed4ba, _0x425e87) {
				return _0x3ed4ba + _0x425e87;
			},
			Dzgiy: function (_0xa3bf06, _0x3391b3) {
				return _0xa3bf06 > _0x3391b3;
			},
			HmWPU: function (_0x2ee989, _0x163a62) {
				return _0x2ee989 + _0x163a62;
			},
			HZagL: function (_0x2ae270, _0x271f94) {
				return _0x2ae270 == _0x271f94;
			},
			CUJxr: function (_0x25e5c0, _0x52942d) {
				return _0x25e5c0 >= _0x52942d;
			},
			SXxgQ: function (_0x41d4ee, _0x1fcda8) {
				return _0x41d4ee < _0x1fcda8;
			},
			HdvgO: function (_0x4f0436, _0x2555d8) {
				return _0x4f0436(_0x2555d8);
			},
		};
	let _0x3344de = false;
	try {
		const _0x3fa7cf = {
			fn: _0x528f84[_0x423fc1(582)],
		};
		_0x3fa7cf.fn = _0x528f84[_0x423fc1(582)];
		_0x3fa7cf[_0x423fc1(388) + "d"] = _0x528f84[_0x423fc1(600)];
		_0x3fa7cf[_0x423fc1(242)] = _0x198ea4;
		_0x3fa7cf[_0x423fc1(373) + "ut"] = 20000;
		let _0x3f732e = _0x3fa7cf,
			{ statusCode: _0x283cbd, result: _0x31b1b5 } = await _0x2f36fb[_0x423fc1(427) + "st"](_0x3f732e);
		if (_0x528f84[_0x423fc1(458)](_0x283cbd, 200)) {
			_0x528f84.OtZQx(_0xfea13c++, _0x592e57) && (_0x3344de = await _0x5d7660(_0xfea13c));
			return _0x3344de;
		}
		if (_0x31b1b5?.[_0x423fc1(579)] == 0) {
			_0x31b1b5 = JSON[_0x423fc1(391)](_0x31b1b5[_0x423fc1(274)].file[_0x423fc1(274)]);
			if (
				_0x31b1b5?.[_0x423fc1(288) + _0x423fc1(341) + "fy"] &&
				_0x528f84[_0x423fc1(562)](_0x31b1b5[_0x423fc1(288) + _0x423fc1(341) + "fy"][_0x423fc1(445) + "h"], 0)
			) {
				const _0x44a612 = {};
				_0x44a612[_0x423fc1(605) + "y"] = true;
				_0x37cb99[_0x423fc1(621)](
					_0x528f84.WCoIk(_0x31b1b5[_0x423fc1(288) + _0x423fc1(341) + "fy"].join("\n"), "\n"),
					_0x44a612
				);
			}
			_0x31b1b5?.[_0x423fc1(288) + _0x423fc1(334)] &&
				_0x528f84[_0x423fc1(650)](_0x31b1b5["commo" + _0x423fc1(334)][_0x423fc1(445) + "h"], 0) &&
				_0x37cb99.log(_0x528f84.HmWPU(_0x31b1b5.commonMsg[_0x423fc1(338)]("\n"), "\n"));
			if (_0x31b1b5[_0x13e27e]) {
				let _0x3f5e32 = _0x31b1b5[_0x13e27e];
				_0x528f84[_0x423fc1(238)](_0x3f5e32[_0x423fc1(330) + "s"], 0)
					? _0x528f84[_0x423fc1(523)](_0x452dab, _0x3f5e32.version)
						? ((_0x3344de = true),
						  _0x37cb99[_0x423fc1(621)](_0x3f5e32[_0x423fc1(483)][_0x3f5e32.status]),
						  _0x37cb99[_0x423fc1(621)](_0x3f5e32["updat" + _0x423fc1(627)]),
						  _0x37cb99[_0x423fc1(621)](
								_0x423fc1(667) +
									_0x423fc1(576) +
									"：" +
									_0x452dab +
									(_0x423fc1(356) + "版本：") +
									_0x3f5e32[_0x423fc1(226) + "tVers" + _0x423fc1(636)]
						  ))
						: _0x37cb99[_0x423fc1(621)](_0x3f5e32[_0x423fc1(651) + _0x423fc1(432)])
					: _0x37cb99.log(_0x3f5e32[_0x423fc1(483)][_0x3f5e32[_0x423fc1(330) + "s"]]);
			} else {
				_0x37cb99[_0x423fc1(621)](_0x31b1b5[_0x423fc1(339) + _0x423fc1(262)]);
			}
		} else {
			_0x528f84[_0x423fc1(530)](_0xfea13c++, _0x592e57) && (_0x3344de = await _0x528f84.HdvgO(_0x5d7660, _0xfea13c));
		}
	} catch (_0x26bcc1) {
		_0x37cb99.log(_0x26bcc1);
	} finally {
		return _0x3344de;
	}
}
function _0x128935(_0x4941c2) {
	const _0x2c30c4 = _0x4f5288,
		_0x3a52ee = {
			MSVBs: "10|4|" + _0x2c30c4(234) + _0x2c30c4(497) + _0x2c30c4(661) + _0x2c30c4(270) + _0x2c30c4(359) + "14|9",
			xPoDI: function (_0x25343b, _0x2678ac) {
				return _0x25343b * _0x2678ac;
			},
			mIlWm: _0x2c30c4(654) + _0x2c30c4(353),
			OAgEf: "hh:mm:ss",
			ecFlM: function (_0x34cca4, _0x17ef11) {
				return _0x34cca4 + _0x17ef11;
			},
			cHGqY: function (_0x3f44f5, _0x3f3e8a) {
				return _0x3f44f5 + _0x3f3e8a;
			},
			MZnTf: function (_0x11518c, _0x256ead) {
				return _0x11518c + _0x256ead;
			},
			KdPvi: function (_0x6744fd, _0x4d7c57) {
				return _0x6744fd - _0x4d7c57;
			},
			tRRHy: function (_0x56e003, _0x2bb760) {
				return _0x56e003 + _0x2bb760;
			},
			jbXQM: function (_0x578c14, _0x561ec7) {
				return _0x578c14 + _0x561ec7;
			},
			zyPpg: function (_0x15df58, _0x18c450) {
				return _0x15df58 == _0x18c450;
			},
			WEuKf: function (_0x201f6d, _0x182225) {
				return _0x201f6d + _0x182225;
			},
			LKrYV: function (_0x28f419, _0x40ebbe) {
				return _0x28f419(_0x40ebbe);
			},
			hNWgh: "./sendNotify",
			roEQj:
				_0x2c30c4(473) + _0x2c30c4(478) + _0x2c30c4(478) + _0x2c30c4(283) + _0x2c30c4(478) + _0x2c30c4(478) + "===",
			xvpiU: function (_0xa434a3, _0x5eabd5) {
				return _0xa434a3 > _0x5eabd5;
			},
			aqbXy: function (_0x4084b0, _0x4ea7d2) {
				return _0x4084b0 - _0x4ea7d2;
			},
			IlbQH: function (_0x4dbb66, _0x35fe87) {
				return _0x4dbb66 + _0x35fe87;
			},
			npkLZ: function (_0x560185, _0x43ae52) {
				return _0x560185 && _0x43ae52;
			},
			tBDLe: function (_0x9b678a, _0x272797) {
				return _0x9b678a(_0x272797);
			},
			jGsLO: function (_0x3419cb, _0x277abc) {
				return _0x3419cb + _0x277abc;
			},
			jtiot: function (_0x1de3f8, _0x224d49) {
				return _0x1de3f8 + _0x224d49;
			},
			ZQlnE:
				_0x2c30c4(378) + _0x2c30c4(191) + "xxx-x" + "xxx-x" + _0x2c30c4(191) + _0x2c30c4(378) + _0x2c30c4(378) + "x",
			guVGu: function (_0x1d2c82, _0x23ae75) {
				return _0x1d2c82 / _0x23ae75;
			},
			FDIsw: function (_0xce7364, _0x1580cd) {
				return _0xce7364 - _0x1580cd;
			},
			JUqSz: function (_0x20c300, _0x3cad40) {
				return _0x20c300 == _0x3cad40;
			},
			BrvWS: "yyyy-" + _0x2c30c4(525) + " ",
			qNlBj: function (_0x2b17b0, _0x5da43e) {
				return _0x2b17b0 - _0x5da43e;
			},
			jSApi: "hh:mm" + _0x2c30c4(558),
			WvcLB: function (_0x29f523, _0x58811b) {
				return _0x29f523 > _0x58811b;
			},
			OEtkw: function (_0x5f5990, _0x2e0e35) {
				return _0x5f5990 - _0x2e0e35;
			},
			KfzCb: function (_0x504a8d, _0x203ffc) {
				return _0x504a8d / _0x203ffc;
			},
			rknyj: function (_0xa712de, _0x1da1ca) {
				return _0xa712de / _0x1da1ca;
			},
			NHMuw: function (_0x3f0665, _0x337f58) {
				return _0x3f0665 < _0x337f58;
			},
			GkEUH: function (_0x331934, _0x484be9) {
				return _0x331934 - _0x484be9;
			},
		};
	return new (class {
		constructor(_0x309afe) {
			const _0x374b66 = _0x2c30c4,
				_0x58497b = _0x3a52ee[_0x374b66(603)][_0x374b66(346)]("|");
			let _0x25b330 = 0;
			while (true) {
				switch (_0x58497b[_0x25b330++]) {
					case "0":
						this[_0x374b66(605) + _0x374b66(340)] = true;
						continue;
					case "1":
						this[_0x374b66(605) + _0x374b66(326)] = [];
						continue;
					case "2":
						this[_0x374b66(201) + "dx"] = 0;
						continue;
					case "3":
						const _0x4ec938 = {};
						_0x4ec938[_0x374b66(251)] = true;
						this[_0x374b66(621)]("[" + this[_0x374b66(214)] + (_0x374b66(531) + "\n"), _0x4ec938);
						continue;
					case "4":
						this[_0x374b66(671) + _0x374b66(218)] = Date[_0x374b66(572)]();
						continue;
					case "5":
						this[_0x374b66(652) + _0x374b66(420) + "it_li" + _0x374b66(273)] = _0x3a52ee.xPoDI(
							_0x3a52ee[_0x374b66(245)](60, 60),
							1000
						);
						continue;
					case "6":
						this[_0x374b66(652) + "lt_wa" + "it_ah" + _0x374b66(641)] = 0;
						continue;
					case "7":
						this["userL" + _0x374b66(594)] = [];
						continue;
					case "8":
						this[_0x374b66(652) + _0x374b66(569) + _0x374b66(679) + _0x374b66(512) + "n"] = 13;
						continue;
					case "9":
						this["ALL_C" + _0x374b66(361)] =
							this[_0x374b66(254) + _0x374b66(460)] +
							this[_0x374b66(376) + _0x374b66(649) + "ET"] +
							this[_0x374b66(376) + _0x374b66(649) + "ET"]["toUpp" + _0x374b66(595) + "e"]();
						continue;
					case "10":
						this[_0x374b66(214)] = _0x309afe;
						continue;
					case "11":
						this[_0x374b66(200) + _0x374b66(566)] = 0;
						continue;
					case "12":
						this[_0x374b66(254) + "IGIT"] = _0x3a52ee.mIlWm;
						continue;
					case "13":
						this[_0x374b66(652) + _0x374b66(420) + _0x374b66(487) + "terva" + "l"] = 1000;
						continue;
					case "14":
						this["ALL_A" + _0x374b66(649) + "ET"] =
							_0x374b66(422) + "yuiop" + _0x374b66(553) + _0x374b66(403) + _0x374b66(195) + "m";
						continue;
				}
				break;
			}
		}
		[_0x2c30c4(621)](_0x4cb057, _0x397e62 = {}) {
			const _0x5ee613 = _0x2c30c4,
				_0x281c0f = {};
			_0x281c0f[_0x5ee613(240) + "le"] = true;
			let _0x4ff22f = _0x281c0f;
			Object[_0x5ee613(310) + "n"](_0x4ff22f, _0x397e62);
			if (_0x4ff22f.time) {
				let _0x1eff6a = _0x4ff22f[_0x5ee613(613)] || _0x3a52ee.OAgEf;
				_0x4cb057 = _0x3a52ee[_0x5ee613(485)]("[" + this[_0x5ee613(251)](_0x1eff6a) + "]", _0x4cb057);
			}
			if (_0x4ff22f.notify) {
				this[_0x5ee613(605) + _0x5ee613(326)][_0x5ee613(634)](_0x4cb057);
			}
			if (_0x4ff22f[_0x5ee613(240) + "le"]) {
				console[_0x5ee613(621)](_0x4cb057);
			}
		}
		[_0x2c30c4(367)](_0xb69a76, _0x9e0c2b, _0x218036 = "") {
			const _0x526c2b = _0x2c30c4;
			let _0x3ffcfd = _0x218036;
			_0xb69a76?.[_0x526c2b(663) + _0x526c2b(644) + _0x526c2b(515)](_0x9e0c2b) && (_0x3ffcfd = _0xb69a76[_0x9e0c2b]);
			return _0x3ffcfd;
		}
		[_0x2c30c4(335)](_0x45266d, _0x519b27, _0xba6621 = "") {
			const _0xea22ff = _0x2c30c4;
			let _0x2f6844 = _0xba6621;
			_0x45266d?.["hasOwnProp" + _0xea22ff(515)](_0x519b27) &&
				((_0x2f6844 = _0x45266d[_0x519b27]), delete _0x45266d[_0x519b27]);
			return _0x2f6844;
		}
		[_0x2c30c4(203)](_0xc618aa) {
			const _0x54d947 = _0x2c30c4;
			return Object[_0x54d947(310) + "n"]({}, _0xc618aa);
		}
		[_0x2c30c4(563) + _0x2c30c4(392)](_0x48a998) {
			const _0x5961a9 = _0x2c30c4;
			let _0xf73c50 = ckNames[_0x5961a9(643)]((_0xa2c778) => process[_0x5961a9(392)][_0xa2c778]);
			for (let _0x10cbdd of _0xf73c50[_0x5961a9(419) + "r"]((_0x491965) => !!_0x491965)) {
				for (let _0x3036c7 of _0x10cbdd.split(envSplitor)[_0x5961a9(419) + "r"]((_0x2729f3) => !!_0x2729f3)) {
					this[_0x5961a9(657) + _0x5961a9(594)].push(new _0x48a998(_0x3036c7));
				}
			}
			this[_0x5961a9(200) + _0x5961a9(566)] = this["userL" + _0x5961a9(594)][_0x5961a9(445) + "h"];
			if (!this[_0x5961a9(200) + "ount"]) {
				const _0x28902a = {};
				_0x28902a[_0x5961a9(605) + "y"] = true;
				this[_0x5961a9(621)](
					_0x5961a9(209) +
						_0x5961a9(352) +
						"量" +
						ckNames[_0x5961a9(643)]((_0x3603ee) => "[" + _0x3603ee + "]")[_0x5961a9(338)]("或"),
					_0x28902a
				);
				return false;
			}
			this[_0x5961a9(621)]("共找到" + this[_0x5961a9(200) + _0x5961a9(566)] + "个账号");
			return true;
		}
		[_0x2c30c4(251)](_0x17df0c, _0x5e98b1 = null) {
			const _0x5373ef = _0x2c30c4;
			let _0x3b5912 = _0x5e98b1 ? new Date(_0x5e98b1) : new Date(),
				_0x565417 = {
					"M+": _0x3b5912[_0x5373ef(537) + _0x5373ef(248)]() + 1,
					"d+": _0x3b5912.getDate(),
					"h+": _0x3b5912["getHo" + _0x5373ef(614)](),
					"m+": _0x3b5912[_0x5373ef(428) + _0x5373ef(489)](),
					"s+": _0x3b5912[_0x5373ef(677) + _0x5373ef(557)](),
					"q+": Math[_0x5373ef(275)](_0x3a52ee.cHGqY(_0x3b5912["getMo" + _0x5373ef(248)](), 3) / 3),
					S: this[_0x5373ef(676) + "r"](_0x3b5912[_0x5373ef(428) + "llise" + _0x5373ef(557)](), 3),
				};
			/(y+)/.test(_0x17df0c) &&
				(_0x17df0c = _0x17df0c[_0x5373ef(656) + "ce"](
					RegExp.$1,
					_0x3a52ee[_0x5373ef(589)](_0x3b5912[_0x5373ef(286) + _0x5373ef(377) + "r"](), "")[_0x5373ef(228) + "r"](
						_0x3a52ee[_0x5373ef(381)](4, RegExp.$1.length)
					)
				));
			for (let _0x1b26b2 in _0x565417)
				new RegExp(_0x3a52ee[_0x5373ef(599)](_0x3a52ee[_0x5373ef(659)]("(", _0x1b26b2), ")"))[_0x5373ef(575)](
					_0x17df0c
				) &&
					(_0x17df0c = _0x17df0c[_0x5373ef(656) + "ce"](
						RegExp.$1,
						_0x3a52ee[_0x5373ef(342)](1, RegExp.$1.length)
							? _0x565417[_0x1b26b2]
							: _0x3a52ee[_0x5373ef(659)]("00", _0x565417[_0x1b26b2])[_0x5373ef(228) + "r"](
									_0x3a52ee[_0x5373ef(646)]("", _0x565417[_0x1b26b2])[_0x5373ef(445) + "h"]
							  )
					));
			return _0x17df0c;
		}
		async [_0x2c30c4(329) + "sg"]() {
			const _0x132a95 = _0x2c30c4;
			if (!this["notif" + _0x132a95(340)]) {
				return;
			}
			if (!this["notif" + _0x132a95(326)][_0x132a95(445) + "h"]) {
				return;
			}
			try {
				var _0x56258a = _0x3a52ee[_0x132a95(464)](require, _0x3a52ee[_0x132a95(592)]);
				this[_0x132a95(621)](_0x3a52ee[_0x132a95(492)]);
				await _0x56258a[_0x132a95(504) + _0x132a95(633)](
					this[_0x132a95(214)],
					this["notif" + _0x132a95(326)][_0x132a95(338)]("\n")
				);
			} catch {
				this[_0x132a95(621)](
					_0x132a95(473) + _0x132a95(478) + "=====" + _0x132a95(478) + _0x132a95(478) + _0x132a95(478) + _0x132a95(402)
				);
				this[_0x132a95(621)](
					_0x132a95(221) +
						_0x132a95(502) +
						"dNoti" +
						_0x132a95(343) +
						_0x132a95(351) +
						_0x132a95(439) +
						_0x132a95(424) +
						"依赖"
				);
			}
		}
		[_0x2c30c4(676) + "r"](_0x56ea31, _0x5bfd2e, _0x4d2f65 = {}) {
			const _0x43768f = _0x2c30c4;
			let _0x8e047e = _0x4d2f65[_0x43768f(389) + "ng"] || "0",
				_0x3b604a = _0x4d2f65[_0x43768f(510)] || "l",
				_0x2ccb2a = _0x3a52ee.LKrYV(String, _0x56ea31),
				_0x1ade82 = _0x3a52ee[_0x43768f(444)](_0x5bfd2e, _0x2ccb2a.length)
					? _0x3a52ee[_0x43768f(395)](_0x5bfd2e, _0x2ccb2a.length)
					: 0,
				_0x55c902 = "";
			for (let _0x1cf5f2 = 0; _0x1cf5f2 < _0x1ade82; _0x1cf5f2++) {
				_0x55c902 += _0x8e047e;
			}
			_0x3b604a == "r"
				? (_0x2ccb2a = _0x3a52ee[_0x43768f(490)](_0x2ccb2a, _0x55c902))
				: (_0x2ccb2a = _0x55c902 + _0x2ccb2a);
			return _0x2ccb2a;
		}
		[_0x2c30c4(222) + "str"](_0x3adfdc, _0x321ded, _0x1d5fc7 = false) {
			const _0x1c88bb = _0x2c30c4;
			let _0x1031ad = [];
			for (let _0x5083c1 of Object[_0x1c88bb(508)](_0x3adfdc).sort()) {
				let _0x49f9f4 = _0x3adfdc[_0x5083c1];
				if (_0x3a52ee.npkLZ(_0x49f9f4, _0x1d5fc7)) {
					_0x49f9f4 = _0x3a52ee.tBDLe(encodeURIComponent, _0x49f9f4);
				}
				_0x1031ad[_0x1c88bb(634)](_0x3a52ee[_0x1c88bb(294)](_0x3a52ee[_0x1c88bb(212)](_0x5083c1, "="), _0x49f9f4));
			}
			return _0x1031ad[_0x1c88bb(338)](_0x321ded);
		}
		[_0x2c30c4(539) + _0x2c30c4(246)](_0x34766b, _0x2e68cc = false) {
			const _0x4be6db = _0x2c30c4;
			let _0x58903f = {};
			for (let _0x136935 of _0x34766b.split("&")) {
				if (!_0x136935) {
					continue;
				}
				let _0x241769 = _0x136935[_0x4be6db(369) + "Of"]("=");
				if (_0x241769 == -1) {
					continue;
				}
				let _0x40f95d = _0x136935[_0x4be6db(228) + "r"](0, _0x241769),
					_0x171fb8 = _0x136935[_0x4be6db(228) + "r"](_0x241769 + 1);
				if (_0x2e68cc) {
					_0x171fb8 = _0x3a52ee[_0x4be6db(464)](decodeURIComponent, _0x171fb8);
				}
				_0x58903f[_0x40f95d] = _0x171fb8;
			}
			return _0x58903f;
		}
		[_0x2c30c4(488) + _0x2c30c4(349) + _0x2c30c4(268)](_0x2d6af6, _0x517489 = "abcdef0123456789") {
			const _0x565225 = _0x2c30c4;
			let _0x559bdd = "";
			for (let _0x263d6d of _0x2d6af6) {
				if (_0x3a52ee[_0x565225(342)](_0x263d6d, "x")) {
					_0x559bdd += _0x517489[_0x565225(528) + "t"](
						Math.floor(_0x3a52ee[_0x565225(245)](Math[_0x565225(488) + "m"](), _0x517489[_0x565225(445) + "h"]))
					);
				} else {
					_0x263d6d == "X"
						? (_0x559bdd += _0x517489
								.charAt(
									Math[_0x565225(275)](_0x3a52ee.xPoDI(Math[_0x565225(488) + "m"](), _0x517489[_0x565225(445) + "h"]))
								)
								[_0x565225(235) + _0x565225(595) + "e"]())
						: (_0x559bdd += _0x263d6d);
				}
			}
			return _0x559bdd;
		}
		["rando" + _0x2c30c4(556)]() {
			const _0x5de582 = _0x2c30c4;
			return this["rando" + _0x5de582(349) + "ern"](_0x3a52ee[_0x5de582(456)]);
		}
		[_0x2c30c4(488) + "mStri" + "ng"](_0x34b7b2, _0x3a63fb = "abcde" + _0x2c30c4(272) + _0x2c30c4(413) + "9") {
			const _0x3897f5 = _0x2c30c4;
			let _0x6cebb4 = "";
			for (let _0x581f0d = 0; _0x581f0d < _0x34b7b2; _0x581f0d++) {
				_0x6cebb4 += _0x3a63fb[_0x3897f5(528) + "t"](
					Math[_0x3897f5(275)](_0x3a52ee.xPoDI(Math[_0x3897f5(488) + "m"](), _0x3a63fb[_0x3897f5(445) + "h"]))
				);
			}
			return _0x6cebb4;
		}
		[_0x2c30c4(488) + _0x2c30c4(305)](_0x1114eb) {
			let _0x58e570 = Math.floor(Math.random() * _0x1114eb.length);
			return _0x1114eb[_0x58e570];
		}
		wait(_0x41fb20) {
			return new Promise((_0x45eac4) => setTimeout(_0x45eac4, _0x41fb20));
		}
		async [_0x2c30c4(638) + "ow"]() {
			const _0x18f551 = _0x2c30c4;
			await this[_0x18f551(329) + "sg"]();
			let _0x207148 = Date.now(),
				_0x5d8daf = _0x3a52ee.guVGu(_0x3a52ee[_0x18f551(299)](_0x207148, this[_0x18f551(671) + _0x18f551(218)]), 1000);
			this.log("");
			const _0x3183c8 = {};
			_0x3183c8[_0x18f551(251)] = true;
			this.log("[" + this.name + (_0x18f551(197) + _0x18f551(285)) + _0x5d8daf + "秒", _0x3183c8);
			process[_0x18f551(379)](0);
		}
		[_0x2c30c4(443) + _0x2c30c4(437) + _0x2c30c4(251)](_0x3fd950, _0x57f85f = {}) {
			const _0x399c7c = _0x2c30c4;
			let _0x2f11f0 = _0x57f85f.len || this[_0x399c7c(652) + "lt_ti" + _0x399c7c(679) + _0x399c7c(512) + "n"];
			_0x3fd950 = _0x3fd950[_0x399c7c(534) + "ing"]();
			let _0x5f5349 = _0x3fd950[_0x399c7c(445) + "h"];
			while (_0x5f5349 < _0x2f11f0) {
				_0x3fd950 += "0";
			}
			_0x3a52ee[_0x399c7c(444)](_0x5f5349, _0x2f11f0) && (_0x3fd950 = _0x3fd950[_0x399c7c(570)](0, 13));
			return _0x3a52ee[_0x399c7c(464)](parseInt, _0x3fd950);
		}
		async ["wait_" + _0x2c30c4(278)](_0x582606, _0xe0d1c1 = {}) {
			const _0x3fad32 = _0x2c30c4;
			let _0x3096ab = _0xe0d1c1.logger || this,
				_0xb87187 =
					_0xe0d1c1[_0x3fad32(199) + _0x3fad32(216)] ||
					this[_0x3fad32(652) + "lt_wa" + _0x3fad32(487) + _0x3fad32(260) + "l"],
				_0x4aa12e = _0xe0d1c1[_0x3fad32(542)] || this[_0x3fad32(652) + "lt_wa" + "it_li" + _0x3fad32(273)],
				_0x2d07f8 = _0xe0d1c1[_0x3fad32(587)] || this[_0x3fad32(652) + "lt_wa" + _0x3fad32(250) + _0x3fad32(641)];
			if (_0x3a52ee[_0x3fad32(632)](typeof _0x582606, "string") && _0x582606[_0x3fad32(347) + "des"](":")) {
				if (_0x582606[_0x3fad32(347) + _0x3fad32(417)]("-")) {
					_0x582606 = new Date(_0x582606).getTime();
				} else {
					let _0x1bfe5a = this.time(_0x3a52ee[_0x3fad32(233)]);
					_0x582606 = new Date(_0x3a52ee[_0x3fad32(212)](_0x1bfe5a, _0x582606))[_0x3fad32(438) + "me"]();
				}
			}
			let _0x1f4e3a = _0x3a52ee[_0x3fad32(187)](this["norma" + _0x3fad32(437) + _0x3fad32(251)](_0x582606), _0x2d07f8),
				_0xaab303 = this[_0x3fad32(251)](_0x3a52ee[_0x3fad32(469)], _0x1f4e3a),
				_0x550218 = Date[_0x3fad32(572)]();
			_0x3a52ee.WvcLB(_0x550218, _0x1f4e3a) &&
				(_0x1f4e3a += _0x3a52ee[_0x3fad32(245)](_0x3a52ee.xPoDI(24, 60), 60) * 1000);
			let _0x5bbf2c = _0x3a52ee[_0x3fad32(477)](_0x1f4e3a, _0x550218);
			if (_0x3a52ee.WvcLB(_0x5bbf2c, _0x4aa12e)) {
				const _0x24e226 = {};
				_0x24e226[_0x3fad32(251)] = true;
				_0x3096ab[_0x3fad32(621)](
					_0x3fad32(399) + "[" + _0xaab303 + "]大于" + _0x3a52ee.KfzCb(_0x4aa12e, 1000) + "秒,不等待",
					_0x24e226
				);
			} else {
				const _0x1a12f8 = {};
				_0x1a12f8[_0x3fad32(251)] = true;
				_0x3096ab.log(
					_0x3fad32(399) +
						"[" +
						_0xaab303 +
						"]还有" +
						_0x3a52ee[_0x3fad32(642)](_0x5bbf2c, 1000) +
						(_0x3fad32(626) + "待"),
					_0x1a12f8
				);
				while (_0x3a52ee[_0x3fad32(444)](_0x5bbf2c, 0)) {
					let _0x33de31 = Math[_0x3fad32(291)](_0x5bbf2c, _0xb87187);
					await this.wait(_0x33de31);
					_0x550218 = Date[_0x3fad32(572)]();
					_0x5bbf2c = _0x1f4e3a - _0x550218;
				}
				const _0x4f0651 = {
					time: true,
				};
				_0x3096ab.log("已完成等待", _0x4f0651);
			}
		}
		async [_0x2c30c4(357) + _0x2c30c4(241) + _0x2c30c4(323) + "al"](_0x35a463, _0x5d000e) {
			const _0xfa5e4c = _0x2c30c4;
			let _0x1c8072 = _0x3a52ee[_0xfa5e4c(187)](Date.now(), _0x35a463);
			_0x3a52ee[_0xfa5e4c(475)](_0x1c8072, _0x5d000e) &&
				(await this[_0xfa5e4c(211)](_0x3a52ee[_0xfa5e4c(474)](_0x5d000e, _0x1c8072)));
		}
	})(_0x4941c2);
}
