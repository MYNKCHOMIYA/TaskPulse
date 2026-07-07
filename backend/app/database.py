from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv
import os

load_dotenv()


database_url = os.getenv("DATABASE_URL")
if database_url is None:
    raise ValueError("DATABASE_URL environment variable is missing from the .env file!")

# Convert postgres:// to postgresql:// for SQLAlchemy dialect compatibility
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(database_url)

SessionLocal = sessionmaker(autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
