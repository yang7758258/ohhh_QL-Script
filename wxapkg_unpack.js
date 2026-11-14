#!/usr/bin/env node
/* -------------------------------------------------------------------------
 *  项目名称：活力伊利（小程序包解包工具）
 *  脚本文件：wxapkg_unpack.js
 *  更新说明：
 *    2026-11-14  Mist  仓库首发：V1MMWX magic + 1024 偏移 XOR 0x64 解包
 * -------------------------------------------------------------------------
 */
/**
 * wxapkg_unpack.js —— 微信小程序包解密 / 解包（PC 微信 RadiumWMPF 版）
 *
 *   用法：node wxapkg_unpack.js <a.wxapkg> [outDir]
 *         node wxapkg_unpack.js <目录> [outDir]     # 目录下所有 .wxapkg
 *
 *   本样本（wx06af0ef532292cd3 / 活力伊利 / 版本 928）的真实格式：
 *     [0,6)      "V1MMWX"                       明文 magic
 *     [6,1024)   填充 / 加密头（未使用，直接跳过）
 *     [1024,..]  整体 XOR 0x64 后的 wxapkg 正文
 *
 *   正文是无 magic 的 wxapkg 索引块：
 *     repeat: nameLen(u32 BE) + name(ASCII) + offset(u32 BE) + size(u32 BE)
 *     末尾若干字节是索引里的第一段（名字被 1024 边界切断，故从 0 扫描入口更稳）
 *
 *   注：网上流传的 AES-128/256-CBC + PBKDF2(appid,"saltiest",1000) 方案对本样本无效
 *       （长度对不上 16 字节块、直解全是乱码）；实测就是单字节 XOR。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const XOR_KEY = 0x64;
const HEADER = 1024;

function payloadOf(file) {
    const buf = fs.readFileSync(file);
    const magic = buf.subarray(0, 6).toString('latin1');
    if (magic === 'V1MMWX') {
        const body = buf.subarray(HEADER);
        const out = Buffer.allocUnsafe(body.length);
        for (let i = 0; i < body.length; i++) out[i] = body[i] ^ XOR_KEY;
        return { payload: out, mode: 'V1MMWX + XOR 0x64' };
    }
    if (buf[0] === 0xbe) return { payload: buf, mode: 'plain wxapkg' };
    throw new Error('未知格式：' + magic);
}

function parseIndex(payload) {
    const isPrintable = (b) => b >= 0x20 && b < 0x7f;
    const entries = [];
    for (let pos = 0; pos + 12 < payload.length; pos++) {
        const len = payload.readUInt32BE(pos);
        if (len < 3 || len > 200) continue;
        if (pos + 4 + len + 8 > payload.length) continue;
        let ok = true;
        for (let i = 0; i < len; i++) if (!isPrintable(payload[pos + 4 + i])) { ok = false; break; }
        if (!ok) continue;
        const name = payload.subarray(pos + 4, pos + 4 + len).toString('latin1');
        if (!name.startsWith('/')) continue;
        const off = payload.readUInt32BE(pos + 4 + len);
        const size = payload.readUInt32BE(pos + 8 + len);
        if (off + size > payload.length || size > 8 * 1024 * 1024) continue;
        entries.push({ name, off, size });
    }
    return entries;
}

function unpack(file, outDir) {
    const { payload, mode } = payloadOf(file);
    const entries = parseIndex(payload);
    if (!entries.length) throw new Error('索引解析失败');
    let n = 0;
    for (const e of entries) {
        const target = path.join(outDir, e.name.replace(/^\/+/, ''));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, payload.subarray(e.off, e.off + e.size));
        n++;
    }
    console.log('[OK] ' + path.basename(file) + '  ' + mode + '  → ' + n + ' 个文件  (' + outDir + ')');
    return entries;
}

function main() {
    const args = process.argv.slice(2);
    if (!args.length) {
        console.log('用法: node wxapkg_unpack.js <a.wxapkg|目录> [outDir]');
        process.exit(1);
    }
    const src = path.resolve(args[0]);
    const outBase = path.resolve(args[1] || './unpacked');
    if (!fs.existsSync(src)) {
        console.error('找不到: ' + src);
        process.exit(1);
    }
    const files = fs.statSync(src).isDirectory()
        ? fs.readdirSync(src).filter((f) => f.endsWith('.wxapkg')).map((f) => path.join(src, f))
        : [src];
    for (const f of files) {
        const name = path.basename(f).replace(/\.wxapkg$/, '');
        unpack(f, path.join(outBase, name));
    }
}

if (require.main === module) main();
module.exports = { payloadOf, parseIndex, unpack };
