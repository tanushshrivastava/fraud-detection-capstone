"""SageMaker-compatible inference entry points for the simplified fraud model."""

from pathlib import Path
import json
from typing import Any, Dict, List

import joblib
import pandas as pd

from common import FEATURE_COLUMNS, prepare_inference_features


def model_fn(model_dir):
    """Load model from SageMaker directory."""
    path = Path(model_dir) / "model.joblib"
    if not path.exists():
        raise FileNotFoundError(f"Expected model.joblib in {model_dir}")
    return joblib.load(path)


def _build_frame_from_payload(payload: Dict[str, Any]) -> pd.DataFrame:
    if "transaction" in payload:
        txn = payload.get("transaction", {}) or {}
        history = payload.get("history", []) or []
    else:
        txn = payload
        if isinstance(payload, dict):
            history = payload.get("history", []) if isinstance(payload.get("history"), list) else []
        else:
            history = []
    return prepare_inference_features(txn, history)


def input_fn(request_body, content_type="application/json"):
    """Parse input JSON and build the feature frame expected by the model."""
    if content_type != "application/json":
        raise ValueError(f"Unsupported content type: {content_type}")

    data = json.loads(request_body)

    if isinstance(data, list):
        frames = [_build_frame_from_payload(item) for item in data]
        return pd.concat(frames, ignore_index=True)[FEATURE_COLUMNS]

    if isinstance(data, dict):
        return _build_frame_from_payload(data)[FEATURE_COLUMNS]

    raise ValueError("Payload must be a dict or list of dicts")


def predict_fn(input_data: pd.DataFrame, model):
    """Run model inference on processed data."""
    preds = model.predict_proba(input_data)[:, 1]
    return preds.tolist()


def output_fn(prediction, accept="application/json"):
    """Format output for SageMaker response."""
    if isinstance(prediction, list) and prediction:
        score = float(prediction[0])
    else:
        score = float(prediction)
    return json.dumps({"fraud_probability": score})
