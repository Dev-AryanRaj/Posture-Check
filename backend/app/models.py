from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.sql import func
from .database import Base

class PoseAttempt(Base):
    __tablename__ = "pose_attempts"

    id = Column(Integer, primary_key=True, index=True)
    pose_name = Column(String, index=True)
    score = Column(Float)
    success = Column(Boolean, default=False)
    hints = Column(String)   # could store as text / JSON
    created_at = Column(DateTime(timezone=True), server_default=func.now())
