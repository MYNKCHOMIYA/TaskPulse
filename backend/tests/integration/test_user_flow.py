import pytest


def test_get_current_user_profile(client, auth_header):
    response = client.get("auth/me", headers=auth_header)
    assert response.status_code == 200

    profile_data = response.json()
    assert profile_data["username"] == "minku"
    assert profile_data["email"] == "minku@gmail.com"
    assert "id" in profile_data
