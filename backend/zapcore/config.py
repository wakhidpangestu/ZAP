"""
Konfigurasi layanan platform ZAP.

Semua rahasia dibaca dari variabel lingkungan dan tidak pernah ditulis
ke basis data atau dikirim ke klien:

- ZAP_JWT_SECRET      : rahasia penanda tangan sesi JWT (HS256).
- ZAP_MASTER_KEY      : kunci master AES-256-GCM dalam base64 (32 byte).
                        Alternatif pengembangan: ZAP_MASTER_SECRET, string
                        bebas yang di-hash SHA-256 menjadi kunci.
- ZAP_GOOGLE_CLIENT_ID: client ID OAuth Google untuk verifikasi ID token.
- ZAP_GEMINI_API_KEY  : kunci Gemini milik platform (jalur bawaan).
- ZAP_DB_PATH         : lokasi berkas SQLite (bawaan zap_platform.db).
- ZAP_ENV             : "production" mengaktifkan penegakan kesiapan
                        produksi (startup gagal bila rahasia bawaan belum
                        diganti). Nilai lain dianggap pengembangan.
- ZAP_ADMIN_EMAILS    : daftar email admin (pisah koma) yang boleh memicu
                        sapuan retensi global. Kosong = tidak ada yang boleh.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass
class Settings:
    db_path: str = "zap_platform.db"
    jwt_secret: str = "dev-insecure-secret-change-me"
    master_key_b64: str | None = None
    master_secret: str | None = None
    google_client_id: str = ""
    google_client_secret: str | None = None
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.0-flash"
    session_days: int = 7
    retention_days: int = 365
    publish_min_quality: float = 0.6
    llm_curation_min_score: float = 0.7
    env: str = "development"
    admin_emails: tuple[str, ...] = ()

    @property
    def is_production(self) -> bool:
        return self.env.strip().lower() == "production"

    @property
    def is_production_ready(self) -> bool:
        """True bila rahasia bawaan pengembangan sudah diganti."""
        return (
            self.jwt_secret != "dev-insecure-secret-change-me"
            and (self.master_key_b64 is not None or self.master_secret is not None)
            and bool(self.google_client_id)
        )

    def assert_production_ready(self) -> None:
        """Gagalkan startup bila ZAP_ENV=production tetapi konfigurasi
        masih memakai rahasia bawaan pengembangan."""
        if self.is_production and not self.is_production_ready:
            missing = []
            if self.jwt_secret == "dev-insecure-secret-change-me":
                missing.append("ZAP_JWT_SECRET")
            if self.master_key_b64 is None and self.master_secret is None:
                missing.append("ZAP_MASTER_KEY/ZAP_MASTER_SECRET")
            if not self.google_client_id:
                missing.append("ZAP_GOOGLE_CLIENT_ID")
            raise RuntimeError(
                "ZAP_ENV=production tetapi konfigurasi belum siap produksi. "
                "Isi variabel lingkungan berikut: " + ", ".join(missing)
            )


def settings_from_env() -> Settings:
    return Settings(
        db_path=os.environ.get("ZAP_DB_PATH", "zap_platform.db"),
        jwt_secret=os.environ.get("ZAP_JWT_SECRET", "dev-insecure-secret-change-me"),
        master_key_b64=os.environ.get("ZAP_MASTER_KEY") or None,
        master_secret=os.environ.get("ZAP_MASTER_SECRET") or None,
        google_client_id=os.environ.get("ZAP_GOOGLE_CLIENT_ID") or os.environ.get("GOOGLE_CLIENT_ID", ""),
        google_client_secret=os.environ.get("ZAP_GOOGLE_CLIENT_SECRET") or os.environ.get("GOOGLE_CLIENT_SECRET") or None,
        gemini_api_key=os.environ.get("ZAP_GEMINI_API_KEY") or None,
        gemini_model=os.environ.get("ZAP_GEMINI_MODEL", "gemini-2.0-flash"),
        session_days=int(os.environ.get("ZAP_SESSION_DAYS", "7")),
        retention_days=int(os.environ.get("ZAP_RETENTION_DAYS", "365")),
        env=os.environ.get("ZAP_ENV", "development"),
        admin_emails=tuple(
            email.strip().lower()
            for email in os.environ.get("ZAP_ADMIN_EMAILS", "").split(",")
            if email.strip()
        ),
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return settings_from_env()
