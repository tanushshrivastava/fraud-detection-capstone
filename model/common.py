"""Shared feature-engineering helpers reused by the training and inference code."""

# Use the compact import style from the original module to avoid changing behavior.
import pandas as pd, numpy as np  # noqa: E401

# Buckets of feature names expected by the preprocessing pipeline.
CATEGORICAL = ["merchant","category","gender","state","job"]
NUMERIC_BASE = ["amt","lat","long","city_pop","merch_lat","merch_long"]
ENGINEERED = ["age","hour","dow"]


def _safe_to_datetime(s):
    """Coerce arbitrary string columns to datetimes while swallowing invalid values."""
    return pd.to_datetime(s, errors="coerce")


def feature_engineering(df: pd.DataFrame) -> pd.DataFrame:
    """Produce the ordered feature matrix consumed by the trained model."""
    X = df.copy()
    X["trans_dt"] = _safe_to_datetime(X.get("trans_date_trans_time"))
    X["dob_dt"]   = _safe_to_datetime(X.get("dob"))
    X["age"]  = ((X["trans_dt"] - X["dob_dt"]).dt.days / 365.25).astype("float32")
    X["hour"] = X["trans_dt"].dt.hour.astype("float32")
    X["dow"]  = X["trans_dt"].dt.dayofweek.astype("float32")

    # Guarantee every expected column is present so downstream code can safely index.
    for col in CATEGORICAL + NUMERIC_BASE + ["age","hour","dow"]:
        if col not in X.columns:
            X[col] = np.nan
    # Force numeric columns to numeric dtype so scikit-learn can scale them consistently.
    for col in NUMERIC_BASE + ["age","hour","dow"]:
        X[col] = pd.to_numeric(X[col], errors="coerce")

    return X[CATEGORICAL + NUMERIC_BASE + ["age","hour","dow"]]
