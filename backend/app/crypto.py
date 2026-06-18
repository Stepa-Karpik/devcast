from __future__ import annotations

import json
from typing import Any

from cryptography.fernet import Fernet

from app.config import settings


def _fernet() -> Fernet:
    key = settings.app_encryption_key
    if not key:
        raise RuntimeError(
            "APP_ENCRYPTION_KEY is not set. Generate one with "
            "`python -c \"from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())\"`"
        )
    return Fernet(key.encode())


def encrypt_str(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt_str(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()


def encrypt_json(data: dict[str, Any]) -> str:
    return encrypt_str(json.dumps(data))


def decrypt_json(token: str) -> dict[str, Any]:
    return json.loads(decrypt_str(token))


def mask(value: str | None, visible: int = 4) -> str:
    """Return a non-reversible hint of a secret, never the secret itself."""
    if not value:
        return ""
    if len(value) <= visible:
        return "•" * len(value)
    return "•" * (len(value) - visible) + value[-visible:]
