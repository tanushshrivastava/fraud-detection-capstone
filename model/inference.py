"""SageMaker-compatible inference entry points for the fraud detection model."""

import joblib
import pandas as pd
import numpy as np
import json
import math
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

    # Additional stateless features (optimized for speed)
    # 1) Log amount (vectorized for speed)
    df["amt"] = pd.to_numeric(df.get("amt", 0), errors="coerce").fillna(0)
    amt_clipped = np.clip(df["amt"].values, 1e-6, None)
    df["log_amt"] = np.log(amt_clipped)
    # 2) High amount flag
    df["is_high_amount"] = (df["amt"] >= 1_000_000).astype(int)
    # 3) Cyclical hour encodings and night flag (vectorized)
    hour_numeric = pd.to_numeric(df["hour"], errors="coerce").fillna(0).values
    hour_rad = 2 * np.pi * hour_numeric / 24.0
    df["hour_sin"] = np.sin(hour_rad)
    df["hour_cos"] = np.cos(hour_rad)
    df["is_night"] = df["hour"].isin([0,1,2,3,4,5,6]).astype(int)
    # 4) Haversine distance between user and merchant (vectorized for speed)
    lat = pd.to_numeric(df.get("lat", 0), errors="coerce").fillna(0).values
    lon = pd.to_numeric(df.get("long", 0), errors="coerce").fillna(0).values
    mlat = pd.to_numeric(df.get("merch_lat", 0), errors="coerce").fillna(0).values
    mlon = pd.to_numeric(df.get("merch_long", 0), errors="coerce").fillna(0).values
    
    # Vectorized haversine calculation (much faster than loop)
    R = 6371.0
    lat1_rad = np.radians(lat)
    lat2_rad = np.radians(mlat)
    dlat_rad = np.radians(mlat - lat)
    dlon_rad = np.radians(mlon - lon)
    
    a = (np.sin(dlat_rad/2)**2 + 
         np.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(dlon_rad/2)**2)
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    df["distance_km"] = R * c

    return df

def predict_fn(input_data, model):
    """Run model inference on processed data"""
    processed = preprocess(input_data)
    preds = model.predict_proba(processed)[:, 1]
    return preds.tolist()

def output_fn(prediction, accept='application/json'):
    """Format output for SageMaker response"""
    return json.dumps({"fraud_probability": prediction[0]})
