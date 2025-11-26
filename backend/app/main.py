from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import numpy as np
import cv2

from .database import Base, engine, get_db
from .models import PoseAttempt
from .schemas import PoseAnalysisRequest, PoseAnalysisResponse, PoseAttemptOut
from .pose_engine import analyze_image, POSE_LIST

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Yoga Pose API")

# CORS (for React dev server)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/poses", response_model=List[str])
def list_poses():
    return POSE_LIST


@app.post("/api/analyze", response_model=PoseAnalysisResponse)
async def analyze_pose(
    image: UploadFile = File(...),
    mode: str = Form("auto"),
    pose_name: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    contents = await image.read()
    np_arr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    try:
        effective_pose_name = pose_name if mode == "manual" and pose_name else None
        pose_name_actual, score, hints, angles = analyze_image(frame, effective_pose_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    attempt = PoseAttempt(
        pose_name=pose_name_actual,
        score=score,
        success=score < 10.0,
        hints=" | ".join(hints),
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return PoseAnalysisResponse(
        pose_name=pose_name_actual,
        score=score,
        hints=hints,
        angles=angles,
    )


@app.get("/api/history", response_model=List[PoseAttemptOut])
def history(db: Session = Depends(get_db)):
    attempts = (
        db.query(PoseAttempt)
        .order_by(PoseAttempt.created_at.desc())
        .limit(50)
        .all()
    )
    return attempts
