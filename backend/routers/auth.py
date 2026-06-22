from fastapi import APIRouter,Depends,HTTPException,status
from sqlalchemy import select,delete
from sqlalchemy.orm import Session
from app.database import get_db
from models.user import User
from core.security import verify_password,create_access_token,TokenData,verify_token,hash_password
from fastapi.security import OAuth2PasswordRequestForm
from schemas.user import UserModel


router = APIRouter(prefix="/auth",tags=["Authetication"])

#-------------------login----------------------------------------#
@router.post("/login")
def login(form_data:OAuth2PasswordRequestForm =Depends(), db : Session = Depends(get_db)):
    db_user = db.scalar(
        select(User).where(
            User.email == form_data.username
        )
    )
    if not db_user :
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Invalid credentials"
        )
    
    if not verify_password(form_data.password,db_user.password_hash):
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Invalid credentials"
        )
    access_token = create_access_token({"sub":db_user.email})
    return {"access_token": access_token,
            "token_type":"bearer"}


    
#-------------------check_login----------------------------------------#
@router.get("/me",response_model=UserModel)
def user(token_data: TokenData = Depends(verify_token),db: Session = Depends(get_db)):
    db_user = db.scalar(select(User).where(User.email == token_data.email))
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="user no longer exist or never existed"
        )
    return db_user
    

    
        
    
    
    



    
    
