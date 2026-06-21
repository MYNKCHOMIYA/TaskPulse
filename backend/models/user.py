import enum
from typing import Optional
from sqlalchemy import String,Enum,func,DateTime,ForeignKey 
from sqlalchemy.orm import Mapped,mapped_column,Session,relationship
from datetime import datetime
from app.database import Base , engine

class Status(enum.Enum):
    
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    
    
    
class Priority(enum.Enum):
    URGENT = "URGENT"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    
    
    
class User(Base):
    __tablename__ = "users"
    id:Mapped[int] = mapped_column(primary_key= True)
    username: Mapped[str] = mapped_column(String(30),nullable=False)
    email: Mapped[str] = mapped_column(String(255),unique=True,nullable=False)
    password_hash: Mapped[str]=mapped_column(String(255),nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),server_default=func.now())
    tasks: Mapped[list["Task"]] =relationship(back_populates="user",cascade="all, delete-orphan")
    
class Task(Base):
    __tablename__ = "task"
    id:Mapped[int] =mapped_column(primary_key=True)
    title:Mapped[str] =mapped_column(String(100),nullable=False)
    description:Mapped[Optional[str]] =mapped_column(String(255))
    status: Mapped[Status] = mapped_column(Enum(Status,name = "status_enum"),nullable=False)
    priority: Mapped[Optional[Priority]] = mapped_column(Enum(Priority,name= "priority_enum"))
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone =True))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"),nullable = False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),server_default=func.now(),onupdate=func.now())
    
    user: Mapped["User"] = relationship(back_populates ="tasks" )
    
Base.metadata.create_all(engine)

with Session(engine) as session:
    pass
