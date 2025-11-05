"""End-to-end training script for the fraud detection classifier.

The script loads the labelled transactions CSV, engineers features, trains an
XGBoost (XGBClassifier) pipeline, and packages the resulting artifacts for deployment.
"""

import json
import tarfile
from datetime import datetime
from pathlib import Path
from typing import List

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
try:
    from xgboost import XGBClassifier
except ModuleNotFoundError as e:
    raise ModuleNotFoundError(
        "xgboost is not installed. Please install it with:\n"
        "  pip install xgboost==2.0.3\n"
        "If you are on Apple Silicon and encounter build issues, upgrade pip and try again:\n"
        "  pip install --upgrade pip setuptools wheel && pip install xgboost==2.0.3"
    ) from e
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, average_precision_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from cdk_utils import get_artifact_root, get_backend_stack_name


def load_dataframe(csv_path: Path) -> pd.DataFrame:
    """Read the fraud dataset from disk and fail fast if it is missing."""
    if not csv_path.exists():
        raise FileNotFoundError(
            f"Training data not found at {csv_path}. "
            "Download fraudTrain.csv to the model/ directory before training."
        )
    return pd.read_csv(csv_path)


def build_pipeline(
    numeric_features: List[str],
    categorical_features: List[str],
    *,
    scale_pos_weight: float = 1.0,
) -> Pipeline:
    """Create a preprocessing + classifier pipeline used for both training/inference."""
    # Standardize numeric columns to zero mean / unit variance.
    numeric_transformer = Pipeline([("scaler", StandardScaler())])
    # One-hot encode categorical columns while ignoring unseen categories at inference.
    categorical_transformer = Pipeline([
        ("onehot", OneHotEncoder(handle_unknown="ignore"))
    ])

    preprocessor = ColumnTransformer(
        [
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
        ]
    )

    return Pipeline(
        [
            ("preprocessor", preprocessor),
            (
                "classifier",
                XGBClassifier(
                    n_estimators=500,
                    max_depth=6,
                    learning_rate=0.1,
                    subsample=0.8,
                    colsample_bytree=0.8,
                    reg_lambda=1.0,
                    random_state=42,
                    n_jobs=-1,
                    tree_method="hist",
                    eval_metric="logloss",
                    scale_pos_weight=scale_pos_weight,
                    use_label_encoder=False,
                ),
            ),
        ]
    )


def build_rf_pipeline(
    numeric_features: List[str],
    categorical_features: List[str],
) -> Pipeline:
    """Create a preprocessing + RandomForest pipeline for comparison purposes."""
    numeric_transformer = Pipeline([("scaler", StandardScaler())])
    categorical_transformer = Pipeline([
        ("onehot", OneHotEncoder(handle_unknown="ignore"))
    ])

    preprocessor = ColumnTransformer(
        [
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
        ]
    )

    return Pipeline(
        [
            ("preprocessor", preprocessor),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=300,
                    class_weight="balanced_subsample",
                    n_jobs=-1,
                    random_state=42,
                    min_samples_leaf=2,
                ),
            ),
        ]
    )


def ensure_directory(path: Path) -> None:
    """Create the directory (and parents) if it does not exist yet."""
    path.mkdir(parents=True, exist_ok=True)


def save_model_artifacts(model: Pipeline, stack_name: str, metrics: dict) -> Path:
    """Persist the trained model, metrics, and supporting files in TAR and legacy formats."""
    artifact_root = get_artifact_root()
    stack_dir = artifact_root / stack_name
    ensure_directory(stack_dir)

    # Persist model
    model_joblib = stack_dir / "model.joblib"
    joblib.dump(model, model_joblib, compress=3)

    # Persist metrics JSON for visibility in CI/CD and SageMaker logs
    metrics_path = stack_dir / "metrics.json"
    with metrics_path.open("w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    # Build tarball
    tar_path = stack_dir / "model.tar.gz"
    model_dir = Path(__file__).resolve().parent
    files_to_package = [
        (model_joblib, "model.joblib"),
        (metrics_path, "metrics.json"),
        (model_dir / "inference.py", "inference.py"),
        (model_dir / "common.py", "common.py"),
    ]

    with tarfile.open(tar_path, "w:gz") as tar:
        for file_path, arcname in files_to_package:
            tar.add(file_path, arcname=arcname)

    # Keep legacy single-copy outputs for compatibility.
    legacy_joblib = model_dir / "model.joblib"
    joblib.dump(model, legacy_joblib, compress=3)

    return tar_path


def main() -> None:
    model_dir = Path(__file__).resolve().parent
    csv_path = model_dir / "fraudTrain.csv"
    # Load the raw labelled transactions into a DataFrame.
    df = load_dataframe(csv_path)

    # Recreate time-based and demographic features relied on by the model.
    df["trans_date_trans_time"] = pd.to_datetime(df["trans_date_trans_time"])
    df["dob"] = pd.to_datetime(df["dob"])
    df["hour"] = df["trans_date_trans_time"].dt.hour
    df["dow"] = df["trans_date_trans_time"].dt.dayofweek
    # Compute age at transaction time to avoid data leakage
    df["age"] = ((df["trans_date_trans_time"] - df["dob"]).dt.days / 365.25).clip(lower=0)

    # Additional stateless features to better capture suspicious patterns
    # 1) Log-transformed amount to highlight extreme spent values
    df["log_amt"] = (df["amt"].clip(lower=1e-6)).apply(lambda x: float(__import__("math").log(x)))
    # 2) Very high amount flag (million-dollar+)
    df["is_high_amount"] = (df["amt"] >= 1_000_000).astype(int)
    # 3) Cyclical encoding for hour of day
    import numpy as _np
    df["hour_sin"] = _np.sin(2 * _np.pi * df["hour"] / 24.0)
    df["hour_cos"] = _np.cos(2 * _np.pi * df["hour"] / 24.0)
    # 4) Night flag (e.g., 0-6)
    df["is_night"] = df["hour"].isin([0,1,2,3,4,5,6]).astype(int)
    # 5) Haversine distance between user and merchant
    def _haversine_km(lat1, lon1, lat2, lon2):
        import math
        if _np.isnan(lat1) or _np.isnan(lon1) or _np.isnan(lat2) or _np.isnan(lon2):
            return 0.0
        R = 6371.0
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return float(R * c)
    df["distance_km"] = [
        _haversine_km(la, lo, mla, mlo)
        for la, lo, mla, mlo in zip(df["lat"], df["long"], df["merch_lat"], df["merch_long"])
    ]

    target = "is_fraud"
    y = df[target]
    # Drop identifiers that should not be used by the model.
    X = df.drop(columns=[target, "trans_num"])

    # Time-based split to avoid temporal leakage
    cutoff_time = df["trans_date_trans_time"].quantile(0.8)
    train_mask = df["trans_date_trans_time"] <= cutoff_time
    test_mask = ~train_mask

    X_train, X_test = X.loc[train_mask], X.loc[test_mask]
    y_train, y_test = y.loc[train_mask], y.loc[test_mask]

    numeric_features = [
        "amt",
        "log_amt",
        "is_high_amount",
        "lat",
        "long",
        "city_pop",
        "merch_lat",
        "merch_long",
        "distance_km",
        "hour",
        "hour_sin",
        "hour_cos",
        "is_night",
        "age",
        "dow",
    ]
    categorical_features = ["merchant", "category", "gender", "state", "job"]

    # Compute class imbalance weight for XGBoost
    pos = float(y_train.sum())
    neg = float(len(y_train) - y_train.sum())
    scale_pos_weight = (neg / pos) if pos > 0 else 1.0

    pipeline = build_pipeline(numeric_features, categorical_features, scale_pos_weight=scale_pos_weight)

    # Fit the end-to-end pipeline, including preprocessing, on the training split.
    pipeline.fit(X_train, y_train)

    # Evaluate XGBoost on the holdout period
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    roc_auc = roc_auc_score(y_test, y_proba)
    pr_auc = average_precision_score(y_test, y_proba)

    # Train and evaluate baseline RandomForest on same split for comparison
    rf_pipeline = build_rf_pipeline(numeric_features, categorical_features)
    rf_pipeline.fit(X_train, y_train)
    rf_proba = rf_pipeline.predict_proba(X_test)[:, 1]
    rf_roc_auc = roc_auc_score(y_test, rf_proba)
    rf_pr_auc = average_precision_score(y_test, rf_proba)

    # Determine winner by PR AUC (primary) then ROC AUC as tiebreaker
    def _winner(xgb_pr, xgb_roc, rf_pr, rf_roc):
        if abs(xgb_pr - rf_pr) > 1e-6:
            return "xgboost" if xgb_pr > rf_pr else "random_forest"
        # tie on PR AUC, use ROC AUC
        if abs(xgb_roc - rf_roc) > 1e-6:
            return "xgboost" if xgb_roc > rf_roc else "random_forest"
        return "tie"

    winner = _winner(pr_auc, roc_auc, rf_pr_auc, rf_roc_auc)

    metrics = {
        "roc_auc": float(roc_auc),
        "pr_auc": float(pr_auc),
        "train_pos_rate": float(y_train.mean()),
        "test_pos_rate": float(y_test.mean()),
        "n_train": int(len(y_train)),
        "n_test": int(len(y_test)),
        "cutoff_time": cutoff_time.isoformat(),
        "model": "XGBClassifier",
        "model_params": {
            "n_estimators": 500,
            "max_depth": 6,
            "learning_rate": 0.1,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "reg_lambda": 1.0,
            "random_state": 42,
            "tree_method": "hist",
            "eval_metric": "logloss",
            "scale_pos_weight": float(scale_pos_weight),
        },
        "comparison": {
            "random_forest": {
                "roc_auc": float(rf_roc_auc),
                "pr_auc": float(rf_pr_auc),
                "model": "RandomForestClassifier",
                "model_params": {
                    "n_estimators": 300,
                    "class_weight": "balanced_subsample",
                    "random_state": 42,
                    "min_samples_leaf": 2,
                },
            },
            "xgboost": {
                "roc_auc": float(roc_auc),
                "pr_auc": float(pr_auc),
                "model": "XGBClassifier",
            },
            "winner": winner,
            "selection_metric": "pr_auc_then_roc_auc",
        },
    }

    print("Validation metrics:", json.dumps(metrics, indent=2))
    print(f"Comparison: XGBoost PR AUC={pr_auc:.4f}, ROC AUC={roc_auc:.4f} | RandomForest PR AUC={rf_pr_auc:.4f}, ROC AUC={rf_roc_auc:.4f} | Winner: {winner}")

    stack_name = get_backend_stack_name()
    # Persist artifacts to the stack-specific directory used by the CDK deployment.
    tar_path = save_model_artifacts(pipeline, stack_name, metrics)
    print(f"Saved stack-specific artifacts to {tar_path}")


# Allow the script to be executed directly from the command line.
if __name__ == "__main__":
    main()
