from fastapi import APIRouter,Depends
from schemas.user import UserCreate
from app.database import get_db
from sqlalchemy.orm import Session
from models.user import User
from core.security import hash_password

router = APIRouter()


@router.post("/register")
def register(user:UserCreate , db: Session = Depends(get_db)):
    new_user= User(
        username  = user.username,
        email = user.email,
        password_hash =hash_password(user.password)
    )
    db.add(new_user)
    db.commit()
    
    return{
        "message" : "user created"
    }
