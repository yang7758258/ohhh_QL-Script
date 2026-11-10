# -*- coding: utf-8 -*-
"""
雨云签到 · 腾讯 TCaptcha「点选文字（顺序）」求解器
=====================================================
输入：背景图 + 提示字条（170x50）
输出：JSON {"ok":bool,"clicks":[[x,y],...],"conf":float,...}

流程：
 1. 提示字条二值化 → 按列切分出 3 个提示字形（深色笔画）
 2. 背景图 ddddocr(det) 找字框 → 每个字框提「亮核 / 暗边」掩码
 3. 双通道识别：
      A. 文本通道：每字形做 4 种预处理 × (std + beta) 模型，取投票集合
      B. 形状通道：归一化掩码（保持长宽比）IoU + 小角度旋转容错
 4. 综合得分 = 文本通道权重 1.0 + 形状通道权重 0.35，全排列求最优顺序
 5. 置信度不足时 ok=false，交由上层换题重试
"""
import sys, os, io, json, argparse, itertools

def _ensure_deps():
    need = []
    for mod, pkg in (('numpy', 'numpy'), ('PIL', 'pillow'), ('ddddocr', 'ddddocr')):
        try:
            __import__(mod)
        except Exception:
            need.append(pkg)
    if not need:
        return
    import subprocess
    for pkg in need:
        try:
            subprocess.run([sys.executable, '-m', 'pip', 'install', '-q',
                            '-i', 'https://mirrors.aliyun.com/pypi/simple/', pkg],
                           check=False, timeout=600)
        except Exception:
            pass

_ensure_deps()

import numpy as np
from PIL import Image, ImageFilter

_MODELS = {}


def models():
    if not _MODELS:
        import ddddocr
        try:
            _MODELS['det'] = ddddocr.DdddOcr(det=True, show_ad=False)
        except Exception:
            _MODELS['det'] = None
        try:
            _MODELS['std'] = ddddocr.DdddOcr(show_ad=False)
        except Exception:
            _MODELS['std'] = None
        try:
            _MODELS['beta'] = ddddocr.DdddOcr(show_ad=False, beta=True)
        except Exception:
            _MODELS['beta'] = None
    return _MODELS


def _flat(img):
    b = io.BytesIO()
    img.save(b, 'PNG')
    return b.getvalue()


def ocr_votes(img, scale=3):
    """多预处理投票：返回 {识别结果: 命中次数}"""
    m = models()
    votes = {}
    variants = []
    rgb = img.convert('RGB')
    variants.append(rgb)
    big = rgb.resize((max(8, rgb.width * scale), max(8, rgb.height * scale)), Image.LANCZOS)
    pad = Image.new('RGB', (big.width + 24, big.height + 24), (255, 255, 255))
    pad.paste(big, (12, 12))
    variants.append(pad)
    variants.append(Image.fromarray(255 - np.asarray(pad.convert('L'))).convert('RGB'))
    for name in ('std', 'beta'):
        model = m.get(name)
        if not model:
            continue
        for v in variants:
            try:
                t = (model.classification(_flat(v)) or '').strip()
            except Exception:
                t = ''
            if t:
                votes[t] = votes.get(t, 0) + 1
    return votes


def norm_mask(mask, box=64):
    """保持长宽比归一化到 box×box 画布"""
    ys, xs = np.where(mask > 0)
    if len(ys) == 0:
        return np.zeros((box, box), 'uint8'), 1.0
    y1, y2, x1, x2 = ys.min(), ys.max(), xs.min(), xs.max()
    w, h = x2 - x1 + 1, y2 - y1 + 1
    crop = (mask[y1:y2 + 1, x1:x2 + 1] * 255).astype('uint8')
    sc = min((box - 4) / float(w), (box - 4) / float(h))
    nw, nh = max(1, int(w * sc)), max(1, int(h * sc))
    im = Image.fromarray(crop).resize((nw, nh), Image.BILINEAR)
    canvas = Image.new('L', (box, box), 0)
    canvas.paste(im, ((box - nw) // 2, (box - nh) // 2))
    return (np.asarray(canvas) > 110).astype('uint8'), w / float(h)


def iou(a, b):
    i = np.logical_and(a, b).sum()
    u = np.logical_or(a, b).sum()
    return float(i) / float(u) if u else 0.0


def dil(mask, r=1):
    im = Image.fromarray((mask * 255).astype('uint8'))
    return (np.asarray(im.filter(ImageFilter.MaxFilter(2 * r + 1))) > 110).astype('uint8')


def shape_score(a, b, ar_pen=True, ar_a=1.0, ar_b=1.0):
    s = max(iou(a, b), iou(dil(a, 1), b), iou(a, dil(b, 1)))
    best = s
    img = Image.fromarray((b * 255).astype('uint8'))
    for ang in (-24, -12, 12, 24):
        r = (np.asarray(img.rotate(ang, resample=Image.BILINEAR, fillcolor=0)) > 110).astype('uint8')
        rr, _ = norm_mask(r)
        v = iou(a, rr)
        if v > best:
            best = v
    if ar_pen:
        pen = abs(ar_a - ar_b) / max(ar_a, ar_b, 1e-6)
        best -= 0.25 * pen
    return max(0.0, best)


def split_prompt(sprite_path):
    sp = Image.open(sprite_path).convert('L')
    a = np.asarray(sp).astype(int)
    thr = min(int(np.percentile(a, 40)) - 10, 130)
    mask = a < thr
    if mask.mean() > 0.5:
        mask = a > thr
    cols = mask.sum(axis=0)
    runs, st = [], None
    for i, v in enumerate(cols):
        if v > 0 and st is None:
            st = i
        elif v == 0 and st is not None:
            runs.append((st, i - 1))
            st = None
    if st is not None:
        runs.append((st, len(cols) - 1))
    runs = [r for r in runs if r[1] - r[0] >= 4]
    out = []
    for (x1, x2) in runs:
        sub = mask[:, x1:x2 + 1]
        rows = [i for i, v in enumerate(sub.sum(axis=1)) if v > 0]
        if not rows:
            continue
        y1, y2 = rows[0], rows[-1]
        m = mask[y1:y2 + 1, x1:x2 + 1]
        if m.sum() < 60:
            continue
        img = Image.fromarray(np.where(m, 0, 255).astype('uint8')).convert('RGB')
        nm, ar = norm_mask(m)
        out.append(dict(box=(int(x1), int(y1), int(x2), int(y2)), mask=nm, ar=ar,
                        votes=ocr_votes(img), raw=_flat(img)))
    return out


def _components(mask, min_area=400, max_area=12000, min_side=34, max_side=140):
    seen = np.zeros_like(mask, bool)
    ys, xs = np.where(mask)
    H, W = mask.shape
    res = []
    for y0, x0 in zip(ys, xs):
        if seen[y0, x0]:
            continue
        stack = [(y0, x0)]
        seen[y0, x0] = True
        pix = 0
        y1 = y2 = y0
        x1 = x2 = x0
        while stack:
            y, x = stack.pop()
            pix += 1
            if y < y1: y1 = y
            if y > y2: y2 = y
            if x < x1: x1 = x
            if x > x2: x2 = x
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        w = x2 - x1 + 1
        h = y2 - y1 + 1
        if min_area <= pix <= max_area and min_side <= w <= max_side and min_side <= h <= max_side:
            res.append((int(x1), int(y1), int(x2), int(y2)))
    return res


def bg_candidates(bg_path):
    with open(bg_path, 'rb') as f:
        raw = f.read()
    bg = Image.open(io.BytesIO(raw)).convert('RGB')
    gray = bg.convert('L')
    g = np.asarray(gray).astype(int)
    boxes = []
    det = models().get('det')
    if det:
        try:
            for b in det.detection(raw):
                x1, y1, x2, y2 = [int(v) for v in b[:4]]
                boxes.append((x1, y1, x2, y2))
        except Exception:
            pass
    blur = np.asarray(gray.filter(ImageFilter.BoxBlur(10))).astype(int)
    hi = (g > np.maximum(blur + 16, 145))
    lo = (g < np.minimum(blur - 28, 115))
    boxes += _components(hi)
    boxes += _components(lo)
    # 去重
    uniq = []
    for b in boxes:
        x1, y1, x2, y2 = b
        w, h = x2 - x1, y2 - y1
        if w < 34 or h < 34 or w > 140 or h > 140:
            continue
        if abs(w - h) > 0.75 * max(w, h):
            continue
        dup = False
        for c in uniq:
            if abs(c[0] - x1) < 22 and abs(c[1] - y1) < 22:
                dup = True
                break
        if not dup:
            uniq.append((x1, y1, x2, y2))
    out = []
    for (x1, y1, x2, y2) in uniq:
        x1 = max(0, x1); y1 = max(0, y1)
        x2 = min(bg.width - 1, x2); y2 = min(bg.height - 1, y2)
        crop = gray.crop((x1, y1, x2, y2))
        cg = np.asarray(crop).astype(int)
        cb = np.asarray(crop.filter(ImageFilter.BoxBlur(8))).astype(int)
        chi = (cg > np.maximum(cb + 14, 138))
        clo = (cg < np.minimum(cb - 26, 118))
        opts = []
        if chi.sum() > 120:
            nm, ar = norm_mask(chi)
            opts.append((nm, ar, chi))
        if clo.sum() > 120:
            nm, ar = norm_mask(clo)
            opts.append((nm, ar, clo))
        if not opts:
            continue
        opts.sort(key=lambda x: -x[2].sum())
        nm, ar, mk = opts[0]
        img = Image.fromarray(np.where(mk, 0, 255).astype('uint8')).convert('RGB')
        out.append(dict(box=(x1, y1, x2, y2), mask=nm, ar=ar, votes=ocr_votes(img), alt=opts[1:]))
    return out


def text_score(votes_a, votes_b):
    """文本通道得分：完全一致最高，其次包含关系"""
    if not votes_a or not votes_b:
        return 0.0
    best = 0.0
    for ta, ca in votes_a.items():
        for tb, cb in votes_b.items():
            if ta == tb and len(ta) <= 3:
                best = max(best, 1.0 + 0.05 * min(ca, cb))
            elif len(ta) == 1 and len(tb) == 1:
                continue
            elif ta in tb or tb in ta:
                if min(len(ta), len(tb)) >= 1:
                    best = max(best, 0.45)
    return best


def solve(bg_path, sprite_path, debug=False):
    log = []
    P = split_prompt(sprite_path)
    C = bg_candidates(bg_path)
    log.append('提示字形 %d 个: %s' % (len(P), [list(p['votes'].items()) for p in P]))
    log.append('背景候选 %d 个: %s' % (len(C), [(c['box'], list(c['votes'].items())) for c in C]))
    if not P or len(C) < len(P):
        return dict(ok=False, reason='候选不足 P=%d C=%d' % (len(P), len(C)), log=log, clicks=[])
    # 综合矩阵
    M = [[0.0] * len(C) for _ in P]
    detail = []
    for i, p in enumerate(P):
        row = []
        for j, c in enumerate(C):
            ts = text_score(p['votes'], c['votes'])
            ss = shape_score(p['mask'], c['mask'], True, p['ar'], c['ar'])
            M[i][j] = ts + 0.35 * ss
            row.append('%d:t%.2f+s%.2f=%.2f' % (j, ts, ss, M[i][j]))
        detail.append('P%d -> %s' % (i, '  '.join(row)))
    log += detail
    best = None
    for perm in itertools.permutations(range(len(C)), len(P)):
        tot = sum(M[i][perm[i]] for i in range(len(P)))
        if best is None or tot > best[0]:
            best = (tot, perm)
    tot, perm = best
    log.append('最优排列 %s 总分 %.3f' % (str(perm), tot))
    clicks = []
    for i in range(len(P)):
        x1, y1, x2, y2 = C[perm[i]]['box']
        clicks.append([int((x1 + x2) / 2), int((y1 + y2) / 2)])
    # 置信度：文本通道命中数 / 提示数
    hits = sum(1 for i in range(len(P)) if text_score(P[i]['votes'], C[perm[i]]['votes']) >= 1.0)
    conf = round(hits / float(len(P)), 3)
    return dict(ok=hits > 0, clicks=clicks, conf=conf,
                texts=[list(p['votes'].keys()) for p in P],
                bg_texts=[list(C[perm[i]]['votes'].keys()) for i in range(len(P))],
                scores=[round(M[i][perm[i]], 3) for i in range(len(P))], log=log)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bg', required=True)
    ap.add_argument('--sprite', required=True)
    ap.add_argument('--debug', action='store_true')
    a = ap.parse_args()
    r = solve(a.bg, a.sprite, a.debug)
    if a.debug:
        for line in r.get('log', []):
            sys.stderr.write(line + '\n')
    print(json.dumps({k: v for k, v in r.items() if k != 'log'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
