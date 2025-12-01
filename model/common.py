"""Shared feature-engineering helpers reused by the training and inference code."""

from __future__ import annotations

from datetime import datetime
from math import atan2, cos, radians, sin, sqrt
from typing import Dict, Iterable, List, Sequence

import numpy as np
import pandas as pd

# Buckets of feature names expected by the preprocessing pipeline.
CATEGORICAL: List[str] = ["merchant", "category", "gender", "state", "job"]
NUMERIC_BASE: List[str] = ["amt", "lat", "long", "city_pop", "merch_lat", "merch_long"]
NUMERIC_ENGINEERED: List[str] = [
    "distance_customer_merchant",
    "age",
    "hour",
    "dow",
    "is_weekend",
    "amt_avg_10",
    "amt_std_10",
    "amt_max_10",
    "amt_min_10",
    "time_since_last_txn",
    "txns_last_10min",
    "txns_last_1h",
    "txns_last_24h",
    "distance_last_txn_km",
    "speed_kmph",
    "impossible_travel_flag",
]
NUMERIC_FEATURES: List[str] = NUMERIC_BASE + NUMERIC_ENGINEERED
FEATURE_COLUMNS: List[str] = CATEGORICAL + NUMERIC_FEATURES


def haversine(lat1, lon1, lat2, lon2) -> float:
    """Compute great-circle distance in kilometers; return 0 for invalid inputs."""
    try:
        if pd.isna(lat1) or pd.isna(lon1) or pd.isna(lat2) or pd.isna(lon2):
            return 0.0
        d_lat = radians(lat2 - lat1)
        d_lon = radians(lon2 - lon1)
        a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return 6371 * c
    except Exception:
        return 0.0


def _safe_to_datetime(s: pd.Series) -> pd.Series:
    """Coerce arbitrary string columns to datetimes while swallowing invalid values."""
    return pd.to_datetime(s, errors="coerce")


def _fill_missing_columns(df: pd.DataFrame, columns: Sequence[str]) -> pd.DataFrame:
    for col in columns:
        if col not in df.columns:
            df[col] = np.nan
    return df


def _ensure_numeric(df: pd.DataFrame, columns: Iterable[str]) -> pd.DataFrame:
    for col in columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def _compute_time_distance_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["trans_dt"] = _safe_to_datetime(df.get("trans_date_trans_time"))
    df["dob_dt"] = _safe_to_datetime(df.get("dob"))

    df["age"] = ((df["trans_dt"] - df["dob_dt"]).dt.days / 365.25).astype(float)
    df["hour"] = df["trans_dt"].dt.hour.astype(float)
    df["dow"] = df["trans_dt"].dt.dayofweek.astype(float)
    df["is_weekend"] = (df["dow"] >= 5).astype(float)

    df["distance_customer_merchant"] = df.apply(
        lambda r: haversine(r.get("lat"), r.get("long"), r.get("merch_lat"), r.get("merch_long")),
        axis=1,
    )
    return df


def _compute_velocity_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compute rolling/velocity features using historical ordering by cc_num and timestamp."""
    if "cc_num" not in df.columns:
        # Without customer ids we cannot build history-aware features; fill zeros.
        for col in [
            "amt_avg_10",
            "amt_std_10",
            "amt_max_10",
            "amt_min_10",
            "time_since_last_txn",
            "txns_last_10min",
            "txns_last_1h",
            "txns_last_24h",
            "distance_last_txn_km",
            "speed_kmph",
            "impossible_travel_flag",
        ]:
            df[col] = 0.0
        return df

    df = df.sort_values(["cc_num", "trans_dt"]).copy()

    df["time_since_last_txn"] = (
        df.groupby("cc_num")["trans_dt"].diff().dt.total_seconds().fillna(0).astype(float)
    )

    # Distance/speed based on previous transaction
    df["prev_lat"] = df.groupby("cc_num")["lat"].shift(1)
    df["prev_long"] = df.groupby("cc_num")["long"].shift(1)
    df["distance_last_txn_km"] = df.apply(
        lambda r: haversine(r.get("lat"), r.get("long"), r.get("prev_lat"), r.get("prev_long")),
        axis=1,
    )
    df["speed_kmph"] = df.apply(
        lambda r: 0.0
        if r.get("time_since_last_txn", 0) in (0, np.nan)
        else r.get("distance_last_txn_km", 0) / (r.get("time_since_last_txn") / 3600.0),
        axis=1,
    )
    df["impossible_travel_flag"] = (df["speed_kmph"] > 900).astype(float)

    def _rolling_time_counts(group: pd.DataFrame) -> pd.DataFrame:
        # Use time-based rolling windows on a datetime index.
        g = group.set_index("trans_dt")
        g["txns_last_10min"] = g["amt"].rolling("10min").count() - 1
        g["txns_last_1h"] = g["amt"].rolling("1h").count() - 1
        g["txns_last_24h"] = g["amt"].rolling("24h").count() - 1
        return g.reset_index()

    df = df.groupby("cc_num", group_keys=False).apply(_rolling_time_counts)

    # Amount rolling statistics over the last 10 transactions.
    grouped = df.groupby("cc_num")
    df["amt_avg_10"] = grouped["amt"].rolling(window=10, min_periods=1).mean().reset_index(level=0, drop=True)
    df["amt_std_10"] = grouped["amt"].rolling(window=10, min_periods=1).std().reset_index(level=0, drop=True).fillna(0)
    df["amt_max_10"] = grouped["amt"].rolling(window=10, min_periods=1).max().reset_index(level=0, drop=True)
    df["amt_min_10"] = grouped["amt"].rolling(window=10, min_periods=1).min().reset_index(level=0, drop=True)

    # Clean up helper columns and NaNs.
    for col in ["txns_last_10min", "txns_last_1h", "txns_last_24h"]:
        df[col] = df[col].fillna(0).clip(lower=0)
    df.drop(columns=["prev_lat", "prev_long"], inplace=True)
    df.fillna(0, inplace=True)
    return df


def prepare_training_features(df: pd.DataFrame) -> pd.DataFrame:
    """Produce the ordered feature matrix consumed by the trained model for training."""
    X = df.copy()
    X = _fill_missing_columns(X, CATEGORICAL + NUMERIC_BASE + ["trans_date_trans_time", "dob", "cc_num"])
    X = _ensure_numeric(X, NUMERIC_BASE)
    X = _compute_time_distance_features(X)
    X = _compute_velocity_features(X)

    # Guarantee every expected column exists and is numeric where appropriate.
    X = _fill_missing_columns(X, FEATURE_COLUMNS)
    X = _ensure_numeric(X, NUMERIC_FEATURES)
    return X[FEATURE_COLUMNS]


def prepare_inference_features(transaction: Dict, history: List[Dict] | None = None) -> pd.DataFrame:
    """Build a single-row DataFrame with the same columns used during training."""
    history = history or []

    def _parse_ts(val):
        try:
            return pd.to_datetime(val)
        except Exception:
            return pd.NaT

    txn_time = _parse_ts(transaction.get("trans_date_trans_time"))
    dob = _parse_ts(transaction.get("dob"))
    age = ((txn_time - dob).days / 365.25) if (txn_time is not pd.NaT and dob is not pd.NaT) else 0.0
    hour = txn_time.hour if txn_time is not pd.NaT else 0
    dow = txn_time.dayofweek if txn_time is not pd.NaT else 0
    is_weekend = 1.0 if dow >= 5 else 0.0

    base_distance = haversine(
        transaction.get("lat"),
        transaction.get("long"),
        transaction.get("merch_lat"),
        transaction.get("merch_long"),
    )

    # Build velocity features from provided history (assumed newest first).
    hist_df = pd.DataFrame(history)
    amt_avg_10 = amt_std_10 = amt_max_10 = amt_min_10 = 0.0
    time_since_last_txn = txns_last_10min = txns_last_1h = txns_last_24h = 0.0
    distance_last_txn_km = speed_kmph = impossible_travel_flag = 0.0

    if not hist_df.empty:
        hist_df["trans_date_trans_time"] = pd.to_datetime(hist_df["trans_date_trans_time"], errors="coerce")
        hist_df = hist_df.dropna(subset=["trans_date_trans_time"])
        hist_df = hist_df.sort_values("trans_date_trans_time", ascending=False)
        recent = hist_df.head(10)
        amounts = pd.to_numeric(recent.get("amt", pd.Series(dtype=float)), errors="coerce")
        if not amounts.empty:
            amt_avg_10 = amounts.mean()
            amt_std_10 = amounts.std(ddof=0)
            amt_max_10 = amounts.max()
            amt_min_10 = amounts.min()

        if txn_time is not pd.NaT:
            deltas = (txn_time - recent["trans_date_trans_time"]).dt.total_seconds()
            time_since_last_txn = float(deltas.min()) if not deltas.empty else 0.0
            txns_last_10min = float((deltas <= 600).sum())
            txns_last_1h = float((deltas <= 3600).sum())
            txns_last_24h = float((deltas <= 86400).sum())

            last_row = recent.iloc[0]
            distance_last_txn_km = haversine(
                transaction.get("lat"),
                transaction.get("long"),
                last_row.get("lat"),
                last_row.get("long"),
            )
            if time_since_last_txn > 0:
                speed_kmph = distance_last_txn_km / (time_since_last_txn / 3600.0)
            impossible_travel_flag = 1.0 if speed_kmph > 900 else 0.0

    features = {
        "merchant": transaction.get("merchant", ""),
        "category": transaction.get("category", ""),
        "gender": transaction.get("gender", ""),
        "state": transaction.get("state", ""),
        "job": transaction.get("job", ""),
        "amt": transaction.get("amt", 0.0),
        "lat": transaction.get("lat", 0.0),
        "long": transaction.get("long", 0.0),
        "city_pop": transaction.get("city_pop", 0.0),
        "merch_lat": transaction.get("merch_lat", 0.0),
        "merch_long": transaction.get("merch_long", 0.0),
        "distance_customer_merchant": base_distance,
        "age": age,
        "hour": float(hour),
        "dow": float(dow),
        "is_weekend": float(is_weekend),
        "amt_avg_10": amt_avg_10,
        "amt_std_10": amt_std_10,
        "amt_max_10": amt_max_10,
        "amt_min_10": amt_min_10,
        "time_since_last_txn": time_since_last_txn,
        "txns_last_10min": txns_last_10min,
        "txns_last_1h": txns_last_1h,
        "txns_last_24h": txns_last_24h,
        "distance_last_txn_km": distance_last_txn_km,
        "speed_kmph": speed_kmph,
        "impossible_travel_flag": impossible_travel_flag,
    }

    X = pd.DataFrame([features])
    X = _fill_missing_columns(X, FEATURE_COLUMNS)
    X = _ensure_numeric(X, NUMERIC_FEATURES)
    return X[FEATURE_COLUMNS]
