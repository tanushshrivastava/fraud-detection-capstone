"""Shared feature-engineering helpers reused by the training and inference code."""

from __future__ import annotations

from math import atan2, cos, radians, sin, sqrt
from typing import Dict, List

import numpy as np
import pandas as pd

# Feature definitions for the simplified model.
# State offered little signal in the synthetic set; drop it to reduce noise.
CATEGORICAL: List[str] = ["category"]
NUMERIC_FEATURES: List[str] = ["amount", "distance_km", "merchant_risk", "is_night", "hour"]
FEATURE_COLUMNS: List[str] = NUMERIC_FEATURES + CATEGORICAL

KNOWN_MERCHANTS = [
    "Starbucks",
    "Dunkin",
    "Peets Coffee",
    "Tim Hortons",
    "McDonalds",
    "Chipotle",
    "Subway",
    "Taco Bell",
    "KFC",
    "Panera Bread",
    "Chick-fil-A",
    "Five Guys",
    "Burger King",
    "Kroger",
    "Whole Foods",
    "Trader Joes",
    "Safeway",
    "Publix",
    "Aldi",
    "Lidl",
    "Costco",
    "Sam's Club",
    "Walmart",
    "Target",
    "IKEA",
    "Home Depot",
    "Lowes",
    "Best Buy",
    "Macy's",
    "Nordstrom",
    "TJ Maxx",
    "Marshalls",
    "Bed Bath & Beyond",
    "HomeGoods",
    "H&M",
    "Zara",
    "Uniqlo",
    "Gap",
    "Old Navy",
    "Banana Republic",
    "Nike",
    "Adidas",
    "Foot Locker",
    "Shell",
    "Chevron",
    "BP",
    "Exxon",
    "Mobil",
    "CVS Pharmacy",
    "Walgreens",
    "Rite Aid",
    "Amazon",
    "Apple Store",
    "Microsoft Store",
    "eBay",
    "Etsy",
    "Uber",
    "Lyft",
    "Delta Airlines",
    "United Airlines",
    "Southwest Airlines",
    "Hilton Hotel",
    "Marriott Hotel",
    "Airbnb",
    "Planet Fitness",
    "LA Fitness",
    "Anytime Fitness",
]
SAFE_KEYWORDS = [
    "coffee",
    "cafe",
    "store",
    "market",
    "mart",
    "grill",
    "hotel",
    "pharmacy",
    "gas",
    "fuel",
    "fitness",
    "burger",
    "pizza",
]
KNOWN_MERCHANTS_LOWER = {m.lower() for m in KNOWN_MERCHANTS}


def haversine(lat1, lon1, lat2, lon2) -> float:
    """Compute great-circle distance in kilometers; return 0 for invalid inputs."""
    try:
        if any(pd.isna(v) for v in (lat1, lon1, lat2, lon2)):
            return 0.0
        d_lat = radians(lat2 - lat1)
        d_lon = radians(lon2 - lon1)
        a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return 6371 * c
    except Exception:
        return 0.0


def compute_merchant_risk(name: str) -> int:
    """
    Rough heuristic mirroring the data generator:
    0 = known/safe merchant, 1 = suspicious/unknown merchant.
    """
    if not isinstance(name, str):
        return 1
    s = name.strip().lower()

    if s in KNOWN_MERCHANTS_LOWER:
        return 0

    for kw in SAFE_KEYWORDS:
        if kw in s:
            return 0

    if "xxx" in s or "fraud" in s:
        return 1

    digit_count = sum(c.isdigit() for c in s)
    if digit_count >= 3 or len(s) <= 3:
        return 1

    alpha_count = sum(c.isalpha() for c in s)
    if alpha_count / max(len(s), 1) < 0.5:
        return 1

    return 1


def _parse_timestamp(value) -> pd.Timestamp | None:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    try:
        return pd.to_datetime(value)
    except Exception:
        return None


def _is_night(value) -> int:
    ts = _parse_timestamp(value)
    if ts is None:
        return 0
    return 1 if ts.hour in {23, 0, 1, 2, 3, 4, 5} else 0


def _coerce_numeric(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _distance_from_fields(home_lat, home_long, merch_lat, merch_long) -> float:
    return haversine(_coerce_numeric(home_lat), _coerce_numeric(home_long), _coerce_numeric(merch_lat), _coerce_numeric(merch_long))


def _ensure_columns(df: pd.DataFrame) -> pd.DataFrame:
    for col in CATEGORICAL:
        if col not in df:
            df[col] = ""
        df[col] = df[col].fillna("")
    for col in NUMERIC_FEATURES:
        if col not in df:
            df[col] = 0.0
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    return df


def prepare_training_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build the simple feature matrix expected by the new model.

    Accepts either the synthetic_simple_v2 columns or the richer transaction
    shape coming from the backend/front-end and computes the derived fields.
    """
    X = df.copy()

    if "amount" not in X and "amt" in X:
        X["amount"] = X["amt"]

    if "distance_km" not in X:
        if "distance_from_home" in X:
            X["distance_km"] = pd.to_numeric(X["distance_from_home"], errors="coerce")
        else:
            def _row_distance(row):
                home_lat = row.get("home_lat", row.get("lat"))
                home_long = row.get("home_long", row.get("long"))
                return _distance_from_fields(home_lat, home_long, row.get("merch_lat"), row.get("merch_long"))

            X["distance_km"] = X.apply(_row_distance, axis=1)

    if "merchant_risk" not in X:
        if "is_known_merchant" in X:
            known = pd.to_numeric(X["is_known_merchant"], errors="coerce").fillna(0)
            X["merchant_risk"] = (1 - known).clip(lower=0, upper=1)
        else:
            merchants = X.get("merchant", pd.Series("", index=X.index))
            X["merchant_risk"] = merchants.apply(compute_merchant_risk)

    if "is_night" not in X:
        timestamps = X.get("trans_date_trans_time", X.get("timestamp"))
        X["is_night"] = timestamps.apply(_is_night) if timestamps is not None else 0

    if "hour" not in X:
        if "hour" in df:
            X["hour"] = pd.to_numeric(df["hour"], errors="coerce").fillna(0)
        else:
            timestamps = X.get("trans_date_trans_time", X.get("timestamp"))
            X["hour"] = timestamps.apply(lambda t: _parse_timestamp(t).hour if _parse_timestamp(t) else 0) if timestamps is not None else 0

    X = _ensure_columns(X)
    return X[FEATURE_COLUMNS]


def prepare_inference_features(transaction: Dict, history: List[Dict] | None = None) -> pd.DataFrame:
    """
    Build a single-row DataFrame with the simplified features.
    History is ignored for the new model but accepted for compatibility.
    """
    del history  # not used for the simplified feature set
    txn = transaction or {}

    amount = _coerce_numeric(txn.get("amount", txn.get("amt")))

    distance_km = txn.get("distance_km")
    if distance_km is None and "distance_from_home" in txn:
        distance_km = txn.get("distance_from_home")
    if distance_km is None:
        home_lat = txn.get("home_lat", txn.get("lat"))
        home_long = txn.get("home_long", txn.get("long"))
        distance_km = _distance_from_fields(home_lat, home_long, txn.get("merch_lat"), txn.get("merch_long"))

    merchant_risk = txn.get("merchant_risk")
    if merchant_risk is None:
        if "is_known_merchant" in txn:
            try:
                merchant_risk = 1 - float(txn.get("is_known_merchant"))
            except Exception:
                merchant_risk = compute_merchant_risk(txn.get("merchant", ""))
        else:
            merchant_risk = compute_merchant_risk(txn.get("merchant", ""))

    is_night = txn.get("is_night")
    if is_night is None:
        is_night = _is_night(txn.get("trans_date_trans_time") or txn.get("timestamp"))

    hour = txn.get("hour")
    if hour is None:
        ts = _parse_timestamp(txn.get("trans_date_trans_time") or txn.get("timestamp"))
        hour = ts.hour if ts is not None else 0

    data = {
        "amount": amount,
        "distance_km": distance_km,
        "merchant_risk": merchant_risk,
        "is_night": is_night,
        "hour": hour,
        "category": txn.get("category", ""),
    }

    X = pd.DataFrame([data])
    X = _ensure_columns(X)
    return X[FEATURE_COLUMNS]
