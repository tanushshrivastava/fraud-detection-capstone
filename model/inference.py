"""SageMaker-compatible inference entry points for the fraud detection model."""

import joblib
import pandas as pd
import json
from datetime import datetime

def model_fn(model_dir):
    """Load model from SageMaker directory"""
    return joblib.load(f"{model_dir}/model.joblib")

def input_fn(request_body, content_type='application/json'):
    """Parse input JSON to DataFrame (SageMaker passes 2 args)"""
    data = json.loads(request_body)
    if isinstance(data, dict):
        data = [data]
    return pd.DataFrame(data)

def preprocess(df):
    """Recreate engineered features from training (stateless, robust defaults)."""
    df = df.copy()

    # Convert timestamps and compute hour/dow
    if "trans_date_trans_time" in df.columns:
        df["trans_date_trans_time"] = pd.to_datetime(df["trans_date_trans_time"], errors="coerce")
        df["hour"] = df["trans_date_trans_time"].dt.hour.fillna(0)
        df["dow"] = df["trans_date_trans_time"].dt.dayofweek.fillna(0)
    else:
        df["hour"] = 0
        df["dow"] = 0

    # Compute age at transaction time (to match training)
    if "dob" in df.columns:
        df["dob"] = pd.to_datetime(df["dob"], errors="coerce")
        if "trans_date_trans_time" in df.columns:
            df["age"] = ((df["trans_date_trans_time"] - df["dob"]).dt.days / 365.25).clip(lower=0).fillna(0)
        else:
            df["age"] = ((datetime.now() - df["dob"]).dt.days / 365.25).clip(lower=0).fillna(0)
    else:
        df["age"] = 0

    # Additional stateless features
    # 1) Log amount
    df["amt"] = pd.to_numeric(df.get("amt", 0), errors="coerce").fillna(0)
    df["log_amt"] = (df["amt"].clip(lower=1e-6)).apply(lambda x: float(__import__("math").log(x)))
    # 2) High amount flag
    df["is_high_amount"] = (df["amt"] >= 1_000_000).astype(int)
    # 3) Cyclical hour encodings and night flag
    import numpy as _np
    df["hour_sin"] = _np.sin(2 * _np.pi * pd.to_numeric(df["hour"], errors="coerce").fillna(0) / 24.0)
    df["hour_cos"] = _np.cos(2 * _np.pi * pd.to_numeric(df["hour"], errors="coerce").fillna(0) / 24.0)
    df["is_night"] = df["hour"].isin([0,1,2,3,4,5,6]).astype(int)
    # 4) Haversine distance between user and merchant
    def _haversine_km(lat1, lon1, lat2, lon2):
        import math
        if any(pd.isna(v) for v in (lat1, lon1, lat2, lon2)):
            return 0.0
        R = 6371.0
        phi1 = math.radians(float(lat1))
        phi2 = math.radians(float(lat2))
        dphi = math.radians(float(lat2) - float(lat1))
        dlambda = math.radians(float(lon2) - float(lon1))
        a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return float(R * c)
    lat = pd.to_numeric(df.get("lat", 0), errors="coerce")
    lon = pd.to_numeric(df.get("long", 0), errors="coerce")
    mlat = pd.to_numeric(df.get("merch_lat", 0), errors="coerce")
    mlon = pd.to_numeric(df.get("merch_long", 0), errors="coerce")
    df["distance_km"] = [
        _haversine_km(la, lo, mla, mlo)
        for la, lo, mla, mlo in zip(lat.fillna(0), lon.fillna(0), mlat.fillna(0), mlon.fillna(0))
    ]

    return df

def predict_fn(input_data, model):
    """Run model inference on processed data"""
    processed = preprocess(input_data)
    preds = model.predict_proba(processed)[:, 1]
    return preds.tolist()

def output_fn(prediction, accept='application/json'):
    """Format output for SageMaker response"""
    return json.dumps({"fraud_probability": prediction[0]})
