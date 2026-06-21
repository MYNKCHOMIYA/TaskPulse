from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import engine
from models.user import User,Task,Status,Priority
from datetime import datetime


# Open a transactional session with the database engine
with Session(engine) as session:
     user = session.scalar(select(User).where(User.username =="Mayank"))
     if user:
          first_task = Task(
               title  = "homework",
               status = Status.PENDING,
               priority = Priority.URGENT,
               due_date = datetime.strptime("25/03/2026","%d/%m/%Y"),

          )

          second_task = Task(
               title  = "workout",
               status = Status.COMPLETED,
               description = "must be done",
               priority = Priority.HIGH,

          )

          third_task = Task(
               title  = "coding",
               status = Status.IN_PROGRESS,

          )

          user.tasks.extend([first_task, second_task ,third_task])
          session.commit()
     