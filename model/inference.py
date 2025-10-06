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
    """Recreate engineered features from training"""
    df = df.copy()

    # Convert timestamps and compute hour/dow
    if "trans_date_trans_time" in df.columns:
        df["trans_date_trans_time"] = pd.to_datetime(df["trans_date_trans_time"], errors="coerce")
        df["hour"] = df["trans_date_trans_time"].dt.hour.fillna(0)
        df["dow"] = df["trans_date_trans_time"].dt.dayofweek.fillna(0)
    else:
        df["hour"] = 0
        df["dow"] = 0

    # Compute age from dob
    if "dob" in df.columns:
        df["dob"] = pd.to_datetime(df["dob"], errors="coerce")
        df["age"] = ((datetime.now() - df["dob"]).dt.days / 365.25).fillna(0)
    else:
        df["age"] = 0

    return df

def predict_fn(input_data, model):
    """Run model inference on processed data"""
    processed = preprocess(input_data)
    preds = model.predict_proba(processed)[:, 1]
    return preds.tolist()

def output_fn(prediction, accept='application/json'):
    """Format output for SageMaker response"""
    return json.dumps({"fraud_probability": prediction[0]})
