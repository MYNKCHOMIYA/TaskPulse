from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, List
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
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    status: TaskStatus
    priority: Optional[TaskPriority] = None
    due_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


# --- TASK HISTORY EVENT LOG SCHEMA ---
class TaskEventLogModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: Optional[int] = None
    task_title: str
    event_type: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    details: Optional[str] = None
    timestamp: datetime

class TaskHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    logs: List[TaskEventLogModel]


# --- GET ALL TASKS RESPONSE CONTAINER ---
class TaskListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tasks: List[TaskModel]


# --- CREATE TASK REQUEST SCHEMA ---
class CreateTask(BaseModel):
    title: str = Field(
        min_length=3,
        max_length=100
    )
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    priority: Optional[TaskPriority] = None
    due_date: Optional[datetime] = None


# --- UPDATE TASK REQUEST SCHEMA ---
class UpdateTask(BaseModel):
    title: str | None = None
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None