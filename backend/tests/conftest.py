import os

from cryptography.fernet import Fernet

# Provide valid keys so crypto/security work without a real .env.
os.environ.setdefault("APP_ENCRYPTION_KEY", Fernet.generate_key().decode())
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("GITHUB_APP_WEBHOOK_SECRET", "whsecret")
