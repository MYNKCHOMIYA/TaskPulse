from pydantic import BaseModel, EmailStr, ConfigDict


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
    model_config = ConfigDict(from_attributes=True)
    username: str
    email: EmailStr
    id: int


# --- USER UPDATE PAYLOAD ---
class UserUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    username: str | None = None
    email: EmailStr | None = None
    password: str | None = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
