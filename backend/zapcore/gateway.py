"""
Gateway model AI platform ZAP.

Dua jalur kredensial:

1. Jalur bawaan (platform): kunci Gemini milik ZAP di server
   (ZAP_GEMINI_API_KEY). Inilah yang membuat pengguna bisa langsung
   memakai aplikasi sesudah login Google tanpa menyiapkan apa pun.
2. Jalur connector (BYOK): kunci milik pengguna sendiri, disimpan
   terenkripsi AES-256-GCM di server dan hanya dipakai untuk permintaan
   pemiliknya. Penyedia yang didukung mengikuti pemilih model di
   frontend: Gemini, OpenAI, Anthropic, Mistral, DeepSeek, dan endpoint
   khusus yang kompatibel OpenAI.

Keluaran model yang diketahui solusi akhirnya wajib melewati pagar
Zero Answer Policy milik CFL (RobustZeroAnswerGuardrail.sanitize).
"""

from __future__ import annotations

import httpx

PROVIDERS: dict[str, dict] = {
    "gemini": {
        "kind": "gemini",
        "default_model": "gemini-2.0-flash",
        "label": "Google Gemini",
    },
    "openai": {
        "kind": "openai",
        "base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o-mini",
        "label": "OpenAI",
    },
    "anthropic": {
        "kind": "anthropic",
        "base_url": "https://api.anthropic.com/v1",
        "default_model": "claude-3-5-sonnet-latest",
        "label": "Anthropic Claude",
    },
    "mistral": {
        "kind": "openai",
        "base_url": "https://api.mistral.ai/v1",
        "default_model": "mistral-small-latest",
        "label": "Mistral AI",
    },
    "deepseek": {
        "kind": "openai",
        "base_url": "https://api.deepseek.com/v1",
        "default_model": "deepseek-chat",
        "label": "DeepSeek",
    },
    "custom": {
        "kind": "openai",
        "base_url": None,  # wajib dari connector pengguna
        "default_model": None,
        "label": "Endpoint khusus (kompatibel OpenAI)",
    },
}

SOCRATIC_SYSTEM_PROMPT = (
    "Kamu adalah tutor Sokratik ZAP. Aturan mutlak Zero Answer Policy: "
    "jangan pernah memberikan jawaban akhir, nilai akhir variabel, atau "
    "kesimpulan solusi dari soal yang sedang dikerjakan pengguna. "
    "Tugasmu hanya mengajukan pertanyaan pemantik, memberi petunjuk "
    "bertahap, dan membantu pengguna menemukan langkahnya sendiri. "
    "Sesuaikan tingkat bahasa dengan jenjang pengguna."
)


class GatewayError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.status = status


def _default_http_post(url: str, headers: dict, payload: dict) -> tuple[int, dict]:
    # Galat jaringan/timeout tidak boleh lolos sebagai 500 mentah: panggilan
    # provider berjalan di jalur permintaan /chat dan /connectors/verify.
    try:
        resp = httpx.post(url, headers=headers, json=payload, timeout=60.0)
    except httpx.TimeoutException:
        return 504, {"error": {"message": "Penyedia AI tidak merespons dalam 60 detik"}}
    except httpx.HTTPError as err:
        return -1, {"error": {"message": f"Gagal menghubungi penyedia AI: {err}"}}
    try:
        return resp.status_code, resp.json()
    except Exception:
        return resp.status_code, {}


class Gateway:
    def __init__(self, settings, store, vault, http_post=None):
        self.settings = settings
        self.store = store
        self.vault = vault
        self.http_post = http_post or _default_http_post

    # ---------------- resolusi kredensial ----------------
    def resolve_credential(self, user_id: str, provider: str,
                           connector_id: str | None = None) -> dict:
        """Tentukan kredensial aktif. BYOK didahulukan, lalu kunci platform."""
        if provider not in PROVIDERS:
            raise GatewayError("UNKNOWN_PROVIDER", f"Penyedia tidak dikenal: {provider}")
        connector = None
        if connector_id:
            connector = self.store.get_connector(connector_id, user_id)
            if connector is None:
                raise GatewayError("CONNECTOR_NOT_FOUND", "Connector tidak ditemukan", 404)
            if connector["provider"] != provider:
                raise GatewayError(
                    "CONNECTOR_MISMATCH", "Connector bukan untuk penyedia yang diminta")
        else:
            connector = self.store.get_default_connector(user_id, provider)
        if connector is not None:
            return {
                "source": "byok",
                "api_key": self.vault.decrypt(connector["key_ciphertext"]),
                "base_url": connector.get("base_url") or PROVIDERS[provider].get("base_url"),
                "model": connector.get("model") or PROVIDERS[provider]["default_model"],
                "connector_id": connector["id"],
            }
        if provider == "gemini" and self.settings.gemini_api_key:
            return {
                "source": "platform",
                "api_key": self.settings.gemini_api_key,
                "base_url": None,
                "model": self.settings.gemini_model,
                "connector_id": None,
            }
        raise GatewayError(
            "NO_CREDENTIAL",
            "Belum ada kredensial untuk penyedia ini. Tambahkan API key lewat"
            " halaman Connector, atau pakai model bawaan Gemini.",
            402,
        )

    # ---------------- panggilan per jenis penyedia ----------------
    def _call_gemini(self, cred: dict, model: str, messages: list[dict],
                     system: str | None) -> str:
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent"
        )
        contents = [
            {"role": "model" if m["role"] == "assistant" else "user",
             "parts": [{"text": m["content"]}]}
            for m in messages
        ]
        payload: dict = {"contents": contents}
        if system:
            payload["systemInstruction"] = {"parts": [{"text": system}]}
        status, data = self.http_post(
            url, {"x-goog-api-key": cred["api_key"], "Content-Type": "application/json"},
            payload)
        if status != 200:
            msg = (data.get("error") or {}).get("message") or f"Gemini HTTP {status}"
            raise GatewayError("PROVIDER_ERROR", msg, 502)
        try:
            parts = data["candidates"][0]["content"]["parts"]
            return "".join(p.get("text", "") for p in parts).strip()
        except (KeyError, IndexError, TypeError):
            raise GatewayError("PROVIDER_ERROR", "Respons Gemini tidak berbentuk teks", 502)

    def _call_openai_kind(self, cred: dict, provider: str, model: str,
                          messages: list[dict], system: str | None) -> str:
        base = cred.get("base_url") or PROVIDERS[provider].get("base_url")
        if not base:
            raise GatewayError(
                "BASE_URL_REQUIRED", "Connector endpoint khusus wajib memiliki base URL")
        url = base.rstrip("/") + "/chat/completions"
        msgs = ([{"role": "system", "content": system}] if system else []) + messages
        status, data = self.http_post(
            url,
            {"Authorization": f"Bearer {cred['api_key']}",
             "Content-Type": "application/json"},
            {"model": model, "messages": msgs})
        if status != 200:
            msg = (data.get("error") or {}).get("message") or f"Penyedia HTTP {status}"
            raise GatewayError("PROVIDER_ERROR", msg, 502)
        try:
            return data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError):
            raise GatewayError("PROVIDER_ERROR", "Respons penyedia tidak berbentuk teks", 502)

    def _call_anthropic(self, cred: dict, model: str, messages: list[dict],
                        system: str | None) -> str:
        url = (cred.get("base_url") or PROVIDERS["anthropic"]["base_url"]).rstrip("/") \
            + "/messages"
        payload: dict = {
            "model": model,
            "max_tokens": 1024,
            "messages": messages,
        }
        if system:
            payload["system"] = system
        status, data = self.http_post(
            url,
            {"x-api-key": cred["api_key"], "anthropic-version": "2023-06-01",
             "Content-Type": "application/json"},
            payload)
        if status != 200:
            msg = (data.get("error") or {}).get("message") or f"Anthropic HTTP {status}"
            raise GatewayError("PROVIDER_ERROR", msg, 502)
        try:
            return "".join(
                b.get("text", "") for b in data["content"] if b.get("type") == "text"
            ).strip()
        except (KeyError, TypeError):
            raise GatewayError("PROVIDER_ERROR", "Respons Anthropic tidak berbentuk teks", 502)

    # ---------------- API publik ----------------
    def chat(self, user_id: str, provider: str, messages: list[dict],
             model: str | None = None, connector_id: str | None = None,
             system: str | None = None,
             guardrail_solution: str | None = None) -> dict:
        cred = self.resolve_credential(user_id, provider, connector_id)
        chosen_model = model or cred.get("model") or PROVIDERS[provider]["default_model"]
        kind = PROVIDERS[provider]["kind"]
        if kind == "gemini":
            text = self._call_gemini(cred, chosen_model, messages, system)
        elif kind == "anthropic":
            text = self._call_anthropic(cred, chosen_model, messages, system)
        else:
            text = self._call_openai_kind(cred, provider, chosen_model, messages, system)
        # Pagar Zero Answer Policy milik CFL: satu-satunya penyaring keluaran
        # yang diakui proyek ini. Selalu dijalankan - termasuk ketika solusi
        # akhir tidak diketahui (guardrail_solution=None) - agar deklarasi
        # seperti "jawaban akhirnya adalah x = 4" tetap disaring.
        from cfl import RobustZeroAnswerGuardrail

        text = RobustZeroAnswerGuardrail.sanitize(
            text, final_solution=guardrail_solution)
        if cred.get("connector_id"):
            self.store.touch_connector(cred["connector_id"])
        return {
            "text": text,
            "provider": provider,
            "model": chosen_model,
            "credential": cred["source"],
        }

    def verify_key(self, provider: str, api_key: str,
                   base_url: str | None = None, model: str | None = None) -> dict:
        """Uji sebuah API key dengan satu panggilan minimal."""
        if provider not in PROVIDERS:
            raise GatewayError("UNKNOWN_PROVIDER", f"Penyedia tidak dikenal: {provider}")
        cred = {
            "source": "byok",
            "api_key": api_key,
            "base_url": base_url or PROVIDERS[provider].get("base_url"),
            "model": model or PROVIDERS[provider]["default_model"],
            "connector_id": None,
        }
        chosen = cred["model"] or "gpt-4o-mini"
        probe = [{"role": "user", "content": "Balas dengan kata: OK"}]
        kind = PROVIDERS[provider]["kind"]
        try:
            if kind == "gemini":
                text = self._call_gemini(cred, chosen, probe, None)
            elif kind == "anthropic":
                text = self._call_anthropic(cred, chosen, probe, None)
            else:
                text = self._call_openai_kind(cred, provider, chosen, probe, None)
        except GatewayError as err:
            return {"valid": False, "error": str(err), "code": err.code}
        return {"valid": True, "model": chosen, "sample": text[:80]}
