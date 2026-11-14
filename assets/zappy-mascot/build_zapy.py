#!/usr/bin/env python3
"""
ZAPPY - procedural 3D mascot builder (glTF 2.0 binary / GLB).

A chunky chibi cow figurine, orange + cream, for the ZAP (Zero Answer Policy) project.
No paid 3D provider is used: every vertex is authored here from analytic primitives,
so the asset is deterministic, versionable and free to regenerate.

Output:
    out/zapy_<pose>.glb   one skinned-free node hierarchy per pose (named joints)
    out/zapy_poses.glb    all poses side by side in one scene (pose sheet)
    MANIFEST.json         provenance: palette, poses, triangle counts, sha256
"""
import hashlib
import json
import math
import os
import struct
from datetime import datetime, timezone

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- palette ----
def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_lin(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return [round(srgb_to_linear(c), 5) for c in srgb]


# name -> (hex, roughness, metallic)
PALETTE = [
    ("cream",       "#FFF8F0", 0.62, 0.0),   # 0 body white
    ("cream_shade", "#EDD3B0", 0.70, 0.0),   # 1 muzzle / belly / horns
    ("orange",      "#EE8B3C", 0.55, 0.0),   # 2 signature patches
    ("orange_deep", "#D9702A", 0.52, 0.0),   # 3 hooves / tail tuft
    ("ink",         "#2B1F17", 0.32, 0.0),   # 4 eyes / nose / mouth
    ("blush",       "#F5AE8C", 0.72, 0.0),   # 5 cheeks
    ("white",       "#FFFFFF", 0.25, 0.0),   # 6 eye highlights
]
MAT = {m[0]: i for i, m in enumerate(PALETTE)}
M_CREAM, M_SHADE, M_ORANGE, M_DEEP, M_INK, M_BLUSH, M_WHITE = (
    MAT["cream"], MAT["cream_shade"], MAT["orange"],
    MAT["orange_deep"], MAT["ink"], MAT["blush"], MAT["white"],
)

# ------------------------------------------------------------- primitives ----
def _rot(xyz_deg):
    x, y, z = [math.radians(a) for a in xyz_deg]
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def _apply(verts, norms, center, rot_deg=(0, 0, 0)):
    """Rotate primitive about `center`, then translate to `center`."""
    R = _rot(rot_deg)
    c = np.asarray(center, float)
    V = np.asarray(verts, float)
    N = np.asarray(norms, float)
    return list(map(tuple, (V - c) @ R.T + c)), list(map(tuple, N @ R.T))


def _orient(verts, faces):
    """Flip all faces if the closed mesh has negative signed volume."""
    V = np.asarray(verts, float)
    vol = 0.0
    for (a, b, c) in faces:
        vol += np.dot(V[a], np.cross(V[b], V[c]))
    if vol < 0:
        return [(a, c, b) for (a, b, c) in faces]
    return faces


def _clean(verts, faces):
    V = np.asarray(verts, float)
    out = []
    for (a, b, c) in faces:
        if np.linalg.norm(np.cross(V[b] - V[a], V[c] - V[a])) > 1e-10:
            out.append((a, b, c))
    return out


def orient_by_normals(verts, norms, faces):
    """Open surfaces: flip faces so winding agrees with the analytic normals."""
    V = np.asarray(verts, float)
    N = np.asarray(norms, float)
    out = []
    for (a, b, c) in faces:
        fn = np.cross(V[b] - V[a], V[c] - V[a])
        if float(np.dot(fn, N[a] + N[b] + N[c])) < 0:
            out.append((a, c, b))
        else:
            out.append((a, b, c))
    return out


def ellipsoid_patch(center, radii, phi_c, th_c, dphi, dtheta, scale=1.004, rseg=12, aseg=72):
    """Smooth oval decal sitting just above an ellipsoid surface (all degrees)."""
    cx, cy, cz = center
    rx, ry, rz = radii
    verts, norms, faces = [], [], []
    for r in range(rseg + 1):
        rr = r / rseg
        for a in range(aseg):
            ang = 2 * math.pi * a / aseg
            phi = math.radians(phi_c + dphi * rr * math.cos(ang))
            th = math.radians(max(-88.0, min(88.0, th_c + dtheta * rr * math.sin(ang))))
            ct, st = math.cos(th), math.sin(th)
            ux, uy, uz = math.cos(phi) * ct, st, math.sin(phi) * ct
            verts.append((cx + ux * rx * scale, cy + uy * ry * scale, cz + uz * rz * scale))
            nx, ny, nz = ux / rx, uy / ry, uz / rz
            ln = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
            norms.append((nx / ln, ny / ln, nz / ln))
    for r in range(rseg):
        for a in range(aseg):
            p0 = r * aseg + a
            p1 = r * aseg + (a + 1) % aseg
            p2 = (r + 1) * aseg + (a + 1) % aseg
            p3 = (r + 1) * aseg + a
            faces.append((p0, p1, p2))
            faces.append((p0, p2, p3))
    return verts, norms, orient_by_normals(verts, norms, _clean(verts, faces))


def ellipsoid(center, radii, useg=40, vseg=26):
    cx, cy, cz = center
    rx, ry, rz = radii
    verts, norms, faces = [], [], []
    for j in range(vseg + 1):
        th = (j / vseg) * math.pi - math.pi / 2
        ct, st = math.cos(th), math.sin(th)
        for i in range(useg):
            ph = (i / useg) * 2 * math.pi
            ux, uy, uz = math.cos(ph) * ct, st, math.sin(ph) * ct
            verts.append((cx + ux * rx, cy + uy * ry, cz + uz * rz))
            nx, ny, nz = ux / rx, uy / ry, uz / rz
            ln = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
            norms.append((nx / ln, ny / ln, nz / ln))
    for j in range(vseg):
        for i in range(useg):
            a = j * useg + i
            b = j * useg + (i + 1) % useg
            c = (j + 1) * useg + (i + 1) % useg
            d = (j + 1) * useg + i
            faces.append((a, b, c))
            faces.append((a, c, d))
    return verts, norms, _orient(verts, _clean(verts, faces))


def _frame(axis):
    t = np.array([0.0, 0.0, 1.0]) if abs(axis[2]) < 0.9 else np.array([1.0, 0.0, 0.0])
    x = np.cross(axis, t)
    x /= (np.linalg.norm(x) or 1.0)
    z = np.cross(x, axis)
    return x, z


def capsule(p0, p1, r, useg=26, cap_v=9):
    p0 = np.asarray(p0, float)
    p1 = np.asarray(p1, float)
    d = p1 - p0
    L = float(np.linalg.norm(d))
    y = d / (L or 1.0)
    x, z = _frame(y)
    verts, norms = [], []
    rings = []
    for k in range(cap_v, -1, -1):          # bottom cap, pole -> equator
        a = (k / cap_v) * (math.pi / 2)
        off, rr, nl = -r * math.sin(a), r * math.cos(a), math.cos(a)
        rings.append((p0 + y * off, rr, nl, -math.sin(a)))
    for k in range(1, cap_v + 1):           # top cap, equator -> pole
        a = (k / cap_v) * (math.pi / 2)
        off, rr, nl = L + r * math.sin(a), r * math.cos(a), math.cos(a)
        rings.append((p0 + y * off, rr, nl, math.sin(a)))
    for (c, rr, nl, nax) in rings:
        for i in range(useg):
            ph = (i / useg) * 2 * math.pi
            rad = x * math.cos(ph) + z * math.sin(ph)
            verts.append(tuple(c + rad * rr))
            nv = rad * nl + y * nax
            nn = np.linalg.norm(nv) or 1.0
            norms.append(tuple(nv / nn))
    faces = []
    nr = len(rings)
    for j in range(nr - 1):
        for i in range(useg):
            a = j * useg + i
            b = j * useg + (i + 1) % useg
            c = (j + 1) * useg + (i + 1) % useg
            dd = (j + 1) * useg + i
            faces.append((a, b, c))
            faces.append((a, c, dd))
    return verts, norms, _orient(verts, _clean(verts, faces))


def frustum(p0, p1, r0, r1, useg=26):
    """Open cylinder with flat caps, along p0 -> p1."""
    p0 = np.asarray(p0, float)
    p1 = np.asarray(p1, float)
    d = p1 - p0
    L = float(np.linalg.norm(d))
    y = d / (L or 1.0)
    x, z = _frame(y)
    verts, norms = [], []
    slope = (r0 - r1) / (L or 1.0)
    # side
    for (c, rr) in ((p0, r0), (p1, r1)):
        for i in range(useg):
            ph = (i / useg) * 2 * math.pi
            rad = x * math.cos(ph) + z * math.sin(ph)
            verts.append(tuple(c + rad * rr))
            nv = rad + y * slope
            norms.append(tuple(nv / (np.linalg.norm(nv) or 1.0)))
    faces = []
    for i in range(useg):
        a = i
        b = (i + 1) % useg
        c = useg + (i + 1) % useg
        dd = useg + i
        faces.append((a, b, c))
        faces.append((a, c, dd))
    # caps
    for (c, rr, sgn) in ((p0, r0, -1.0), (p1, r1, 1.0)):
        base = len(verts)
        verts.append(tuple(c))
        norms.append(tuple(y * sgn))
        for i in range(useg):
            ph = (i / useg) * 2 * math.pi
            rad = x * math.cos(ph) + z * math.sin(ph)
            verts.append(tuple(c + rad * rr))
            norms.append(tuple(y * sgn))
        for i in range(useg):
            a = base + 1 + i
            b = base + 1 + (i + 1) % useg
            faces.append((base, a, b))
    return verts, norms, _orient(verts, _clean(verts, faces))


def tube(points, r, useg=14):
    pts = [np.asarray(p, float) for p in points]
    n = len(pts)
    tans = []
    for i in range(n):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == n - 1:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        tans.append(t / (np.linalg.norm(t) or 1.0))
    verts, norms, faces = [], [], []
    prev_x = None
    for p, t in zip(pts, tans):
        x, _z = _frame(t)
        if prev_x is not None:
            x = prev_x - t * float(np.dot(prev_x, t))
            if np.linalg.norm(x) < 1e-6:
                x = prev_x
            x /= np.linalg.norm(x)
        prev_x = x
        z = np.cross(x, t)
        for i in range(useg):
            ph = (i / useg) * 2 * math.pi
            rad = x * math.cos(ph) + z * math.sin(ph)
            verts.append(tuple(p + rad * r))
            norms.append(tuple(rad))
    for j in range(n - 1):
        for i in range(useg):
            a = j * useg + i
            b = j * useg + (i + 1) % useg
            c = (j + 1) * useg + (i + 1) % useg
            dd = (j + 1) * useg + i
            faces.append((a, b, c))
            faces.append((a, c, dd))
    for (idx, p, t, sgn) in ((0, pts[0], tans[0], -1.0), (n - 1, pts[-1], tans[-1], 1.0)):
        base = len(verts)
        verts.append(tuple(p))
        norms.append(tuple(t * sgn))
        x, z = _frame(t)
        for i in range(useg):
            ph = (i / useg) * 2 * math.pi
            rad = x * math.cos(ph) + z * math.sin(ph)
            verts.append(tuple(p + rad * r))
            norms.append(tuple(rad))
        for i in range(useg):
            a = base + 1 + i
            b = base + 1 + (i + 1) % useg
            faces.append((base, a, b))
    return verts, norms, _orient(verts, _clean(verts, faces))


# ------------------------------------------------------------- mesh buffer ----
class Mesh:
    """Accumulates primitives, each face carrying a material id."""

    def __init__(self, name):
        self.name = name
        self.v, self.n, self.f, self.m = [], [], [], []

    def add(self, prim, mat, offset=(0, 0, 0), predicate=None):
        verts, norms, faces = prim
        off = len(self.v)
        o = np.asarray(offset, float)
        V = np.asarray(verts, float) + o
        self.v.extend(map(tuple, V))
        self.n.extend(norms)
        for fc in faces:
            c = (V[fc[0]] + V[fc[1]] + V[fc[2]]) / 3.0
            self.m.append(predicate(c) if predicate else mat)
            self.f.append(tuple(x + off for x in fc))
        return self

    def tri_count(self):
        return len(self.f)

    def shift(self, off):
        """Move mesh into joint space: verts are authored in world rest space."""
        o = np.asarray(off, float)
        self.v = [tuple(np.asarray(v, float) - o) for v in self.v]
        return self


# --------------------------------------------------------------- character ----
# Rest pose landmarks (metres, Y up, character faces +Z, ground at Y = 0).
TORSO_C = (0.0, 0.40, 0.0)
TORSO_R = (0.240, 0.215, 0.300)
HEAD_PIVOT = (0.0, 0.545, 0.0)
HEAD_C = (0.0, 0.70, 0.02)
HEAD_R = (0.235, 0.225, 0.215)

HIP_Y = 0.225
HIP_X = 0.135
HIP_Z = 0.170
FOOT_Y = 0.072

# orange markings as smooth oval decals: (phi_c, theta_c, dphi, dtheta) in degrees
# phi: 0 = +X, 90 = front (+Z), 180 = -X, 270 = back (-Z).  theta: +90 = top.
BODY_SPOTS = [
    (168.0, 12.0, 42.0, 30.0),
    (-22.0, -22.0, 34.0, 26.0),
    (262.0, 52.0, 26.0, 16.0),
]
HEAD_SPOT = (104.0, 53.0, 27.0, 15.0)


def _inside(c, spot):
    ctr, rad = spot
    d = (np.asarray(c) - np.asarray(ctr)) / np.asarray(rad)
    return float(np.dot(d, d)) <= 1.0


def body_mat(c):
    for s in BODY_SPOTS:
        if _inside(c, s):
            return M_ORANGE
    return M_CREAM


def head_mat(c):
    return M_CREAM


def build_head_mesh(mouth="smile"):
    """Head + muzzle + horns + forelock + cheeks. `mouth` varies the expression kit."""
    m = Mesh("head")
    # skull
    m.add(ellipsoid(HEAD_C, HEAD_R, 56, 38), M_CREAM)
    for (pc, tc, dp, dt) in [HEAD_SPOT]:
        m.add(ellipsoid_patch(HEAD_C, HEAD_R, pc, tc, dp, dt), M_ORANGE)
    hc = np.asarray(HEAD_C)
    # muzzle + chin
    m.add(ellipsoid((hc + np.array([0, -0.062, 0.192])), (0.122, 0.088, 0.080), 36, 24), M_SHADE)
    m.add(ellipsoid((hc + np.array([0, -0.128, 0.150])), (0.072, 0.040, 0.055), 24, 16), M_SHADE)
    # nostrils
    for s in (-1, 1):
        m.add(ellipsoid(tuple(hc + np.array([s * 0.036, -0.050, 0.259])), (0.014, 0.010, 0.009), 18, 12), M_INK)
    # mouth variants
    if mouth == "open":
        m.add(ellipsoid(tuple(hc + np.array([0, -0.128, 0.248])), (0.036, 0.028, 0.022), 24, 16), M_INK)
        m.add(ellipsoid(tuple(hc + np.array([0, -0.118, 0.256])), (0.026, 0.014, 0.010), 20, 12), M_SHADE)
    elif mouth == "flat":
        arc = [tuple(hc + np.array([0.030 * t, -0.124, 0.252])) for t in np.linspace(-1, 1, 5)]
        m.add(tube(arc, 0.0080, 12), M_INK)
    elif mouth == "wide":
        arc = [tuple(hc + np.array([0.062 * t, -0.122 + 0.024 * t * t, 0.252])) for t in np.linspace(-1, 1, 7)]
        m.add(tube(arc, 0.0085, 12), M_INK)
    else:  # smile
        arc = [tuple(hc + np.array([0.048 * t, -0.122 + 0.015 * t * t, 0.253])) for t in np.linspace(-1, 1, 7)]
        m.add(tube(arc, 0.0085, 12), M_INK)
    # horns (short, chunky, deliberately asymmetric)
    for s, ln, tilt in ((-1, 0.080, 0.055), (1, 0.068, 0.048)):
        base = hc + np.array([s * 0.108, 0.182, -0.002])
        tip = base + np.array([s * tilt, ln, -0.016])
        m.add(frustum(tuple(base), tuple(tip), 0.038, 0.014, 22), M_SHADE)
    # soft forelock tuft, half-embedded in the skull
    for (dx, dz, r) in ((-0.040, 0.024, 0.043), (0.004, -0.010, 0.049), (0.042, 0.022, 0.041)):
        c = hc + np.array([dx, 0.196, dz])
        m.add(ellipsoid(tuple(c), (r, r * 0.92, r * 0.94), 22, 16), M_ORANGE)
    # cheeks
    for s in (-1, 1):
        m.add(ellipsoid(tuple(hc + np.array([s * 0.150, -0.030, 0.128])), (0.048, 0.032, 0.050), 22, 16), M_BLUSH)
    return m


def build_ear_mesh(side):
    """Cream ear shell with an orange inner; slight left/right asymmetry."""
    m = Mesh("ear_%s" % ("L" if side < 0 else "R"))
    pivot = np.array([side * 0.212, 0.812, 0.018])
    tilt = 26.0 if side < 0 else 18.0          # left ear sits a touch lower/wider
    grow = 1.06 if side > 0 else 1.0
    R = _rot((0, 0, tilt * side))

    def place(radii, local_off):
        pv, pn, pf = ellipsoid((0, 0, 0), radii, 32, 20)
        pv, pn = _apply(pv, pn, (0, 0, 0), (0, 0, tilt * side))
        V = np.asarray(pv) + pivot + R @ np.asarray(local_off, float)
        return (list(map(tuple, V)), pn, pf)

    m.add(place((0.100 * grow, 0.062 * grow, 0.033 * grow), (0, 0, 0)), M_CREAM)
    m.add(place((0.064 * grow, 0.037 * grow, 0.023), (0, 0.004, 0.022 * grow)), M_ORANGE)
    return m, tuple(pivot)


def build_eye_mesh(side):
    m = Mesh("eye_%s" % ("L" if side < 0 else "R"))
    pivot = np.array([side * 0.088, 0.745, 0.195])
    m.add(ellipsoid((0, 0, 0), (0.041, 0.049, 0.033), 26, 18), M_INK, offset=tuple(pivot))
    m.add(ellipsoid(tuple(pivot + np.array([side * 0.010, 0.017, 0.028])), (0.013, 0.013, 0.010), 14, 10), M_WHITE)
    return m, tuple(pivot)


def build_torso_mesh():
    m = Mesh("torso")
    m.add(ellipsoid(TORSO_C, TORSO_R, 64, 42), M_CREAM)
    for (pc, tc, dp, dt) in BODY_SPOTS:
        m.add(ellipsoid_patch(TORSO_C, TORSO_R, pc, tc, dp, dt), M_ORANGE)
    # neck filler so head and body read as one silhouette
    m.add(ellipsoid((0.0, 0.582, 0.004), (0.150, 0.090, 0.150), 36, 24), M_CREAM)
    return m


def build_leg_mesh(name, side, front):
    m = Mesh(name)
    x = side * HIP_X
    z = HIP_Z if front else -HIP_Z
    hip = (x, HIP_Y, z)
    m.add(capsule((x, HIP_Y, z), (x, 0.112, z), 0.066, 28, 9), M_CREAM)
    # flat-bottomed hoof/boot so the figure stands, not balances
    m.add(frustum((x, 0.120, z), (x, 0.0, z), 0.064, 0.070, 28), M_DEEP)
    m.add(ellipsoid((x, 0.004, z), (0.070, 0.006, 0.070), 24, 10), M_DEEP)
    return m, hip


def build_tail_mesh():
    m = Mesh("tail")
    pivot = np.array([0.0, 0.500, -0.285])
    pts = [pivot,
           np.array([0.004, 0.455, -0.352]),
           np.array([0.012, 0.372, -0.384]),
           np.array([0.020, 0.296, -0.372])]
    for i in range(len(pts) - 1):
        m.add(capsule(tuple(pts[i]), tuple(pts[i + 1]), 0.026 - 0.002 * i, 18, 7), M_CREAM)
    m.add(ellipsoid(tuple(pts[-1] + np.array([0.006, -0.032, -0.006])), (0.050, 0.056, 0.050), 24, 18), M_ORANGE)
    return m, tuple(pivot)


def build_parts():
    """Return (node_name, parent, pivot, Mesh) list in hierarchy order."""
    parts = []
    torso = build_torso_mesh()
    parts.append(("Torso", None, TORSO_C, torso))
    head = build_head_mesh()
    parts.append(("Head", "Torso", HEAD_PIVOT, head))
    for side, tag in ((-1, "L"), (1, "R")):
        ear, pivot = build_ear_mesh(side)
        parts.append(("Ear" + tag, "Head", pivot, ear))
    for side, tag in ((-1, "L"), (1, "R")):
        eye, pivot = build_eye_mesh(side)
        parts.append(("Eye" + tag, "Head", pivot, eye))
    for side, tag in ((-1, "L"), (1, "R")):
        leg, hip = build_leg_mesh("LegFL" if side < 0 else "LegFR", side, True)
        parts.append(("LegF" + tag, "Torso", hip, leg))
    for side, tag in ((-1, "L"), (1, "R")):
        leg, hip = build_leg_mesh("LegBL" if side < 0 else "LegBR", side, False)
        parts.append(("LegB" + tag, "Torso", hip, leg))
    tail, pivot = build_tail_mesh()
    parts.append(("Tail", "Torso", pivot, tail))
    # meshes are authored in world rest space; move each into its joint's local space
    return [(nm, par, pv, mesh.shift(pv)) for (nm, par, pv, mesh) in parts]


# ------------------------------------------------------------------- poses ----
# rot = XYZ euler degrees about the joint pivot; loc = offset of the pivot; scl = node scale
POSES = {
    "idle": {},
    "wave": {
        "Torso": {"rot": (0, 0, -3)},
        "LegFR": {"rot": (-105, 0, 8)},
        "Head": {"rot": (-4, 0, -9)},
        "EarR": {"rot": (0, 0, -20), "scl": (1.08, 1.08, 1.08)},
        "Tail": {"rot": (-14, 0, 0)},
    },
    "cheer": {
        "Torso": {"rot": (-10, 0, 0), "loc": (0, 0.045, 0)},
        "LegFL": {"rot": (-108, 0, -10)},
        "LegFR": {"rot": (-108, 0, 10)},
        "Head": {"rot": (-20, 0, 0)},
        "EarL": {"rot": (0, 0, 18)},
        "EarR": {"rot": (0, 0, -18)},
        "Tail": {"rot": (-30, 0, 0)},
    },
    "run": {
        "Torso": {"rot": (-8, 0, 0), "loc": (0, 0.015, 0.02)},
        "LegFL": {"rot": (-46, 0, -6)},
        "LegFR": {"rot": (40, 0, 6)},
        "LegBL": {"rot": (38, 0, 6)},
        "LegBR": {"rot": (-42, 0, -6)},
        "Head": {"rot": (14, 0, 0)},
        "Tail": {"rot": (-36, 0, 0)},
    },
    "sit": {
        "Torso": {"rot": (9, 0, 0), "loc": (0, -0.165, 0.010)},
        "LegFL": {"rot": (-18, 0, -6)},
        "LegFR": {"rot": (-18, 0, 6)},
        "LegBL": {"rot": (-68, 0, 12)},
        "LegBR": {"rot": (-68, 0, -12)},
        "Head": {"rot": (-6, 0, 5)},
        "EarL": {"rot": (0, 0, 9)},
        "Tail": {"rot": (20, 0, 0)},
    },
    "sleep": {
        "Torso": {"rot": (16, 0, 0), "loc": (0, -0.170, 0.0)},
        "Head": {"rot": (26, 0, -11)},
        "EyeL": {"scl": (1, 0.12, 1)},
        "EyeR": {"scl": (1, 0.12, 1)},
        "EarL": {"rot": (0, 0, -24)},
        "EarR": {"rot": (0, 0, 24)},
        "LegFL": {"rot": (-52, 0, -8)},
        "LegFR": {"rot": (-52, 0, 8)},
        "LegBL": {"rot": (-62, 0, 12)},
        "LegBR": {"rot": (-62, 0, -12)},
        "Tail": {"rot": (34, 0, 0)},
    },
    "think": {
        "Head": {"rot": (-10, 0, 14)},
        "LegFL": {"rot": (-95, 0, -14)},
        "EyeR": {"scl": (1, 0.7, 1)},
        "EarL": {"rot": (0, 0, 12)},
        "Tail": {"rot": (-8, 0, 6)},
    },
    "wink": {
        "Head": {"rot": (0, 0, -7)},
        "EyeR": {"scl": (1, 0.14, 1)},
        "LegFR": {"rot": (-24, 0, 66)},
        "EarR": {"rot": (0, 0, -12)},
        "Tail": {"rot": (-10, 0, 8)},
    },
}
POSE_ORDER = ["idle", "wave", "cheer", "run", "sit", "sleep", "think", "wink"]


# --------------------------------------------------------------- GLB writer ----
class Glb:
    def __init__(self):
        self.bin = bytearray()
        self.views = []
        self.accessors = []
        self.meshes = []
        self.materials = []
        self.mesh_index = {}

    def _view(self, data, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        v = {"buffer": 0, "byteOffset": len(self.bin), "byteLength": len(data)}
        if target:
            v["target"] = target
        self.bin.extend(data)
        self.views.append(v)
        return len(self.views) - 1

    def add_accessor(self, data, comp, count, typ, minv=None, maxv=None):
        target = 34962 if typ == "VEC3" else 34963
        v = self._view(data, target)
        a = {"bufferView": v, "componentType": comp, "count": count, "type": typ}
        if minv is not None:
            a["min"] = minv
            a["max"] = maxv
        self.accessors.append(a)
        return len(self.accessors) - 1

    def add_material(self, name, hexc, rough, metal):
        self.materials.append({
            "name": name,
            "pbrMetallicRoughness": {
                "baseColorFactor": hex_lin(hexc) + [1.0],
                "metallicFactor": metal,
                "roughnessFactor": rough,
            },
        })
        return len(self.materials) - 1

    def add_mesh(self, mesh):
        key = mesh.name
        if key in self.mesh_index:
            return self.mesh_index[key]
        V = np.asarray(mesh.v, dtype=np.float32)
        N = np.asarray(mesh.n, dtype=np.float32)
        pos = self.add_accessor(V.tobytes(), 5126, len(V), "VEC3",
                                [float(x) for x in V.min(axis=0)],
                                [float(x) for x in V.max(axis=0)])
        nor = self.add_accessor(N.tobytes(), 5126, len(N), "VEC3")
        by_mat = {}
        for fc, mat in zip(mesh.f, mesh.m):
            by_mat.setdefault(mat, []).extend(fc)
        # uint16 indices keep the file ~25% smaller whenever the mesh allows it
        idx_dtype, idx_comp = (np.uint16, 5123) if len(V) < 65536 else (np.uint32, 5125)
        prims = []
        for mat_id in sorted(by_mat):
            idx = np.asarray(by_mat[mat_id], dtype=idx_dtype)
            acc = self.add_accessor(idx.tobytes(), idx_comp, len(idx), "SCALAR")
            prims.append({"attributes": {"POSITION": pos, "NORMAL": nor},
                          "indices": acc, "material": mat_id, "mode": 4})
        self.meshes.append({"name": key, "primitives": prims})
        self.mesh_index[key] = len(self.meshes) - 1
        return self.mesh_index[key]

    def write(self, path, nodes, scene_name):
        doc = {
            "asset": {"version": "2.0", "generator": "ZAPPY procedural builder v1 (build_zapy.py)"},
            "scene": 0,
            "scenes": [{"name": scene_name, "nodes": [n for n in range(len(nodes)) if nodes[n].get("_root")]}],
            "nodes": [],
            "meshes": self.meshes,
            "materials": self.materials,
            "accessors": self.accessors,
            "bufferViews": self.views,
            "buffers": [{"byteLength": len(self.bin)}],
        }
        for n in nodes:
            node = {}
            if n.get("name"):
                node["name"] = n["name"]
            if "translation" in n:
                node["translation"] = [round(float(x), 6) for x in n["translation"]]
            if "rotation" in n:
                node["rotation"] = [round(float(x), 6) for x in n["rotation"]]
            if "scale" in n:
                node["scale"] = [round(float(x), 6) for x in n["scale"]]
            if "mesh" in n:
                node["mesh"] = n["mesh"]
            if n.get("children"):
                node["children"] = n["children"]
            doc["nodes"].append(node)
        while len(self.bin) % 4:
            self.bin.append(0)
        j = json.dumps(doc, separators=(",", ":")).encode("utf-8")
        j += b" " * ((4 - len(j) % 4) % 4)
        b = bytes(self.bin)
        glb = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(j) + 8 + len(b))
        glb += struct.pack("<II", len(j), 0x4E4F534A) + j
        glb += struct.pack("<II", len(b), 0x004E4942) + b
        with open(path, "wb") as fh:
            fh.write(glb)
        return len(glb)


def quat_from_euler(xyz_deg):
    x, y, z = [math.radians(a) / 2 for a in xyz_deg]
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    return [
        sx * cy * cz - cx * sy * sz,
        cx * sy * cz + sx * cy * sz,
        cx * cy * sz - sx * sy * cz,
        cx * cy * cz + sx * sy * sz,
    ]


def build_nodes(parts, pose, glb, prefix="", root_offset=(0, 0, 0)):
    """Emit glTF nodes for the hierarchy with `pose` overrides applied."""
    idx = {}
    pivots = {p[0]: np.asarray(p[2], float) for p in parts}
    nodes = []
    for (name, parent, pivot, mesh) in parts:
        n = {"name": prefix + name, "mesh": glb.add_mesh(mesh)}
        pivot = np.asarray(pivot, float)
        par_pivot = pivots[parent] if parent else np.zeros(3)
        loc = pivot - par_pivot
        p = pose.get(name, {})
        if "loc" in p:
            loc = loc + np.asarray(p["loc"], float)
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
    parts = build_parts()
    tris = sum(p[3].tri_count() for p in parts)
    verts = sum(len(p[3].v) for p in parts)
    made = []

    for pose_name in POSE_ORDER:
        glb = Glb()
        for (nm, hexc, rough, metal) in PALETTE:
            glb.add_material(nm, hexc, rough, metal)
        nodes = build_nodes(parts, POSES[pose_name], glb)
        path = os.path.join(OUT, "zapy_%s.glb" % pose_name)
        size = glb.write(path, nodes, "ZAPPY_%s" % pose_name)
        made.append((pose_name, path, size))

    # pose sheet: every pose side by side in one scene
    glb = Glb()
    for (nm, hexc, rough, metal) in PALETTE:
        glb.add_material(nm, hexc, rough, metal)
    all_nodes = []
    for i, pose_name in enumerate(POSE_ORDER):
        sub = build_nodes(parts, POSES[pose_name], glb, prefix="%s_" % pose_name,
                          root_offset=(i * 0.86, 0, 0))
        base = len(all_nodes)
        for n in sub:                      # children were indexed per-pose: rebase them
            if n.get("children"):
                n["children"] = [c + base for c in n["children"]]
        all_nodes.extend(sub)
    sheet_path = os.path.join(OUT, "zapy_poses.glb")
    sheet_size = glb.write(sheet_path, all_nodes, "ZAPPY_pose_sheet")

    total_tris = sum(len(glb.meshes[i]["primitives"]) for i in range(len(glb.meshes)))
    manifest = {
        "asset": "ZAPPY",
        "kind": "character mascot, 3D",
        "generator": "build_zapy.py (procedural, analytic primitives)",
        "provenance": {
            "method": "procedurally authored mesh",
            "paid_provider_used": None,
            "blender_used": False,
            "note": "No atlas_3d / fal_3d provider tool or API key was available in this session, "
                    "and Blender is not installed. Geometry is generated deterministically in Python.",
        },
        "license": "project asset (ZAP / logicodix)",
        "units": "metres",
        "up_axis": "Y",
        "forward_axis": "+Z",
        "height_m": 1.02,
        "palette": {n: {"hex": h, "roughness": r, "metallic": m} for (n, h, r, m) in PALETTE},
        "geometry": {"triangles_per_pose": tris, "vertices_per_pose": verts,
                     "parts": [p[0] for p in parts]},
        "poses": {p: {"file": "out/zapy_%s.glb" % p, "bytes": size} for (p, _f, size) in made},
        "pose_sheet": {"file": "out/zapy_poses.glb", "bytes": sheet_size},
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    for p, f, _s in made:
        with open(f, "rb") as fh:
            manifest["poses"][p]["sha256"] = hashlib.sha256(fh.read()).hexdigest()[:16]
    with open(sheet_path, "rb") as fh:
        manifest["pose_sheet"]["sha256"] = hashlib.sha256(fh.read()).hexdigest()[:16]

    with open(os.path.join(HERE, "MANIFEST.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)

    print("triangles/pose : %d" % tris)
    print("vertices/pose  : %d" % verts)
    print("parts          : %d" % len(parts))
    for (p, f, sz) in made:
        print("  %-6s %8d bytes  %s" % (p, sz, os.path.basename(f)))
    print("  sheet %8d bytes  %s" % (sheet_size, os.path.basename(sheet_path)))


if __name__ == "__main__":
    main()
