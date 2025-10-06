# common.py
import pandas as pd, numpy as np

CATEGORICAL = ["merchant","category","gender","state","job"]
NUMERIC_BASE = ["amt","lat","long","city_pop","merch_lat","merch_long"]
ENGINEERED = ["age","hour","dow"]

def _safe_to_datetime(s):
    return pd.to_datetime(s, errors="coerce")

def feature_engineering(df: pd.DataFrame) -> pd.DataFrame:
    X = df.copy()
    X["trans_dt"] = _safe_to_datetime(X.get("trans_date_trans_time"))
    X["dob_dt"]   = _safe_to_datetime(X.get("dob"))
    X["age"]  = ((X["trans_dt"] - X["dob_dt"]).dt.days / 365.25).astype("float32")
    X["hour"] = X["trans_dt"].dt.hour.astype("float32")
    X["dow"]  = X["trans_dt"].dt.dayofweek.astype("float32")

    for col in CATEGORICAL + NUMERIC_BASE + ["age","hour","dow"]:
        if col not in X.columns:
            X[col] = np.nan
    for col in NUMERIC_BASE + ["age","hour","dow"]:
        X[col] = pd.to_numeric(X[col], errors="coerce")

    return X[CATEGORICAL + NUMERIC_BASE + ["age","hour","dow"]]
