from fastapi.testclient import TestClient
from main import app
from core.security import create_access_token
from app.database import SessionLocal
from models.user import User

client = TestClient(app)

db = SessionLocal()
user = db.query(User).first()
db.close()

token = create_access_token({"sub": user.email})

res = client.post("/tasks/create", json={"title": "Hello Task"}, headers={"Authorization": f"Bearer {token}"})
print(res.status_code)
print(res.json())
