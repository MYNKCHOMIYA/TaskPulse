from sqlalchemy.orm import Session
from app.database import engine
from models.user import User

with Session(engine) as session:
    new_user = User(
        username="Mayank",
        email="mayank2@example.com",
        password_hash="dummy_hash"
    )

    session.add(new_user)
    session.commit()
