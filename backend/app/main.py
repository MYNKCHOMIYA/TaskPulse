from fastapi import FastAPI ,Depends
from routers import auth,tasks,user
app = FastAPI(title =" My auth api")

app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(user.router)


@app.get("/")
def root():
    return{"this is the backend of the TaskPulse"}