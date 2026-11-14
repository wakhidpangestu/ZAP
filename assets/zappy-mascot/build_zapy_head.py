#!/usr/bin/env python3
"""
ZAPPY head / face kit - expression variants of the mascot head, for avatars,
chat bubbles, stickers and app icons.

Reuses the exact head geometry from build_zapy.py (same palette, same markings),
so the face stays identical to the full-body asset.

Output:
    out/zapy_head_<expr>.glb   one file per expression (Head + ears + eyes nodes)
    out/zapy_heads.glb         all expressions side by side (face sheet)
    MANIFEST_HEAD.json         provenance: expressions, tri counts, sha256
"""
import hashlib
import json
import os
from datetime import datetime, timezone

import numpy as np

from build_zapy import (
    ellipsoid,
    Glb, OUT, PALETTE, _rot, build_ear_mesh, build_eye_mesh,
    build_head_mesh, frustum, quat_from_euler, M_CREAM,
)
from build_zapy import HERE

NECK_BOTTOM = 0.407          # exported model sits on y = 0 (rounded base)
NECK_TOP = 0.560             # ends well inside the skull, so no protruding rim


class _Nodes:
    pass


# expression -> (mouth shape, node overrides)
EXPRESSIONS = {
    "neutral":   ("smile", {}),
    "happy":     ("wide",  {"Head": {"rot": (-6, 0, 0)},
                            "EyeL": {"scl": (1, 0.74, 1)}, "EyeR": {"scl": (1, 0.74, 1)},
                            "EarL": {"rot": (0, 0, 14)}, "EarR": {"rot": (0, 0, -14)}}),
    "laugh":     ("open",  {"Head": {"rot": (-10, 0, 0)},
                            "EyeL": {"scl": (1, 0.14, 1)}, "EyeR": {"scl": (1, 0.14, 1)},
                            "EarL": {"rot": (0, 0, 20)}, "EarR": {"rot": (0, 0, -20)}}),
    "wink":      ("smile", {"Head": {"rot": (0, 0, -8)},
                            "EyeR": {"scl": (1, 0.14, 1)},
                            "EarR": {"rot": (0, 0, -16)}}),
    "sleepy":    ("flat",  {"Head": {"rot": (12, 0, -3)},
                            "EyeL": {"scl": (1, 0.22, 1)}, "EyeR": {"scl": (1, 0.22, 1)},
                            "EarL": {"rot": (0, 0, -22)}, "EarR": {"rot": (0, 0, 22)}}),
    "surprised": ("open",  {"Head": {"rot": (-4, 0, 0)},
                            "EyeL": {"scl": (1.12, 1.14, 1.1)}, "EyeR": {"scl": (1.12, 1.14, 1.1)},
                            "EarL": {"rot": (0, 0, 22)}, "EarR": {"rot": (0, 0, -22)}}),
    "thinking":  ("flat",  {"Head": {"rot": (-6, 0, 13)},
                            "EyeR": {"scl": (1, 0.68, 1)},
                            "EarL": {"rot": (0, 0, 12)}}),
    "shy":       ("smile", {"Head": {"rot": (4, 0, -6)},
                            "EyeL": {"scl": (1, 0.86, 1)}, "EyeR": {"scl": (1, 0.86, 1)},
                            "EarL": {"rot": (0, 0, -12)}, "EarR": {"rot": (0, 0, 12)}}),
}
ORDER = ["neutral", "happy", "laugh", "wink", "sleepy", "surprised", "thinking", "shy"]


def head_parts(expr):
    mouth = EXPRESSIONS[expr][0]
    m = build_head_mesh(mouth)
    m.name = "head_%s" % expr
    # neck stub: tapers outward into the jaw so it reads as a neck, not a pedestal
    m.add(frustum((0.0, 0.437, 0.006), (0.0, NECK_TOP, 0.006), 0.118, 0.150, 34), M_CREAM)
    # rounded base rim instead of a flat disc, so the bust does not read as a pedestal
    m.add(ellipsoid((0.0, 0.437, 0.006), (0.121, 0.030, 0.119), 34, 16), M_CREAM)
    parts = [("Head", None, (0.0, NECK_BOTTOM, 0.0), m)]
    for side, tag in ((-1, "L"), (1, "R")):
        ear, pivot = build_ear_mesh(side)
        parts.append(("Ear" + tag, "Head", pivot, ear))
    for side, tag in ((-1, "L"), (1, "R")):
        eye, pivot = build_eye_mesh(side)
        parts.append(("Eye" + tag, "Head", pivot, eye))
    # mesh verts stay pivot-relative (as in the body rig); pivots are rebased so the
    # exported bust sits on y = 0 instead of floating at the body's head height
    shift = np.array([0.0, NECK_BOTTOM, 0.0])
    return [(nm, par, tuple(np.asarray(pv, float) - shift), mesh.shift(pv))
            for (nm, par, pv, mesh) in parts]


def build_nodes(parts, pose, glb, prefix="", root_offset=(0, 0, 0)):
    idx = {}
    pivots = {p[0]: np.asarray(p[2], float) for p in parts}
    nodes = []
    for (name, parent, pivot, mesh) in parts:
        n = {"name": prefix + name, "mesh": glb.add_mesh(mesh)}
        pivot = np.asarray(pivot, float)
        par_pivot = pivots[parent] if parent else np.zeros(3)
        loc = pivot - par_pivot
        p = pose.get(name, {})
        if parent is None:
            loc = loc + np.asarray(root_offset, float)
        n["translation"] = loc
        if "rot" in p:
            n["rotation"] = quat_from_euler(p["rot"])
        if "scl" in p:
            n["scale"] = p["scl"]
        if parent is None:
            n["_root"] = True
        idx[name] = len(nodes)
        nodes.append(n)
        if parent:
            nodes[idx[parent]].setdefault("children", []).append(idx[name])
    return nodes


def main():
    parts = {e: head_parts(e) for e in ORDER}
    tris = sum(p[3].tri_count() for p in parts["neutral"])
    verts = sum(len(p[3].v) for p in parts["neutral"])
    made = []

    for expr in ORDER:
        glb = Glb()
        for (nm, hexc, rough, metal) in PALETTE:
            glb.add_material(nm, hexc, rough, metal)
        nodes = build_nodes(parts[expr], EXPRESSIONS[expr][1], glb)
        path = os.path.join(OUT, "zapy_head_%s.glb" % expr)
        size = glb.write(path, nodes, "ZAPPY_head_%s" % expr)
        made.append((expr, path, size))

    glb = Glb()
    for (nm, hexc, rough, metal) in PALETTE:
        glb.add_material(nm, hexc, rough, metal)
    all_nodes = []
    for i, expr in enumerate(ORDER):
        sub = build_nodes(parts[expr], EXPRESSIONS[expr][1], glb, prefix="%s_" % expr,
                          root_offset=(i * 0.62, 0, 0))
        base = len(all_nodes)
        for n in sub:
            if n.get("children"):
                n["children"] = [c + base for c in n["children"]]
        all_nodes.extend(sub)
    sheet_path = os.path.join(OUT, "zapy_heads.glb")
    sheet_size = glb.write(sheet_path, all_nodes, "ZAPPY_face_sheet")

    manifest = {
        "asset": "ZAPPY_head",
        "kind": "character head / face kit, 3D",
        "generator": "build_zapy_head.py (imports head geometry from build_zapy.py)",
        "provenance": {
            "method": "procedurally authored mesh",
            "paid_provider_used": None,
            "blender_used": False,
            "note": "Same head geometry as the full-body asset; no 3D provider was called.",
        },
        "units": "metres",
        "up_axis": "Y",
        "forward_axis": "+Z",
        "origin": "bottom of the neck stump (sits on y = 0)",
        "palette": {n: {"hex": h, "roughness": r, "metallic": m} for (n, h, r, m) in PALETTE},
        "geometry": {"triangles_per_expression": tris, "vertices_per_expression": verts,
                     "parts": ["Head", "EarL", "EarR", "EyeL", "EyeR"]},
        "expressions": {e: {"mouth": EXPRESSIONS[e][0], "file": "out/zapy_head_%s.glb" % e,
                            "bytes": s} for (e, _f, s) in made},
        "face_sheet": {"file": "out/zapy_heads.glb", "bytes": sheet_size},
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    for e, f, _s in made:
        with open(f, "rb") as fh:
            manifest["expressions"][e]["sha256"] = hashlib.sha256(fh.read()).hexdigest()[:16]
    with open(sheet_path, "rb") as fh:
        manifest["face_sheet"]["sha256"] = hashlib.sha256(fh.read()).hexdigest()[:16]
    with open(os.path.join(HERE, "MANIFEST_HEAD.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)

    print("triangles/expression:", tris, "| vertices:", verts)
    for (e, f, sz) in made:
        print("  %-10s %8d bytes  %s" % (e, sz, os.path.basename(f)))
    print("  sheet    %8d bytes  %s" % (sheet_size, os.path.basename(sheet_path)))


if __name__ == "__main__":
    main()
