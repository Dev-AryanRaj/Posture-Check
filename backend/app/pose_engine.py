import json
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import cv2
import numpy as np
import mediapipe as mp

BASE_DIR = Path(__file__).resolve().parent
ANGLES_PATH = BASE_DIR / "angles.json"

with open(ANGLES_PATH, "r") as f:
    ANGLE_DATA = json.load(f)

POSE_LIST = list(ANGLE_DATA.keys())

mp_pose = mp.solutions.pose
POSE_LMS = mp_pose.PoseLandmark

JOINTS = {
    "left_knee": ("LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"),
    "right_knee": ("RIGHT_HIP", "RIGHT_KNEE", "RIGHT_ANKLE"),
    "left_elbow": ("LEFT_SHOULDER", "LEFT_ELBOW", "LEFT_WRIST"),
    "right_elbow": ("RIGHT_SHOULDER", "RIGHT_ELBOW", "RIGHT_WRIST"),
    "left_shoulder": ("LEFT_ELBOW", "LEFT_SHOULDER", "LEFT_HIP"),
    "right_shoulder": ("RIGHT_ELBOW", "RIGHT_SHOULDER", "RIGHT_HIP"),
    "left_hip": ("RIGHT_HIP", "LEFT_HIP", "LEFT_KNEE"),
    "right_hip": ("LEFT_HIP", "RIGHT_HIP", "RIGHT_KNEE"),
    "neck": ("LEFT_SHOULDER", "NOSE", "RIGHT_SHOULDER"),
    "spine": ("LEFT_HIP", "RIGHT_HIP", "NOSE"),
}


def calculate_angle(a, b, c) -> Optional[float]:
    a, b, c = np.array(a), np.array(b), np.array(c)
    v1, v2 = a - b, c - b
    denom = np.linalg.norm(v1) * np.linalg.norm(v2)
    if denom == 0:
        return None
    return float(np.degrees(np.arccos(np.clip(np.dot(v1, v2) / denom, -1, 1))))


def get_landmark_point(landmarks, name):
    lm = landmarks[POSE_LMS[name].value]
    return [lm.x, lm.y, lm.z]


def get_all_angles(landmarks) -> Dict[str, float]:
    angles: Dict[str, float] = {}
    for j, (p1, p2, p3) in JOINTS.items():
        try:
            a = get_landmark_point(landmarks, p1)
            b = get_landmark_point(landmarks, p2)
            c = get_landmark_point(landmarks, p3)
            ang = calculate_angle(a, b, c)
            if ang is not None:
                angles[j] = ang
        except Exception:
            pass
    return angles


def compare_pose(user_angles: Dict[str, float], pose_name: str) -> Tuple[float, List[str]]:
    data = ANGLE_DATA[pose_name]
    diffs = []
    hints = []
    for joint, val in user_angles.items():
        if joint not in data:
            continue
        mn = data[joint]["angle_min"]
        mx = data[joint]["angle_max"]
        if val < mn:
            diff = mn - val
            diffs.append(diff)
            hints.append(f"{joint.replace('_',' ').title()}: increase by {diff:.1f}")
        elif val > mx:
            diff = val - mx
            diffs.append(diff)
            hints.append(f"{joint.replace('_',' ').title()}: decrease by {diff:.1f}")
        else:
            diffs.append(0)
    score = float(np.mean(diffs)) if diffs else 999.0
    return score, hints


def auto_detect_pose(user_angles: Dict[str, float]) -> Tuple[str, float]:
    best_pose = None
    best_score = 999.0
    for pose in POSE_LIST:
        score, _ = compare_pose(user_angles, pose)
        if score < best_score:
            best_score = score
            best_pose = pose
    return best_pose, best_score


def analyze_image(
    image_bgr: np.ndarray,
    pose_name: Optional[str] = None,
) -> Tuple[str, float, List[str], Dict[str, float]]:
    """
    image_bgr: frame from browser (BGR)
    pose_name: if None -> auto-detect
    """
    with mp_pose.Pose(
        static_image_mode=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as pose_model:
        results = pose_model.process(cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB))

        if not results.pose_landmarks:
            raise ValueError("No pose detected")

        lm = results.pose_landmarks.landmark
        user_angles = get_all_angles(lm)

        if pose_name is None:
            pose_name, score = auto_detect_pose(user_angles)
        else:
            score, _ = compare_pose(user_angles, pose_name)

        _, hints = compare_pose(user_angles, pose_name)

        return pose_name, score, hints, user_angles
