#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ---------------------------------------------------------------------------
#  项目名称：中国联通（点选验证码求解核心）
#  脚本文件：cap_solver.py
#  更新说明：
#    2026-11-01  Mist  仓库整理：统一项目标识、清理隐私信息
# ---------------------------------------------------------------------------
"""
腾讯点选验证码（中国联通 loginRisk）求解核心

候选池 = 连通域自检测 ∪ AntiCAP 模型检测
    - 连通域：纯黑粗线稿 + 严格阈值，能找出被遮挡/模型漏检的图标
    - AntiCAP：YOLO 模型，对标准图标框更准
匹配 = 二值化 → 等比归一化 → 旋转搜索 IoU → 全排列最优分配

对外接口：
    solve_captcha(prompt_bytes, bg_bytes, anticap=None, verbose=True)
      -> {"ok": bool, "clicks": [{x,y,score,src}], "confidence": float, "reason": str}
      clicks 为背景原图像素坐标
"""
import base64
import io
import itertools

import numpy as np
from PIL import Image, ImageFilter

SZ = 100


# ------------------------------------------------------------------ 基础
def _bin(im: Image.Image, thresh: int = 75) -> Image.Image:
    return im.convert("L").point(lambda p: 255 if p < thresh else 0)


def _squash(im: Image.Image, size: int = SZ) -> Image.Image:
    bb = im.getbbox()
    if bb:
        im = im.crop(bb)
    w, h = im.size
    s = size / max(w, h)
    im = im.resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)
    out = Image.new("L", (size, size), 0)
    out.paste(im, ((size - im.width) // 2, (size - im.height) // 2))
    return out


def _np(im: Image.Image) -> np.ndarray:
    return (np.asarray(im, dtype=np.float32) > 100).astype(np.float32)


def _iou_np(a: np.ndarray, b: np.ndarray) -> float:
    inter = float(np.logical_and(a, b).sum())
    union = float(np.logical_or(a, b).sum())
    return inter / union if union else 0.0


def _rot_variants(crop: Image.Image, step: int = 6):
    """
    先旋转（expand=True 保留完整形状），再归一化。
    顺序很关键：若先归一化再旋转，旋转会改变外接框比例，导致形状失真。
    """
    out = []
    for ang in range(0, 360, step):
        r = crop.rotate(ang, resample=Image.BILINEAR, expand=True, fillcolor=0)
        out.append(_np(_squash(r)))
    return out


# ------------------------------------------------------------------ 候选检测
def find_icons_cc(bg_img: Image.Image, thresh: int = 75, min_area: int = 380,
                  max_area: int = 20000, min_side: int = 28, max_side: int = 190):
    """
    严格阈值 + 8 邻域连通域，直接找出背景里的黑色线稿图标。
    不依赖外部模型，能发现被遮挡的图标。
    """
    arr = np.asarray(bg_img.convert("L"), dtype=np.uint8)
    mask = (arr < thresh).astype(np.uint8)
    H, W = mask.shape

    labels = np.zeros((H, W), dtype=np.int32)
    parent = [0]

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    nxt = 1
    for y in range(H):
        row = mask[y]
        if not row.any():
            continue
        for x in range(W):
            if not row[x]:
                continue
            nb = []
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dy == 0 and dx == 0:
                        continue
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and labels[ny, nx]:
                        nb.append(labels[ny, nx])
            if nb:
                m = min(nb)
                labels[y, x] = m
                for v in nb:
                    union(m, v)
            else:
                labels[y, x] = nxt
                parent.append(nxt)
                nxt += 1

    comps = {}
    for y in range(H):
        for x in range(W):
            if labels[y, x]:
                r = find(labels[y, x])
                c = comps.get(r)
                if c is None:
                    comps[r] = {"n": 1, "x1": x, "y1": y, "x2": x, "y2": y}
                else:
                    c["n"] += 1
                    if x < c["x1"]:
                        c["x1"] = x
                    if y < c["y1"]:
                        c["y1"] = y
                    if x > c["x2"]:
                        c["x2"] = x
                    if y > c["y2"]:
                        c["y2"] = y

    out = []
    for r, c in comps.items():
        w = c["x2"] - c["x1"] + 1
        h = c["y2"] - c["y1"] + 1
        if not (min_area <= c["n"] <= max_area):
            continue
        if not (min_side <= w <= max_side and min_side <= h <= max_side):
            continue
        fill = c["n"] / (w * h)
        if not (0.08 <= fill <= 0.85):
            continue
        # 图标近似方形，排除细长条
        if max(w, h) / max(1, min(w, h)) > 2.2:
            continue
        out.append({"box": [c["x1"], c["y1"], c["x2"], c["y2"]],
                    "cx": (c["x1"] + c["x2"]) / 2, "cy": (c["y1"] + c["y2"]) / 2,
                    "area": c["n"], "src": "cc"})
    out.sort(key=lambda d: -d["area"])
    return out


def clean_icon(bg_img: Image.Image, box, pad: int = 2, thresh: int = 75):
    """
    裁出图标并净化：
      1. 严格阈值（图标是接近纯黑）
      2. 形态学开运算（腐蚀→膨胀），剔除穿过的细背景线（草叶/建筑棱边）
      3. 连通域只保留最大块
    """
    x1, y1, x2, y2 = [int(v) for v in box]
    x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
    x2, y2 = min(bg_img.width, x2 + pad), min(bg_img.height, y2 + pad)
    crop = bg_img.crop((x1, y1, x2, y2)).convert("L")
    b = crop.point(lambda p: 255 if p < thresh else 0)
    # 开运算：线稿笔画较粗(~6-10px)，背景细线较细(~1-3px)
    b = b.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    w, h = b.size
    px = b.load()
    seen = [[False] * w for _ in range(h)]
    best = []
    for yy in range(h):
        for xx in range(w):
            if px[xx, yy] and not seen[yy][xx]:
                stack, comp = [(xx, yy)], []
                seen[yy][xx] = True
                while stack:
                    cx, cy = stack.pop()
                    comp.append((cx, cy))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny]:
                                seen[ny][nx] = True
                                stack.append((nx, ny))
                if len(comp) > len(best):
                    best = comp
    if not best:
        return None
    out = Image.new("L", (w, h), 0)
    op = out.load()
    for (cx, cy) in best:
        op[cx, cy] = 255
    return out


def split_prompt(prompt_img: Image.Image):
    """提示条按空白列切分（从左到右）"""
    g = prompt_img.convert("L")
    bw = g.point(lambda p: 255 if p < 110 else 0)
    W, H = g.size
    cols = [any(bw.getpixel((x, y)) for y in range(H)) for x in range(W)]
    segs, st = [], None
    for x, on in enumerate(cols):
        if on and st is None:
            st = x
        elif not on and st is not None:
            if x - st > 6:
                segs.append((st, x))
            st = None
    if st is not None and W - st > 6:
        segs.append((st, W))
    return [g.crop((a, 0, b, H)).point(lambda v: 255 if v < 110 else 0) for a, b in segs], segs


# ------------------------------------------------------------------ 主求解
def solve_captcha(prompt_bytes: bytes, bg_bytes: bytes, anticap=None, verbose=True):
    def log(m):
        if verbose:
            print("    " + m, flush=True)

    bg_img = Image.open(io.BytesIO(bg_bytes)).convert("RGB")
    prompt_img = Image.open(io.BytesIO(prompt_bytes)).convert("L")

    slots_raw, segs = split_prompt(prompt_img)
    log(f"提示条 {len(slots_raw)} 个图标, 分段={segs}")
    if not slots_raw:
        return {"ok": False, "reason": "提示条切分失败", "clicks": [], "confidence": 0}

    # ---- 候选池：连通域 ∪ AntiCAP ----
    cands = list(find_icons_cc(bg_img))
    log(f"连通域检出 {len(cands)} 个")

    if anticap is not None:
        try:
            boxes = anticap.detect_icons(bg_bytes) or []
            log(f"AntiCAP 检出 {len(boxes)} 个")
            for b in boxes:
                x1, y1, x2, y2 = b["box"]
                cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                # 与已有候选去重（70px 内视为同一个）
                dup = any((cx - c["cx"]) ** 2 + (cy - c["cy"]) ** 2 < 70 ** 2 for c in cands)
                if not dup:
                    cands.append({"box": [x1, y1, x2, y2], "cx": cx, "cy": cy,
                                  "area": (x2 - x1) * (y2 - y1), "src": "anticap"})
        except Exception as e:
            log(f"AntiCAP 失败: {e}")

    if not cands:
        return {"ok": False, "reason": "未检出任何背景图标", "clicks": [], "confidence": 0}

    # ---- 每个候选做归一化图形 ----
    bg_items = []
    for c in cands:
        cc = clean_icon(bg_img, c["box"])
        if cc is None:
            continue
        bg_items.append({
            "cx": c["cx"], "cy": c["cy"], "src": c["src"],
            "area": c["area"], "crop": cc,
        })
    log(f"有效候选 {len(bg_items)} 个")

    if len(bg_items) < len(slots_raw):
        return {"ok": False,
                "reason": f"候选不足({len(bg_items)}<{len(slots_raw)})",
                "clicks": [], "confidence": 0}

    # ---- 旋转不变 IoU 全排列最优分配（先旋转后归一化）----
    tpl = [_np(_squash(s)) for s in slots_raw]
    bgv = [_rot_variants(g["crop"]) for g in bg_items]

    n, m = len(tpl), len(bg_items)
    M = np.zeros((n, m), dtype=np.float32)
    for i in range(n):
        for j in range(m):
            M[i, j] = max(_iou_np(tpl[i], v) for v in bgv[j])

    # 候选太多时剪枝：每个模板只保留前 6 名候选
    if m > 6:
        keep = set()
        for i in range(n):
            keep.update(np.argsort(-M[i])[:6].tolist())
        keep = sorted(keep)
        M = M[:, keep]
        bg_items = [bg_items[j] for j in keep]
        m = len(bg_items)

    best_total, best_perm = -1.0, None
    for perm in itertools.permutations(range(m), n):
        t = float(sum(M[i, perm[i]] for i in range(n)))
        if t > best_total:
            best_total, best_perm = t, perm

    clicks = [{
        "x": round(bg_items[j]["cx"], 1),
        "y": round(bg_items[j]["cy"], 1),
        "score": round(float(M[i, j]), 3),
        "src": bg_items[j]["src"],
    } for i, j in enumerate(best_perm)]

    conf = best_total / n
    log("匹配: " + " ".join(f"({c['x']:.0f},{c['y']:.0f})@{c['score']:.2f}/{c['src']}"
                            for c in clicks) + f"  平均={conf:.3f}")

    ok = conf >= 0.34
    return {"ok": ok, "clicks": clicks, "confidence": round(conf, 4),
            "reason": "" if ok else f"置信度不足({conf:.3f})"}
