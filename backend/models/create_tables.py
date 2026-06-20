from user import User
from database import Base
from sqlalchemy import create_engine


engine = create_engine("postgresql+psycopg2://admin:admin@localhost:5432/taskpulse")


if __name__== "__main__":
    Base.metadata.create_all(engine)