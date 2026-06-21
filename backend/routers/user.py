from fastapi import APIRouter,Depends
from core.security import verify_token,TokenData
router = APIRouter()

@router.get("/me")
def user(token_data: TokenData = Depends(verify_token)):
    return {
        "email" : token_data.email
    }
    
    
    
