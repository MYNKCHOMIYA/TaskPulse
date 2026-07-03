from fastapi import Depends, APIRouter, HTTPException, status as fastapi_status
from app.database import get_db
from sqlalchemy import select, case
from sqlalchemy.orm import Session
from core.security import TokenData, verify_token
from models.user import Task, User, Priority, Status # MATCHED: Imports your true database model Enums
from schemas.tasks import TaskListResponse, CreateTask, TaskModel, UpdateTask, TaskPriority, TaskStatus

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
    
    update_task = task.model_dump(exclude_unset=True)
    
    for key,value in update_task.items():
        setattr(db_task,key,value)
    
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
    
    db.delete(db_task)
    db.commit()
    return{"messsage":f"task {task_id} '{task_title}' is deleted succesfully"}


