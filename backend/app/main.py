from fastapi import FastAPI ,Depends
from routers import login,register,user
app = FastAPI()

@app.get("/")
def root():
    return{"this is the backend of the TaskPulse"}
    

app.include_router(register.router)
app.include_router(login.router)
app.include_router(user.router)