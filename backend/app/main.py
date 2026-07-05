import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from app.database import Base, engine
# FIX 1: Import your models explicitly so Base.metadata knows your table schemas exist!
from models.user import User, Task, TokenBlocklist 
from routers import auth, tasks, analytics, user

# 1. LIFESPAN RETRY CONNECTION LOOP
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Production Guard: Retries database connections on startup.
    Prevents container crashes during multi-container network boot sequences.
    """
    print("INFO: Connecting to the PostgreSQL target engine pool...", flush=True)
    retries = 5
    while retries > 0:
        try:
            # Touch the database connection pool safely
            with engine.connect() as connection:
                print("SUCCESS: Database network pipeline connection verified!", flush=True)
                
            # Build database tables dynamically if they don't exist yet
            Base.metadata.create_all(bind=engine)
            print("SUCCESS: Database table schemas initialized flawlessly.", flush=True)
            break
        except OperationalError:
            retries -= 1
            print(f"WARN: Database not ready yet. Retrying in 3 seconds... ({retries} attempts left)", flush=True)
            time.sleep(3)
            
    if retries == 0:
        print("CRITICAL: Could not establish a connection to the database. Starting without schema validation.", flush=True)
        
    yield
    print("INFO: Shutting down application web server process...", flush=True)


# 2. APPLICATION INITIALIZATION
app = FastAPI(title="TaskPulse API", version="1.0.0", lifespan=lifespan)

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "https://task-pulse-blue.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex="https://.*\\.vercel\\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. INCLUDE THE ROUTERS (FIX 2: Cleared duplicate entries and grouped them cleanly)
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(user.router)
app.include_router(analytics.router)

# 5. ROOT ENDPOINT (FIX 3: Consolidated duplicates into a single comprehensive response)
@app.get("/")
def read_root():
    return {
        "status": "online", 
        "message": "Welcome to the TaskPulse API cluster backend service"
    }
