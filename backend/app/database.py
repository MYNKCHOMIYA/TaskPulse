from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker,DeclarativeBase
from dotenv import load_dotenv
import os

load_dotenv()


database_url = os.getenv("DATABASE_URL")
if database_url is None:
    raise ValueError("DATABASE_URL environment variable is missing from the .env file!")

engine = create_engine(database_url)

SessionLocal = sessionmaker(autoflush =False,bind = engine)

class Base(DeclarativeBase):
    pass
 
def get_db():
     db = SessionLocal()
     try:
         yield db
     finally:
         db.close()
     
     
    