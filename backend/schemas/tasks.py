from pydantic import BaseModel
from datetime import datetime
from typing import Optional,List
from enum import Enum

class TaskStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"

class TaskPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"

# --- SINGLE TASK RESPONSE SCHEMA ---
class TaskModel(BaseModel):
    id: int
    title: str
    description: Optional[str] = None  
    status: TaskStatus  
    priority: Optional[TaskPriority] = None  
    due_date: Optional[datetime] = None 
    created_at: datetime  
    updated_at: datetime  

    class Config:
        from_attributes = True  
        
        
# --- GET ALL TASKS RESPONSE CONTAINER ---  
class TaskListResponse(BaseModel):
    tasks:List[TaskModel]
    class config:
        from_attributes = True
    
# --- CREATE TASK REQUEST SCHEMA ---
class CreateTask(BaseModel):
    title: str
    description: Optional[str] = None  
    status: TaskStatus=TaskStatus.PENDING
    priority: Optional[TaskPriority] = None  
    due_date: Optional[datetime] = None 
    
# --- UPDATE TASK REQUEST SCHEMA ---
class UpdateTask(BaseModel):
    title: str | None = None
    description: str | None = None
    status: TaskStatus  | None = None
    priority: TaskPriority| None = None  
    due_date: datetime | None = None 