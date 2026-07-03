import pytest

def test_user_registration_and_login_flow(client, sample_user2):
    reg_response = client.post("/users/create", json=sample_user2)
    assert reg_response.status_code == 201
    assert reg_response.json()["message"] == "User created successfully"
    
    dup_response = client.post("/users/create", json=sample_user2)
    assert dup_response.status_code == 400
    assert dup_response.json()["detail"] == "email already registered"
    
    login_form = {"username": sample_user2["email"], "password": sample_user2["password"]}
    
    login_response = client.post("/auth/login", data=login_form)
    assert login_response.status_code == 200
    
    tokens = login_response.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    assert tokens["token_type"] == "bearer"
    
    
def test_unauthorized_endpoint_block_request(client):
    
    response = client.get("/tasks/")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"
    

import pytest

def test_user_logout_revocation_lifecycle(client, sample_user1):
  
    client.post("/users/create", json=sample_user1)
    
    login_form = {
        "username": sample_user1["email"],
        "password": sample_user1["password"]
    }
    login_response = client.post("/auth/login", data=login_form)
    assert login_response.status_code == 200
    
  
    tokens = login_response.json()
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]
    headers = {"Authorization": f"Bearer {access_token}"}
    
   
    profile_before_logout = client.get("/auth/me", headers=headers)
    assert profile_before_logout.status_code == 200
    assert profile_before_logout.json()["email"] == sample_user1["email"]
    
    
    logout_payload = {"refresh_token": refresh_token}
    logout_response = client.post("/auth/logout", json=logout_payload, headers=headers)
    assert logout_response.status_code == 200
    assert "revoked" in logout_response.json()["message"]
    
 
    profile_after_logout = client.get("/auth/me", headers=headers)
    assert profile_after_logout.status_code == 401
    assert "revoked" in profile_after_logout.json()["detail"].lower()

