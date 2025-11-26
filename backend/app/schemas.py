from typing import List, Dict, Optional
from pydantic import BaseModel

class PoseAnalysisRequest(BaseModel):
    pose_name: Optional[str] = None  # if None => auto-detect
    mode: str = "auto"               # "auto" or "manual"


class PoseAnalysisResponse(BaseModel):
    pose_name: str
    score: float
    hints: List[str]
    angles: Dict[str, float]


class PoseAttemptOut(BaseModel):
    id: int
    pose_name: str
    score: float
    success: bool
    hints: str

    class Config:
        from_attributes = True   # for SQLAlchemy -> Pydantic
