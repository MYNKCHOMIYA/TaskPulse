from fastapi import Depends, APIRouter, HTTPException, status
from app.database import get_db
from sqlalchemy import select
from sqlalchemy.orm import Session
from core.security import TokenData, verify_token
from models.user import Task, User
from schemas.tasks import TaskListResponse,CreateTask,TaskModel,UpdateTask



router = APIRouter(prefix="/tasks",tags=["Tasks"])
#------------------------GET TASKS-----------------------------------------
@router.get("",response_model=TaskListResponse)
def get_tasks(
    db: Session = Depends(get_db),
    token_data: TokenData = Depends(verify_token)
):
    user_id = db.scalar(select(User.id).where(User.email == token_data.email))
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="there are user or task  not found"
        )
    
    tasks = db.scalars(select(Task).where(Task.user_id == user_id)).all()
    
  
    return {"tasks": tasks}

#-----------------------------CREATE TASKS------------------------------------
@router.post("/create",status_code=status.HTTP_201_CREATED,response_model= TaskModel)
def create_tasks(
    task_data:CreateTask,
    db: Session = Depends(get_db),
    token_data: TokenData = Depends(verify_token)
):
    user_id = db.scalar(select(User.id).where(User.email == token_data.email))
    
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
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
@router.put("/update/{id}")
def update_task(id:int,task : UpdateTask,db : Session = Depends(get_db),token_data: TokenData = Depends(verify_token)):

    query = (
        select(Task)
        .join(User)
        .where(Task.id == id,User.email == token_data.email))
    
    db_task =db.scalar(query)
    
    if not db_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
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
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="TASK not found"
        )
    
  
    return db_task

#----------------------------- DELETE THE TASK BY THE ID------------------------------------
@router.delete("/delete/{id}")
def delete_task(id:int,db:Session = Depends(get_db),token_data: TokenData = Depends(verify_token)):
    
    query=(select(Task)
        .join(User)
        .where(Task.id == id,User.email == token_data.email ))
    
    db_task = db.scalar(query)
    
    if not db_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Task not found"
        )
        
    task_title = db_task.title
    task_id = db_task.id
    
    db.delete(db_task)
    db.commit()
    return{f"task {task_id} '{task_title}' is deleted succesfully"}
    
    
