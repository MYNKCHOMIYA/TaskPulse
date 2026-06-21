from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker,DeclarativeBase

engine = create_engine("postgresql+psycopg2://admin:admin@localhost:5432/taskpulse")

SessionLocal = sessionmaker(autoflush =False,bind = engine)

class Base(DeclarativeBase):
    pass
 
def get_db():
     db = SessionLocal()
     try:
         yield db
     finally:
         db.close()
     
     
    