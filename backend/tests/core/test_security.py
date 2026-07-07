import pytest
from core.security import hash_password, verify_password


def test_password_hashing_and_verification():

    mock_user_password = "my secret key "  # Notice the trailing space character

    hashed_output = hash_password(mock_user_password)

    assert hashed_output != mock_user_password

    is_password_correct = verify_password(mock_user_password, hashed_output)
    assert is_password_correct is True


def test_password_verification_fails_with_wrong_password():

    mock_user_password = "my secret key "
    mock_wrong_password = "my secret key"  # Missing the critical trailing space

    hashed_db_record = hash_password(mock_user_password)

    is_login_allowed = verify_password(mock_wrong_password, hashed_db_record)
    assert is_login_allowed is False
