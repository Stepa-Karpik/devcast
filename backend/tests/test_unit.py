import hashlib
import hmac

from app.crypto import decrypt_str, encrypt_str, mask
from app.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.services.llm.base import parse_summary
from app.services.matcher import CONFIDENCE_THRESHOLD, extract_tag, match_task


def test_crypto_round_trip():
    secret = "sk-deepseek-abcdef123456"
    token = encrypt_str(secret)
    assert token != secret
    assert decrypt_str(token) == secret


def test_mask_never_reveals_secret():
    masked = mask("sk-supersecretkey")
    assert masked.endswith("tkey")
    assert "supersecret" not in masked
    assert "•" in masked


def test_password_hash_and_verify():
    h = hash_password("password123")
    assert verify_password("password123", h)
    assert not verify_password("wrong", h)


def test_jwt_round_trip():
    import uuid

    uid = uuid.uuid4()
    token = create_access_token(uid)
    assert decode_access_token(token) == uid
    assert decode_access_token("garbage") is None


def test_webhook_signature_logic():
    secret = b"whsecret"
    body = b'{"ref":"refs/heads/main"}'
    sig = "sha256=" + hmac.new(secret, body, hashlib.sha256).hexdigest()
    expected = "sha256=" + hmac.new(secret, body, hashlib.sha256).hexdigest()
    assert hmac.compare_digest(sig, expected)
    bad = "sha256=" + hmac.new(b"other", body, hashlib.sha256).hexdigest()
    assert not hmac.compare_digest(sig, bad)


def test_parse_summary_clean_json():
    text = '{"headline": "Добавлено меню", "bullets": ["Добавлено меню бота", "Изменён старт"]}'
    s = parse_summary(text)
    assert s.headline == "Добавлено меню"
    assert len(s.bullets) == 2


def test_parse_summary_fenced_json():
    text = '```json\n{"headline": "X", "bullets": ["a"]}\n```'
    s = parse_summary(text)
    assert s.headline == "X"
    assert s.bullets == ["a"]


def test_parse_summary_fallback_to_lines():
    s = parse_summary("- did a thing\n- did another", fallback_headline="commit msg")
    assert s.bullets


def test_matcher_explicit_tag_always_updates():
    tasks = [{"id": "1", "title": "Some task", "key": "VINT-12"}]
    m = match_task("[VINT-12] add bot menu", "Добавлено меню", tasks)
    assert m.task_id == "1"
    assert m.explicit
    assert m.should_update_status


def test_matcher_low_confidence_does_not_update():
    tasks = [{"id": "1", "title": "completely unrelated database migration", "key": None}]
    m = match_task("add bot menu", "Добавлено меню бота", tasks)
    assert m.confidence < CONFIDENCE_THRESHOLD
    assert not m.should_update_status


def test_extract_tag():
    assert extract_tag("[ABC-42] fix") == "ABC-42"
    assert extract_tag("fix #15") == "15"
    assert extract_tag("no tag here") is None
