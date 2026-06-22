from pydantic import BaseModel, EmailStr

# --- USER REGISTRATION ---
class UserCreate(BaseModel):
    username: str
    email: EmailStr  
    password: str 
    
# --- USER LOGIN --- 
class UserLogin(BaseModel):
    email: EmailStr
    password: str

# --- USER RESPONSE DATA (SAFE FOR CLIENTS) ---
class UserModel(BaseModel):
    username:str
    email:EmailStr
    id:int
    
    class Config:
        from_attributes = True
    

# --- USER UPDATE PAYLOAD ---
class UserUpdate(BaseModel):
    username:str | None = None
    email:EmailStr | None = None
    password:str | None = None
    
    class Config:
        from_attributes = True
    

    
    
