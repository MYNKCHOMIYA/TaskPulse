from fastapi import APIRouter,Depends,HTTPException,status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_db
from models.user import User
from core.security import TokenData,verify_token,hash_password
from schemas.user import UserModel,UserCreate,UserUpdate

router = APIRouter(prefix="/users",tags=["users"])

#---------------------Create New User-----------------------------------#
@router.post("/create",status_code=status.HTTP_201_CREATED)
def create_user(user_data:UserCreate,db : Session = Depends(get_db)):
    existing_user= db.scalar(select(User).where(User.email==user_data.email))
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail = "email already registered"
        ) 
    
    hashed_pwd = hash_password(user_data.password)
    
    new_user = User(
        username = user_data.username,
        email   = user_data.email,
        password_hash = hashed_pwd
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return{"message":"User created successfully","user_id" : new_user.id}
    
#--------------------update user-----------------------------------#    
@router.put("/update/{user_id}")
def update_user(user_id:int,user_data:UserUpdate,db : Session = Depends(get_db)):
    db_user = db.scalar(select(User).where(User.id == user_id))
    if not db_user :
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "User Not Found"
        )
    if user_data is not None:
        existing_user= db.scalar(select(User).where(User.email==user_data.email,User.id != user_id))
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail = "email already registered"
            ) 
        
    if user_data.username is not None:
        db_user.username = user_data.username
    if user_data.email is not None:
        db_user.email = user_data.email
    
    if user_data.password is not None:
        db_user.password_hash = hash_password(user_data.password)
        
    user_username = db_user.username

    db.commit()
    db.refresh(db_user)
    return{f"{user_id} {user_username} is updated succesufully"}
    
#---------------------delete user-----------------------------------#
@router.delete("/delete/{user_id}")
def delete_user(user_id:int,db:Session = Depends(get_db)):
    db_user = db.scalar(select(User).where(User.id == user_id))
    if not db_user:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "user not found"
        )
    user_username = db_user.username
             
    db.delete(db_user)
    db.commit()
    return{f"{user_id} {user_username} is deleted succesufully"}
    
    
#-------------------user_profile----------------------------------------#    
@router.get("/profile",response_model=UserModel)
def current_user(db : Session = Depends(get_db),token_data:TokenData =Depends(verify_token)):
    db_user = db.scalar(select(User).where(User.email==token_data.email))
    if not db_user:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "User Not found"
        )
    return db_user
    