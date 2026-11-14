"""
API HTTP platform ZAP (FastAPI). Berjalan sebagai layanan terpisah dari
mesin diagnostik CFL. Seluruh endpoint platform memakai awalan /api/v1.

Keamanan ringkas:
- Sesi = JWT ZAP dari hasil verifikasi ID token Google di server.
- Endpoint selain /auth/google dan /system/health wajib Bearer token.
- Isi chat dan kunci connector tidak pernah keluar dari server dalam
  bentuk selain untuk pemiliknya (chat) atau tidak sama sekali (kunci).
"""

from __future__ import annotations

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .auth import (
    AuthError,
    create_session_token,
    parse_session_token,
    session_token_fingerprint,
    validate_jenjang,
    validate_role,
    verify_google_id_token,
)
from .config import Settings, get_settings
from .crypto import Vault, sha256_hex
from .gateway import Gateway, GatewayError, PROVIDERS, SOCRATIC_SYSTEM_PROMPT
from .learning import LearningPipeline
from .privacy import (
    PrivacyError,
    erase_user,
    export_user_data,
    run_retention_sweep,
    set_share_consent,
)
from .store import Store


# ---------------- skema permintaan ----------------

class GoogleAuthIn(BaseModel):
    id_token: str
    role: str | None = None
    jenjang: str | None = None


class ProfileIn(BaseModel):
    role: str | None = None
    jenjang: str | None = None
    name: str | None = None


class ConsentIn(BaseModel):
    agree: bool


class ConnectorIn(BaseModel):
    provider: str
    api_key: str
    label: str = ""
    base_url: str | None = None
    model: str | None = None
    make_default: bool = True


class VerifyKeyIn(BaseModel):
    provider: str
    api_key: str
    base_url: str | None = None
    model: str | None = None


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    conversation_id: str | None = None
    provider: str = "gemini"
    model: str | None = None
    connector_id: str | None = None


class ContributeIn(BaseModel):
    kind: str
    title: str = Field(min_length=3, max_length=200)
    text: str = ""
    steps: list[str] | None = None
    target_var: str | None = Field(default=None, max_length=5)
    target_variable: str | None = Field(default=None, max_length=5)
    jenjang: str | None = None


# ---------------- rakitan aplikasi ----------------

class Platform:
    def __init__(self, settings: Settings | None = None, store: Store | None = None,
                 vault: Vault | None = None, google_http_get=None, gateway_http_post=None):
        self.settings = settings or get_settings()
        # Fail-fast: ZAP_ENV=production dengan rahasia bawaan = startup gagal,
        # bukan sekadar status di health check.
        self.settings.assert_production_ready()
        self.store = store or Store(self.settings.db_path)
        if vault is not None:
            self.vault = vault
        elif self.settings.master_key_b64:
            self.vault = Vault.from_base64(self.settings.master_key_b64)
        elif self.settings.master_secret:
            self.vault = Vault.from_secret(self.settings.master_secret)
        else:
            self.vault = Vault.from_secret(self.settings.jwt_secret + ":zap-dev-vault")
        self.gateway = Gateway(self.settings, self.store, self.vault,
                               http_post=gateway_http_post)
        self.learning = LearningPipeline(
            self.store, self.vault, self.settings, gateway=self.gateway)
        self.google_http_get = google_http_get


def public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "avatar": user["avatar"],
        "role": user["role"],
        "jenjang": user["jenjang"],
        "consent_learning": bool(user["consent_learning"]),
        "consent_version": user["consent_version"],
        "created_at": user["created_at"],
    }


def create_app(platform: Platform | None = None) -> FastAPI:
    pf = platform or Platform()
    app = FastAPI(
        title="ZAP Platform API",
        description="Autentikasi, gateway AI, privasi, dan self-learning ZAP",
        version="1.0.0",
    )

    def current_user(authorization: str | None = Header(default=None)) -> dict:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401, "Sesi tidak ditemukan, silakan masuk lagi")
        token = authorization[len("Bearer "):].strip()
        try:
            payload = parse_session_token(pf.settings.jwt_secret, token)
        except AuthError as err:
            raise HTTPException(err.status, str(err))
        if pf.store.is_session_revoked(payload["jti"]):
            raise HTTPException(401, "Sesi sudah dicabut, silakan masuk lagi")
        user = pf.store.get_user(payload["sub"])
        if user is None:
            raise HTTPException(401, "Pengguna tidak ditemukan")
        user["_jti"] = payload["jti"]
        user["_token"] = token
        return user

    # ---------- sistem ----------
    @app.get("/api/v1/system/health", tags=["System"])
    def health():
        return {"status": "ok", "service": "zap-platform",
                "production_ready": pf.settings.is_production_ready}

    @app.get("/api/v1/system/providers", tags=["System"])
    def providers():
        return {"providers": [
            {"id": pid, "label": cfg["label"], "default_model": cfg["default_model"]}
            for pid, cfg in PROVIDERS.items()]}

    # ---------- autentikasi ----------
    @app.post("/api/v1/auth/google", tags=["Auth"])
    def auth_google(body: GoogleAuthIn):
        try:
            profile = verify_google_id_token(
                body.id_token, pf.settings.google_client_id,
                http_get=pf.google_http_get)
        except AuthError as err:
            raise HTTPException(err.status, str(err))
        user = pf.store.upsert_user_from_google(
            profile["sub"], profile["email"], profile["name"], profile["avatar"])
        if body.role or body.jenjang:
            user = pf.store.update_profile(
                user["id"],
                role=validate_role(body.role) if body.role else user["role"],
                jenjang=validate_jenjang(body.jenjang) if body.jenjang else user["jenjang"])
        token, jti, expires = create_session_token(
            pf.settings.jwt_secret, user, pf.settings.session_days)
        pf.store.create_session(jti, user["id"], session_token_fingerprint(token), expires)
        pf.store.audit(user["id"], "auth.login")
        return {"token": token, "token_type": "bearer", "expires_at": expires,
                "user": public_user(user)}

    @app.post("/api/v1/auth/logout", tags=["Auth"])
    def auth_logout(user: dict = Depends(current_user)):
        pf.store.revoke_session(user["_jti"])
        pf.store.audit(user["id"], "auth.logout")
        return {"logged_out": True}

    @app.get("/api/v1/me", tags=["Auth"])
    def me(user: dict = Depends(current_user)):
        return public_user(user)

    @app.patch("/api/v1/me", tags=["Auth"])
    def update_me(body: ProfileIn, user: dict = Depends(current_user)):
        fields = {}
        if body.role is not None:
            fields["role"] = validate_role(body.role)
        if body.jenjang is not None:
            fields["jenjang"] = validate_jenjang(body.jenjang)
        if body.name:
            fields["name"] = body.name
        updated = pf.store.update_profile(user["id"], **fields)
        return public_user(updated)

    # ---------- connector (BYOK) ----------
    @app.get("/api/v1/connectors", tags=["Connectors"])
    def list_connectors(user: dict = Depends(current_user)):
        return {"connectors": pf.store.list_connectors(user["id"])}

    @app.post("/api/v1/connectors", tags=["Connectors"])
    def add_connector(body: ConnectorIn, user: dict = Depends(current_user)):
        if body.provider not in PROVIDERS:
            raise HTTPException(400, f"Penyedia tidak dikenal: {body.provider}")
        if not body.api_key.strip():
            raise HTTPException(400, "API key tidak boleh kosong")
        conn = pf.store.add_connector(
            user_id=user["id"], provider=body.provider, label=body.label,
            key_ciphertext=pf.vault.encrypt(body.api_key.strip()),
            base_url=body.base_url, model=body.model,
            is_default=body.make_default)
        pf.store.audit(user["id"], "connector.added", conn["id"],
                       {"provider": body.provider})
        return {"connector": {k: v for k, v in conn.items()
                              if k != "key_ciphertext"}}

    @app.delete("/api/v1/connectors/{connector_id}", tags=["Connectors"])
    def delete_connector(connector_id: str, user: dict = Depends(current_user)):
        if not pf.store.delete_connector(connector_id, user["id"]):
            raise HTTPException(404, "Connector tidak ditemukan")
        pf.store.audit(user["id"], "connector.deleted", connector_id)
        return {"deleted": True}

    @app.post("/api/v1/connectors/verify", tags=["Connectors"])
    def verify_connector(body: VerifyKeyIn, user: dict = Depends(current_user)):
        try:
            return pf.gateway.verify_key(
                body.provider, body.api_key, body.base_url, body.model)
        except GatewayError as err:
            raise HTTPException(err.status, str(err))

    # ---------- chat ----------
    @app.get("/api/v1/conversations", tags=["Chat"])
    def list_conversations(user: dict = Depends(current_user)):
        return {"conversations": pf.store.list_conversations(user["id"])}

    @app.get("/api/v1/conversations/{conversation_id}/messages", tags=["Chat"])
    def list_messages(conversation_id: str, user: dict = Depends(current_user)):
        if pf.store.get_conversation(conversation_id, user["id"]) is None:
            raise HTTPException(404, "Percakapan tidak ditemukan")
        out = []
        for msg in pf.store.list_messages(conversation_id):
            out.append({
                "id": msg["id"], "role": msg["role"],
                "content": pf.vault.decrypt_for_user(user["id"],
                                                     msg["content_ciphertext"]),
                "created_at": msg["created_at"],
            })
        return {"messages": out}

    @app.post("/api/v1/chat", tags=["Chat"])
    def chat(body: ChatIn, user: dict = Depends(current_user)):
        conv = None
        if body.conversation_id:
            conv = pf.store.get_conversation(body.conversation_id, user["id"])
            if conv is None:
                raise HTTPException(404, "Percakapan tidak ditemukan")
        if conv is None:
            conv = pf.store.create_conversation(
                user["id"], body.message.strip()[:60] or "Percakapan baru")
        history = [
            {"role": m["role"],
             "content": pf.vault.decrypt_for_user(user["id"], m["content_ciphertext"])}
            for m in pf.store.list_messages(conv["id"])
        ][-20:]  # batasi konteks: kirim maksimal 20 pesan terakhir ke penyedia
        pf.store.add_message(
            conv["id"], "user",
            pf.vault.encrypt_for_user(user["id"], body.message),
            sha256_hex(body.message))
        system = SOCRATIC_SYSTEM_PROMPT + f" Jenjang pengguna: {user['jenjang']}."
        try:
            result = pf.gateway.chat(
                user["id"], body.provider,
                history + [{"role": "user", "content": body.message}],
                model=body.model, connector_id=body.connector_id, system=system)
        except GatewayError as err:
            raise HTTPException(err.status, str(err))
        pf.store.add_message(
            conv["id"], "assistant",
            pf.vault.encrypt_for_user(user["id"], result["text"]),
            sha256_hex(result["text"]))
        return {"conversation_id": conv["id"], "reply": result["text"],
                "provider": result["provider"], "model": result["model"],
                "credential": result["credential"]}

    # ---------- self-learning ----------
    @app.post("/api/v1/contribute", tags=["Learning"])
    def contribute(body: ContributeIn, user: dict = Depends(current_user)):
        payload = {
            "text": body.text,
            "steps": body.steps or [],
            "target_var": (body.target_variable or body.target_var or "x"),
        }
        try:
            submitted = pf.learning.submit(
                user, body.kind, body.title, payload,
                jenjang=validate_jenjang(body.jenjang) if body.jenjang else None)
        except PrivacyError as err:
            raise HTTPException(err.status, str(err))
        except ValueError as err:
            raise HTTPException(400, str(err))
        if submitted["duplicate"]:
            return submitted
        report = pf.learning.run_pipeline(submitted["contribution_id"], user["id"])
        return {**submitted, "pipeline": report}

    @app.get("/api/v1/contributions", tags=["Learning"])
    def my_contributions(user: dict = Depends(current_user)):
        return {"contributions": pf.store.list_contributions(user["id"])}

    @app.get("/api/v1/knowledge/search", tags=["Learning"])
    def knowledge_search(q: str = "", jenjang: str | None = None,
                         topic: str | None = None, limit: int = 10,
                         user: dict = Depends(current_user)):
        items = pf.learning.retrieve_for_tutor(
            query=q, jenjang=jenjang, topic=topic, limit=max(1, min(limit, 50)))
        return {"items": items}

    # ---------- privasi ----------
    @app.post("/api/v1/privacy/consent", tags=["Privacy"])
    def consent(body: ConsentIn, user: dict = Depends(current_user)):
        updated = set_share_consent(pf.store, user["id"], body.agree)
        return public_user(updated)

    @app.get("/api/v1/privacy/export", tags=["Privacy"])
    def export_data(user: dict = Depends(current_user)):
        try:
            return export_user_data(pf.store, pf.vault, user["id"],
                                    pf.settings.jwt_secret)
        except PrivacyError as err:
            raise HTTPException(err.status, str(err))

    @app.delete("/api/v1/privacy/account", tags=["Privacy"])
    def delete_account(user: dict = Depends(current_user)):
        try:
            return erase_user(pf.store, user["id"], pf.settings.jwt_secret)
        except PrivacyError as err:
            raise HTTPException(err.status, str(err))

    @app.post("/api/v1/privacy/retention/run", tags=["Privacy"])
    def retention_run(user: dict = Depends(current_user)):
        # Sapuan retensi bersifat GLOBAL (menghapus data lama semua akun),
        # jadi hanya email admin pada ZAP_ADMIN_EMAILS yang boleh memicu.
        admin_emails = {e.lower() for e in pf.settings.admin_emails}
        if (user.get("email") or "").lower() not in admin_emails:
            raise HTTPException(
                403, "Sapuan retensi global hanya boleh dipicu oleh admin")
        return run_retention_sweep(pf.store, pf.settings.retention_days)

    return app
