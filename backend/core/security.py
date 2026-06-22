import bcrypt
from datetime import datetime,timedelta,timezone
from pydantic import BaseModel
from jose import jwt,JWTError
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends,HTTPException,status
import os
from dotenv import load_dotenv

load_dotenv()



raw_key = os.getenv("MY_SECRET_KEY")

if raw_key is None:
    raise ValueError("MY_SECRET_KEY environment variable is missing")

SECRET_KEY : str = raw_key

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

class Token(BaseModel):
    access_token : str
    token_type: str
    
class TokenData(BaseModel):
    email:str | None =None
    
oauth2_scheme = OAuth2PasswordBearer(tokenUrl = "/auth/login")

def hash_password(password :str) -> str:
    hashed = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt())
    return hashed.decode("utf-8")

def verify_password(
    plain_password : str,
    hashed_password : str
)-> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )
    
def create_access_token(data : dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes = ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp":expire})
    encoded_jwt = jwt.encode(to_encode,SECRET_KEY, algorithm = ALGORITHM)
    return encoded_jwt

def verify_token(token :str = Depends(oauth2_scheme)) -> TokenData:
    credentials_exception = HTTPException(
        status_code = status.HTTP_401_UNAUTHORIZED,
        detail = "Could not find credentials",
        headers = {"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token,SECRET_KEY,algorithms=[ALGORITHM])
        email: str |None = payload.get("sub")
        if email is None:
            raise credentials_exception
        
        return TokenData(email=email)
    except JWTError:
        raise credentials_exception