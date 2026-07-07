from fastapi import APIRouter, Depends, HTTPException, status
from app.database import get_db
from sqlalchemy.orm import Session
from models.user import Task, User, Priority, Status
from sqlalchemy import select, func, case
from core.security import TokenData, verify_token

router = APIRouter(prefix="/Analytics", tags=["Analytics"])


# ----------------------------- METRICS AGGREGATION ------------------------------------
@router.get("/count", status_code=status.HTTP_200_OK)
def analytics(
    db: Session = Depends(get_db), token_data: TokenData = Depends(verify_token)
):

    user_id = db.scalar(select(User.id).where(User.email == token_data.email))
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="there are user or task  not found",
        )

    analytical_query = select(
        func.count(Task.id).label("Total"),
        func.sum(case((Task.priority == Priority.URGENT, 1), else_=0)).label("URGENT"),
        func.sum(case((Task.priority == Priority.MEDIUM, 1), else_=0)).label("MEDIUM"),
        func.sum(case((Task.priority == Priority.HIGH, 1), else_=0)).label("HIGH"),
        func.sum(case((Task.priority == Priority.LOW, 1), else_=0)).label("LOW"),
        func.sum(case((Task.status == Status.PENDING, 1), else_=0)).label("PENDING"),
        func.sum(case((Task.status == Status.COMPLETED, 1), else_=0)).label(
            "COMPLETED"
        ),
        func.sum(case((Task.status == Status.IN_PROGRESS, 1), else_=0)).label(
            "IN_PROGRESS"
        ),
    ).where(Task.user_id == user_id)

    result = db.execute(analytical_query).one()

    return {
        "total_tasks": result.Total,
        "by_priority": {
            "urgent": int(result.URGENT or 0),
            "high": int(result.HIGH or 0),
            "medium": int(result.MEDIUM or 0),
            "low": int(result.LOW or 0),
        },
        "by_status": {
            "PENDING": int(result.PENDING or 0),
            "COMPLETED": int(result.COMPLETED or 0),
            "IN_PROGRESS": int(result.IN_PROGRESS or 0),
        },
    }
