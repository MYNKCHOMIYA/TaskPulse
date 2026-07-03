import pytest
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app

# --- 1. INFRASTRUCTURE SETTING: Isolated In-Memory SQLite ---
SQLITE_TEST_URL = "sqlite:///:memory:"
engine = create_engine(SQLITE_TEST_URL, connect_args={"check_same_thread": False},poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()    
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        
@pytest.fixture(scope="function")
def client(test_db):
    """Overrides FastAPI's get_db dependency to safely route operations to the test DB."""
    def override_get_db():
        try:
            yield test_db
        finally:
            pass
             
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
        
    app.dependency_overrides.clear()
    
@pytest.fixture(scope="function")
def auth_header(client, sample_user1):
    """Automatically registers, logs in sample_user1, and returns valid bearer headers."""
    client.post("/users/create", json=sample_user1)
    
    login_data = {"username": sample_user1["email"], "password": sample_user1["password"]}
    response = client.post("/auth/login", data=login_data)
    
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

# --- DATA FIXTURES ---
@pytest.fixture
def sample_user1():
    return {
        "username": "minku",
        "email": "minku@gmail.com",
        "password": "minku123"
    }
    
@pytest.fixture
def sample_user2():
    return {
        "username": "atul",
        "email": "atul@gmail.com",
        "password": "atul123"
    }
    
@pytest.fixture
def sample_task():
    return {
        "title": "gym",
        "description": "do it now",
        "status": "PENDING",
        "priority": "HIGH",
    }
    
@pytest.fixture
def sample_task2():
    return {
        "title": "complete backend",
        "description": "need money for gta 6",
        "status": "IN_PROGRESS",
        "priority": "URGENT",
        "due_date": "2026-11-19T12:00:00Z"
    }
