from fastapi import Depends, APIRouter, HTTPException, status as fastapi_status
from app.database import get_db
from sqlalchemy import select, case
from sqlalchemy.orm import Session
from core.security import TokenData, verify_token
from models.user import Task, User, Priority, Status, TaskEventLog
from schemas.tasks import TaskListResponse, CreateTask, TaskModel, UpdateTask, TaskPriority, TaskStatus, TaskHistoryResponse
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/tasks", tags=["Tasks"])

#------------------------GET TASKS-----------------------------------------
@router.get("/", response_model=TaskListResponse)
def get_tasks(
    search: str | None = None,
    task_status: TaskStatus | None = None,
    priority: TaskPriority | None = None,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    token_data: TokenData = Depends(verify_token)
):
    user_id = db.scalar(select(User.id).where(User.email == token_data.email))
    if not user_id:
        
        raise HTTPException(
            status_code=fastapi_status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )  
    
    query = select(Task).where(Task.user_id == user_id)
    
    if search:
        query = query.where(Task.title.ilike(f"%{search}%"))
        
    if task_status:
        
        query = query.where(Task.status == Status[task_status.name])
    
    if priority:
        
        query = query.where(Task.priority == Priority[priority.name])
        
   
    priority_order = case(
        (Task.priority == Priority.URGENT, 1),
        (Task.priority == Priority.HIGH, 2),
        (Task.priority == Priority.MEDIUM, 3),
        (Task.priority == Priority.LOW, 4),
        else_=5
    )
    query = query.order_by(priority_order.asc(), Task.updated_at.desc())
    
   
    query = query.offset(skip).limit(limit)
    
  
    tasks = db.scalars(query).all()
    
    return {"tasks": tasks}


#-----------------------------GET HISTORY-------------------------------------
@router.get("/history", response_model=TaskHistoryResponse)
def get_task_history(
    db: Session = Depends(get_db),
    token_data: TokenData = Depends(verify_token)
):
    user_id = db.scalar(select(User.id).where(User.email == token_data.email))
    if not user_id:
        raise HTTPException(
            status_code=fastapi_status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
    
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    
    query = (
        select(TaskEventLog)
        .where(TaskEventLog.user_id == user_id, TaskEventLog.timestamp >= seven_days_ago)
        .order_by(TaskEventLog.timestamp.desc())
    )
    logs = db.scalars(query).all()
    return {"logs": logs}


#-----------------------------CREATE TASKS------------------------------------
@router.post("/create",status_code=fastapi_status.HTTP_201_CREATED,response_model= TaskModel)
def create_tasks(
    task_data:CreateTask,
    db: Session = Depends(get_db),
    token_data: TokenData = Depends(verify_token)
):
    user_id = db.scalar(select(User.id).where(User.email == token_data.email))
    
    
    if not user_id:
        raise HTTPException(
            status_code=fastapi_status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
    task_dict = task_data.model_dump(exclude_unset = True)
    
    task_dict["user_id"] = user_id
    new_tasks = Task(**task_dict)
    db.add(new_tasks)
    db.commit()
    db.refresh(new_tasks)
    
    log = TaskEventLog(
        task_id=new_tasks.id,
        task_title=new_tasks.title,
        user_id=user_id,
        event_type="CREATE",
    )
    db.add(log)
    db.commit()
    
    return new_tasks
    
#-----------------------------UPDATE TASKS------------------------------------
@router.patch("/update/{id}",response_model=TaskModel)
def update_task(id:int,task : UpdateTask,db : Session = Depends(get_db),token_data: TokenData = Depends(verify_token)):

    query = (
        select(Task)
        .join(User)
        .where(Task.id == id,User.email == token_data.email))
    
    db_task =db.scalar(query)
    
    if not db_task:
        raise HTTPException(
            status_code=fastapi_status.HTTP_404_NOT_FOUND,
            detail="Task not found or unauthorized"
        )
    
    update_task_data = task.model_dump(exclude_unset=True)
    
    user_id = db_task.user_id
    title = db_task.title
    
    for key, value in update_task_data.items():
        if key == "status":
            old_status = db_task.status.name if hasattr(db_task.status, 'name') else db_task.status
            new_status = value.name if hasattr(value, 'name') else value
            if old_status != new_status:
                log = TaskEventLog(task_id=id, task_title=title, user_id=user_id, event_type="STATUS_CHANGE", old_value=str(old_status), new_value=str(new_status))
                
                # Check for completion to calc duration
                if new_status == "COMPLETED" and db_task.started_at:
                    now_utc = datetime.now(timezone.utc)
                    completed_time = update_task_data.get('completed_at', now_utc)
                    # Ensure both datetimes are timezone-aware for safe subtraction
                    if completed_time is not None:
                        if hasattr(completed_time, 'tzinfo') and completed_time.tzinfo is None:
                            completed_time = completed_time.replace(tzinfo=timezone.utc)
                        started = db_task.started_at
                        if hasattr(started, 'tzinfo') and started.tzinfo is None:
                            started = started.replace(tzinfo=timezone.utc)
                        duration_sec = (completed_time - started).total_seconds()
                        if duration_sec > 0:
                            m, s = divmod(int(duration_sec), 60)
                            h, m = divmod(m, 60)
                            dur_str = f"{h}h {m}m {s}s" if h > 0 else (f"{m}m {s}s" if m > 0 else f"{s}s")
                            log.details = f"Total time taken: {dur_str}"

                
                db.add(log)
        elif key == "priority":
            old_pri = db_task.priority.name if db_task.priority and hasattr(db_task.priority, 'name') else str(db_task.priority)
            new_pri = value.name if value and hasattr(value, 'name') else str(value)
            if old_pri != new_pri:
                db.add(TaskEventLog(task_id=id, task_title=title, user_id=user_id, event_type="PRIORITY_CHANGE", old_value=old_pri, new_value=new_pri))
                
        setattr(db_task, key, value)
    
    db.commit()
    db.refresh(db_task)
    return db_task

#----------------------------- GET BY ID------------------------------------
@router.get("/{id}",response_model=TaskModel)
def get_task(
    id:int,
    db: Session = Depends(get_db),
    token_data: TokenData = Depends(verify_token)
):
    query=(select(Task)
           .join(User)
           .where(Task.id == id,User.email == token_data.email ))
    db_task = db.scalar(query)
    if not db_task:
        raise HTTPException(
            status_code=fastapi_status.HTTP_404_NOT_FOUND, 
            detail="TASK not found"
        )
    
  
    return db_task

#----------------------------- DELETE THE TASK BY THE ID------------------------------------
@router.delete("/delete/{id}",status_code=fastapi_status.HTTP_204_NO_CONTENT)
def delete_task(id:int,db:Session = Depends(get_db),token_data: TokenData = Depends(verify_token)):
    
    query=(select(Task)
        .join(User)
        .where(Task.id == id,User.email == token_data.email ))
    
    db_task = db.scalar(query)
    
    if not db_task:
        raise HTTPException(
            status_code=fastapi_status.HTTP_404_NOT_FOUND, 
            detail="Task not found"
        )
        
    task_title = db_task.title
    task_id = db_task.id
    user_id = db_task.user_id
    
    log = TaskEventLog(task_id=task_id, task_title=task_title, user_id=user_id, event_type="DELETE")
    db.add(log)
    
    db.delete(db_task)
    db.commit()
    return{"messsage":f"task {task_id} '{task_title}' is deleted succesfully"}


