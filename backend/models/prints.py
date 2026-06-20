from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import engine
from models.user import User

# Open a transactional session with the database engine
with Session(engine) as session:
   
    user = session.scalars(select(User).where(User.username == "amitabh")).first()
    print(user)
    if user :
        session.delete(user)
        session.commit()
    else:
        print("User not found")
    