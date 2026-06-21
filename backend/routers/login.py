from fastapi import APIRouter,Depends
from schemas.user import UserLogin
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_db
from models.user import User
from core.security import verify_password,create_access_token
from fastapi.security import OAuth2PasswordRequestForm
router = APIRouter()

@router.post("/login")
def login(form_data:OAuth2PasswordRequestForm =Depends(), db : Session = Depends(get_db)):
    db_user = db.scalar(
        select(User).where(
            User.email == form_data.username
        )
    )
    if not db_user :
        return{"message":"invalid credentials"}
    
    if not verify_password(
        form_data.password,
        db_user.password_hash
    ):
        return {"message :inavalid credentials"}
    access_token = create_access_token({"sub":db_user.email})
    return {"access_token": access_token,
            "token_type":"bearer"}