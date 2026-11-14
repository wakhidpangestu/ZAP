"""
Autentikasi platform ZAP.

Alur masuk:
1. Frontend menjalankan Google Identity Services dan memperoleh ID token.
2. Backend memverifikasi ID token ke endpoint tokeninfo Google
   (memeriksa aud, iss, exp, email_verified). Token tidak pernah dipercaya
   hanya dari hasil decode di browser.
3. Backend menerbitkan sesi JWT milik ZAP (HS256, ditandatangani
   ZAP_JWT_SECRET) dengan masa berlaku terbatas dan jti yang tercatat di
   server, sehingga sesi bisa dicabut saat logout.

Cakupan pengguna: semua jenjang pendidikan. Peran dan jenjang disimpan di
profil dan dipakai untuk tingkat bimbingan serta pengelompokan materi.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
import uuid
from datetime import datetime, timedelta, timezone

import httpx

from .crypto import sha256_hex

ROLES = ("siswa", "mahasiswa", "guru", "dosen", "umum")
JENJANG = ("SD", "SMP", "SMA", "SMK", "D3", "S1", "S2", "S3", "-")
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")
TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


class AuthError(Exception):
    def __init__(self, message: str, status: int = 401):
        super().__init__(message)
        self.status = status


def validate_role(role: str | None) -> str:
    return role if role in ROLES else "umum"


def validate_jenjang(jenjang: str | None) -> str:
    return jenjang if jenjang in JENJANG else "-"


def _default_http_get(url: str, params: dict) -> tuple[int, dict]:
    # Kegagalan jaringan ke tokeninfo Google harus menjadi AuthError 503,
    # bukan pengecualian mentah yang berakhir sebagai 500.
    try:
        resp = httpx.get(url, params=params, timeout=10.0)
    except httpx.HTTPError as err:
        raise AuthError(
            "Layanan verifikasi Google tidak dapat dihubungi", 503) from err
    try:
        return resp.status_code, resp.json()
    except Exception:
        return resp.status_code, {}


def verify_google_id_token(id_token: str, client_id: str, http_get=None) -> dict:
    """Verifikasi ID token Google. Mengembalikan profil atau raise AuthError."""
    if not client_id:
        raise AuthError("ZAP_GOOGLE_CLIENT_ID belum dikonfigurasi di server", 500)
    getter = http_get or _default_http_get
    status, data = getter(TOKENINFO_URL, {"id_token": id_token})
    if status != 200 or not data:
        raise AuthError("ID token Google tidak valid")
    if data.get("aud") != client_id:
        raise AuthError("ID token bukan untuk aplikasi ZAP")
    if data.get("iss") not in GOOGLE_ISSUERS:
        raise AuthError("Penerbit ID token tidak dikenal")
    try:
        exp = int(data.get("exp", "0"))
    except (TypeError, ValueError):
        raise AuthError("ID token tidak memiliki masa berlaku yang sah")
    if exp <= int(time.time()):
        raise AuthError("ID token sudah kedaluwarsa")
    if str(data.get("email_verified")).lower() != "true":
        raise AuthError("Email akun Google belum terverifikasi")
    if not data.get("sub") or not data.get("email"):
        raise AuthError("Profil Google tidak lengkap")
    return {
        "sub": data["sub"],
        "email": data["email"],
        "name": data.get("name") or data["email"].split("@")[0],
        "avatar": data.get("picture"),
    }


# ---------------- JWT HS256 (implementasi ringkas, teruji) ----------------

def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(text: str) -> bytes:
    pad = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + pad)


def _sign(secret: str, signing_input: str) -> str:
    sig = hmac.new(
        secret.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256
    ).digest()
    return _b64url_encode(sig)


def create_session_token(secret: str, user: dict, session_days: int = 7) -> tuple[str, str, str]:
    """Buat JWT sesi. Mengembalikan (token, jti, expires_at_iso)."""
    jti = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=session_days)
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "role": user.get("role", "umum"),
        "jenjang": user.get("jenjang", "-"),
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    signing_input = (
        _b64url_encode(json.dumps(header, separators=(",", ":")).encode())
        + "."
        + _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    )
    token = signing_input + "." + _sign(secret, signing_input)
    return token, jti, expires.isoformat()


def parse_session_token(secret: str, token: str) -> dict:
    """Verifikasi tanda tangan dan masa berlaku JWT. Raise AuthError bila gagal."""
    parts = token.split(".")
    if len(parts) != 3:
        raise AuthError("Token sesi tidak valid")
    signing_input = parts[0] + "." + parts[1]
    expected = _sign(secret, signing_input)
    if not hmac.compare_digest(expected, parts[2]):
        raise AuthError("Tanda tangan token sesi tidak sah")
    try:
        payload = json.loads(_b64url_decode(parts[1]))
    except Exception:
        raise AuthError("Isi token sesi tidak dapat dibaca")
    if int(payload.get("exp", 0)) <= int(time.time()):
        raise AuthError("Sesi sudah kedaluwarsa, silakan masuk lagi")
    return payload


def session_token_fingerprint(token: str) -> str:
    """Hash token untuk pencatatan sesi di server (token asli tidak disimpan)."""
    return sha256_hex(token)
