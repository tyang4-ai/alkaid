"""Training routes — serve RL training metrics."""

import os
import json
from pathlib import Path

from fastapi import APIRouter

router = APIRouter(tags=["training"])

# Path to training metrics (written by training callbacks)
METRICS_DIR = Path(os.getenv("METRICS_DIR", str(Path(__file__).parent.parent.parent / "ai-training" / "logs")))


@router.get("/training/metrics")
async def get_training_metrics():
    """Return training progress data for the dashboard."""
    metrics_file = METRICS_DIR / "training_metrics.json"

    if metrics_file.exists():
        data = json.loads(metrics_file.read_text())
        return data

    # Return sample data for development/demo
    import math
    sample_history = []
    for ep in range(0, 500, 5):
        t = ep / 500
        sample_history.append({
            "episode": ep,
            "reward": -2 + 8 * t + 1.5 * math.sin(ep * 0.1) * (1 - t),
            "winrate": min(0.85, 0.15 + 0.7 * t + 0.05 * math.sin(ep * 0.08)),
            "stage": min(5, int(t * 6)),
        })
    return {
        "episode": 500,
        "reward_mean": 5.8,
        "reward_std": 1.2,
        "winrate": 0.72,
        "curriculum_stage": 4,
        "loss_policy": 0.045,
        "loss_value": 0.12,
        "entropy": 1.35,
        "history": sample_history,
    }


@router.get("/training/status")
async def get_training_status():
    """Return current training status."""
    status_file = METRICS_DIR / "training_status.json"

    if status_file.exists():
        data = json.loads(status_file.read_text())
        return data

    return {
        "running": False,
        "current_episode": 500,
        "total_episodes": 2000,
        "gpu_hours": 3.2,
        "eta_hours": 0.0,
        "stage_name": "Stage 4 — Balanced",
    }
