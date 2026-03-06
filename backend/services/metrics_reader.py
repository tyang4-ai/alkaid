"""Training metrics reader.

Reads TensorBoard event files or summary JSON from training runs.
"""

import json
from pathlib import Path
from typing import Optional


def read_training_metrics(metrics_dir: Path) -> Optional[dict]:
    """Read training metrics from the metrics directory."""
    metrics_file = metrics_dir / "training_metrics.json"
    if not metrics_file.exists():
        return None
    return json.loads(metrics_file.read_text())


def read_training_status(metrics_dir: Path) -> Optional[dict]:
    """Read current training status."""
    status_file = metrics_dir / "training_status.json"
    if not status_file.exists():
        return None
    return json.loads(status_file.read_text())
