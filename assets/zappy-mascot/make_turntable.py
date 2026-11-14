#!/usr/bin/env python3
"""Slice the rendered turntable grid into an animated GIF/APNG plus an MP4-ready PNG sequence."""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PREV = os.path.join(HERE, "previews")
GRID = os.path.join(PREV, "_turntable_grid.png")
COLS, CELL, N = 6, 340, 36

img = Image.open(GRID).convert("RGB")
arr = np.asarray(img)
frames = []
for i in range(N):
    c, r = i % COLS, i // COLS
    box = (c * CELL, r * CELL, (c + 1) * CELL, (r + 1) * CELL)
    frames.append(img.crop(box))

# crop to a square content box so the character is centred and large
tl = min(f.getbbox()[0] for f in frames)
tt = min(f.getbbox()[1] for f in frames)
tr = max(f.getbbox()[2] for f in frames)
tb = max(f.getbbox()[3] for f in frames)
pad = 12
w, h = tr - tl, tb - tt
side = max(w, h) + pad * 2
cx, cy = (tl + tr) / 2, (tt + tb) / 2
left, top = int(cx - side / 2), int(cy - side / 2)
frames = [f.crop((left, top, left + side, top + side)).resize((480, 480), Image.LANCZOS) for f in frames]

# remove the flat backdrop so the GIF has transparency
cut = []
for f in frames:
    a = np.asarray(f).copy()
    bg = a[2, 2].astype(int)
    dist = np.abs(a.astype(int) - bg).sum(axis=2)
    alpha = np.where(dist < 10, 0, 255).astype(np.uint8)
    rgba = np.dstack([a, alpha])
    cut.append(Image.fromarray(rgba, "RGBA"))

gif_path = os.path.join(PREV, "turntable_idle.gif")
cut[0].save(gif_path, save_all=True, append_images=cut[1:], duration=55, loop=0, disposal=2, optimize=True)

seq = os.path.join(PREV, "turntable_frames")
os.makedirs(seq, exist_ok=True)
for i, f in enumerate(cut):
    f.save(os.path.join(seq, "frame_%03d.png" % i))

print("gif:", gif_path, os.path.getsize(gif_path), "bytes")
print("content box:", (tl, tt, tr, tb), "-> side", side)
print("frames written:", len(os.listdir(seq)))
