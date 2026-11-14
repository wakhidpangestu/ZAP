"""
Lapisan penyimpanan platform ZAP (SQLite).

Prinsip penyimpanan (lihat docs/PRIVACY_POLICY.md):

- Isi pesan chat disimpan HANYA sebagai ciphertext AES-256-GCM
  (kolom content_ciphertext). Kolom content_sha256 menyimpan hash untuk
  integritas, bukan isi.
- Kunci API connector disimpan HANYA sebagai ciphertext kunci master.
- Materi kontribusi disimpan terenkripsi kunci master (sistem kurasi
  harus bisa membacanya) dan dideduplikasi via fingerprint SHA-256.
- Materi basis pengetahuan yang terbit sudah tersaring dan teredaksi,
  disimpan sebagai teks biasa agar bisa dicari dan diambil tutor.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_sub TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    avatar TEXT,
    role TEXT NOT NULL DEFAULT 'umum',
    jenjang TEXT NOT NULL DEFAULT '-',
    consent_learning INTEGER NOT NULL DEFAULT 0,
    consent_version TEXT,
    created_at TEXT NOT NULL,
    last_login_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    jti TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    token_sha256 TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS connectors (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    provider TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    key_ciphertext TEXT NOT NULL,
    base_url TEXT,
    model TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_used_at TEXT
);
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL DEFAULT 'Percakapan baru',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    role TEXT NOT NULL,
    content_ciphertext TEXT NOT NULL,
    content_sha256 TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contributions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    payload_ciphertext TEXT NOT NULL,
    fingerprint TEXT UNIQUE NOT NULL,
    topic TEXT,
    jenjang TEXT,
    quality_score REAL,
    status TEXT NOT NULL DEFAULT 'received',
    screen_notes TEXT NOT NULL DEFAULT '[]',
    verified_by TEXT,
    kb_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS knowledge_items (
    id TEXT PRIMARY KEY,
    contribution_id TEXT UNIQUE NOT NULL REFERENCES contributions(id),
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    jenjang TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '',
    quality_score REAL NOT NULL DEFAULT 0,
    verified_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    published_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    meta TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return uuid.uuid4().hex


class Store:
    def __init__(self, db_path: str = ":memory:"):
        # check_same_thread=False: koneksi dipakai lintas thread oleh
        # threadpool FastAPI; penulisan SQLite terserialisasi di level
        # berkas dan pola aksesnya per-permintaan.
        self.conn = sqlite3.connect(db_path, check_same_thread=False, timeout=5.0)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        if db_path != ":memory:":
            self.conn.execute("PRAGMA journal_mode = WAL")
            self.conn.execute("PRAGMA synchronous = NORMAL")
        self.conn.execute("PRAGMA busy_timeout = 5000")
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()

    # ---------------- audit ----------------
    def audit(self, actor: str, action: str, target: str = "", meta: dict | None = None) -> None:
        self.conn.execute(
            "INSERT INTO audit_log (id, actor, action, target, meta, created_at) VALUES (?,?,?,?,?,?)",
            (new_id(), actor, action, target, json.dumps(meta or {}), now_iso()),
        )
        self.conn.commit()

    # ---------------- users ----------------
    def upsert_user_from_google(self, sub: str, email: str, name: str, avatar: str | None) -> dict:
        row = self.conn.execute("SELECT * FROM users WHERE google_sub = ?", (sub,)).fetchone()
        ts = now_iso()
        if row is None:
            uid = new_id()
            self.conn.execute(
                "INSERT INTO users (id, google_sub, email, name, avatar, created_at, last_login_at)"
                " VALUES (?,?,?,?,?,?,?)",
                (uid, sub, email, name, avatar, ts, ts),
            )
            self.conn.commit()
            return self.get_user(uid)
        self.conn.execute(
            "UPDATE users SET email=?, name=?, avatar=?, last_login_at=? WHERE id=?",
            (email, name, avatar, ts, row["id"]),
        )
        self.conn.commit()
        return self.get_user(row["id"])

    def get_user(self, user_id: str) -> dict | None:
        row = self.conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None

    def update_profile(self, user_id: str, **fields) -> dict | None:
        allowed = {"role", "jenjang", "consent_learning", "consent_version", "name"}
        updates = {k: v for k, v in fields.items() if k in allowed}
        if updates:
            sql = ", ".join(f"{k} = ?" for k in updates)
            self.conn.execute(
                f"UPDATE users SET {sql} WHERE id = ?", (*updates.values(), user_id)
            )
            self.conn.commit()
        return self.get_user(user_id)

    def delete_user_cascade(self, user_id: str) -> None:
        cur = self.conn
        conv_ids = [r["id"] for r in cur.execute(
            "SELECT id FROM conversations WHERE user_id = ?", (user_id,))]
        for cid in conv_ids:
            cur.execute("DELETE FROM messages WHERE conversation_id = ?", (cid,))
        cur.execute("DELETE FROM conversations WHERE user_id = ?", (user_id,))
        cur.execute("DELETE FROM connectors WHERE user_id = ?", (user_id,))
        cur.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        contrib_ids = [r["id"] for r in cur.execute(
            "SELECT id FROM contributions WHERE user_id = ?", (user_id,))]
        for kid in contrib_ids:
            cur.execute("DELETE FROM knowledge_items WHERE contribution_id = ?", (kid,))
        cur.execute("DELETE FROM contributions WHERE user_id = ?", (user_id,))
        cur.execute("DELETE FROM users WHERE id = ?", (user_id,))
        cur.commit()

    # ---------------- sessions ----------------
    def create_session(self, jti: str, user_id: str, token_sha256: str, expires_at: str) -> None:
        self.conn.execute(
            "INSERT INTO sessions (jti, user_id, token_sha256, created_at, expires_at)"
            " VALUES (?,?,?,?,?)",
            (jti, user_id, token_sha256, now_iso(), expires_at),
        )
        self.conn.commit()

    def is_session_revoked(self, jti: str) -> bool:
        row = self.conn.execute(
            "SELECT revoked FROM sessions WHERE jti = ?", (jti,)).fetchone()
        return bool(row and row["revoked"])

    def revoke_session(self, jti: str) -> None:
        self.conn.execute("UPDATE sessions SET revoked = 1 WHERE jti = ?", (jti,))
        self.conn.commit()

    # ---------------- connectors ----------------
    def add_connector(self, user_id: str, provider: str, label: str, key_ciphertext: str,
                      base_url: str | None, model: str | None, is_default: bool) -> dict:
        cid = new_id()
        if is_default:
            self.conn.execute(
                "UPDATE connectors SET is_default = 0 WHERE user_id = ? AND provider = ?",
                (user_id, provider))
        self.conn.execute(
            "INSERT INTO connectors (id, user_id, provider, label, key_ciphertext, base_url,"
            " model, is_default, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (cid, user_id, provider, label, key_ciphertext, base_url, model,
             1 if is_default else 0, now_iso()),
        )
        self.conn.commit()
        return self.get_connector(cid, user_id)

    def get_connector(self, connector_id: str, user_id: str) -> dict | None:
        row = self.conn.execute(
            "SELECT * FROM connectors WHERE id = ? AND user_id = ?",
            (connector_id, user_id)).fetchone()
        return dict(row) if row else None

    def get_default_connector(self, user_id: str, provider: str) -> dict | None:
        row = self.conn.execute(
            "SELECT * FROM connectors WHERE user_id = ? AND provider = ?"
            " ORDER BY is_default DESC, created_at DESC LIMIT 1",
            (user_id, provider)).fetchone()
        return dict(row) if row else None

    def list_connectors(self, user_id: str) -> list[dict]:
        rows = self.conn.execute(
            "SELECT id, user_id, provider, label, base_url, model, is_default, created_at,"
            " last_used_at FROM connectors WHERE user_id = ? ORDER BY created_at",
            (user_id,)).fetchall()
        return [dict(r) for r in rows]

    def delete_connector(self, connector_id: str, user_id: str) -> bool:
        cur = self.conn.execute(
            "DELETE FROM connectors WHERE id = ? AND user_id = ?", (connector_id, user_id))
        self.conn.commit()
        return cur.rowcount > 0

    def touch_connector(self, connector_id: str) -> None:
        self.conn.execute(
            "UPDATE connectors SET last_used_at = ? WHERE id = ?", (now_iso(), connector_id))
        self.conn.commit()

    # ---------------- conversations & messages ----------------
    def create_conversation(self, user_id: str, title: str) -> dict:
        cid = new_id()
        ts = now_iso()
        self.conn.execute(
            "INSERT INTO conversations (id, user_id, title, created_at, updated_at)"
            " VALUES (?,?,?,?,?)",
            (cid, user_id, title, ts, ts))
        self.conn.commit()
        return self.get_conversation(cid, user_id)

    def get_conversation(self, conversation_id: str, user_id: str) -> dict | None:
        row = self.conn.execute(
            "SELECT * FROM conversations WHERE id = ? AND user_id = ?",
            (conversation_id, user_id)).fetchone()
        return dict(row) if row else None

    def list_conversations(self, user_id: str) -> list[dict]:
        rows = self.conn.execute(
            "SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC",
            (user_id,)).fetchall()
        return [dict(r) for r in rows]

    def add_message(self, conversation_id: str, role: str,
                    content_ciphertext: str, content_sha256: str) -> dict:
        mid = new_id()
        ts = now_iso()
        self.conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content_ciphertext,"
            " content_sha256, created_at) VALUES (?,?,?,?,?,?)",
            (mid, conversation_id, role, content_ciphertext, content_sha256, ts))
        self.conn.execute(
            "UPDATE conversations SET updated_at = ? WHERE id = ?", (ts, conversation_id))
        self.conn.commit()
        return {"id": mid, "conversation_id": conversation_id, "role": role, "created_at": ts}

    def list_messages(self, conversation_id: str) -> list[dict]:
        rows = self.conn.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid",
            (conversation_id,)).fetchall()
        return [dict(r) for r in rows]

    def conversations_older_than(self, cutoff_iso: str) -> list[str]:
        rows = self.conn.execute(
            "SELECT id FROM conversations WHERE updated_at < ?", (cutoff_iso,)).fetchall()
        return [r["id"] for r in rows]

    def delete_conversation(self, conversation_id: str) -> None:
        self.conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
        self.conn.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
        self.conn.commit()

    # ---------------- contributions & knowledge ----------------
    def add_contribution(self, user_id: str, kind: str, title: str, payload_ciphertext: str,
                         fp: str, jenjang: str | None) -> dict:
        cid = new_id()
        ts = now_iso()
        self.conn.execute(
            "INSERT INTO contributions (id, user_id, kind, title, payload_ciphertext,"
            " fingerprint, jenjang, status, created_at, updated_at)"
            " VALUES (?,?,?,?,?,?,?,'received',?,?)",
            (cid, user_id, kind, title, payload_ciphertext, fp, jenjang, ts, ts))
        self.conn.commit()
        return self.get_contribution(cid)

    def get_contribution(self, contribution_id: str) -> dict | None:
        row = self.conn.execute(
            "SELECT * FROM contributions WHERE id = ?", (contribution_id,)).fetchone()
        return dict(row) if row else None

    def get_contribution_by_fingerprint(self, fp: str) -> dict | None:
        row = self.conn.execute(
            "SELECT * FROM contributions WHERE fingerprint = ?", (fp,)).fetchone()
        return dict(row) if row else None

    def list_contributions(self, user_id: str) -> list[dict]:
        rows = self.conn.execute(
            "SELECT id, user_id, kind, title, topic, jenjang, quality_score, status,"
            " verified_by, kb_id, created_at, updated_at FROM contributions"
            " WHERE user_id = ? ORDER BY created_at DESC", (user_id,)).fetchall()
        return [dict(r) for r in rows]

    def update_contribution(self, contribution_id: str, **fields) -> dict | None:
        allowed = {"status", "topic", "jenjang", "quality_score", "screen_notes",
                   "verified_by", "kb_id", "payload_ciphertext"}
        updates = {k: v for k, v in fields.items() if k in allowed}
        if updates:
            updates["updated_at"] = now_iso()
            sql = ", ".join(f"{k} = ?" for k in updates)
            self.conn.execute(
                f"UPDATE contributions SET {sql} WHERE id = ?",
                (*updates.values(), contribution_id))
            self.conn.commit()
        return self.get_contribution(contribution_id)

    def add_knowledge(self, contribution_id: str, title: str, topic: str, jenjang: str,
                      content: str, tags: str, quality_score: float,
                      verified_by: str) -> dict:
        kid = new_id()
        ts = now_iso()
        self.conn.execute(
            "INSERT INTO knowledge_items (id, contribution_id, title, topic, jenjang,"
            " content, tags, quality_score, verified_by, created_at, published_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (kid, contribution_id, title, topic, jenjang, content, tags,
             quality_score, verified_by, ts, ts))
        self.conn.commit()
        row = self.conn.execute(
            "SELECT * FROM knowledge_items WHERE id = ?", (kid,)).fetchone()
        return dict(row)

    def search_knowledge(self, query: str = "", jenjang: str | None = None,
                         topic: str | None = None, limit: int = 20) -> list[dict]:
        sql = "SELECT * FROM knowledge_items WHERE 1=1"
        params: list = []
        if query:
            sql += " AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)"
            like = f"%{query}%"
            params += [like, like, like]
        if jenjang:
            sql += " AND jenjang = ?"
            params.append(jenjang)
        if topic:
            sql += " AND topic = ?"
            params.append(topic)
        sql += " ORDER BY quality_score DESC, published_at DESC LIMIT ?"
        # LIMIT negatif berarti "tanpa batas" di SQLite; tolak nilai negatif
        # agar pemanggil tidak bisa melewati batas jumlah baris.
        params.append(max(0, int(limit)))
        rows = self.conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]
