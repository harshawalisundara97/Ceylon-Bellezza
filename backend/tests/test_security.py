import pytest
from jose import JWTError

from app.auth.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_hash_and_verify_password():
    hashed = hash_password("correct-horse")
    assert hashed != "correct-horse"
    assert verify_password("correct-horse", hashed) is True
    assert verify_password("wrong-password", hashed) is False


def test_create_and_decode_token():
    token = create_access_token({"sub": "abc-123", "role": "salon_admin", "salon_id": "salon-1"})
    payload = decode_access_token(token)
    assert payload["sub"] == "abc-123"
    assert payload["role"] == "salon_admin"
    assert payload["salon_id"] == "salon-1"


def test_decode_invalid_token_raises():
    with pytest.raises(JWTError):
        decode_access_token("not-a-real-token")
