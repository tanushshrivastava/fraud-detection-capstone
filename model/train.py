"""End-to-end training script for the fraud detection classifier.

The script loads the labelled transactions CSV, engineers features, trains a
RandomForest pipeline, and packages the resulting artifacts for deployment.
"""

import json
import tarfile
from datetime import datetime
from pathlib import Path
from typing import List

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
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
    df["age"] = ((df["trans_date_trans_time"] - df["dob"]).dt.days / 365.25).clip(lower=0).astype(int)

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
        "lat",
        "long",
        "city_pop",
        "merch_lat",
        "merch_long",
        "hour",
        "age",
        "dow",
    ]
    categorical_features = ["merchant", "category", "gender", "state", "job"]

    pipeline = build_pipeline(numeric_features, categorical_features)

    # Fit the end-to-end pipeline, including preprocessing, on the training split.
    pipeline.fit(X_train, y_train)

    # Evaluate on the holdout period
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    roc_auc = roc_auc_score(y_test, y_proba)
    pr_auc = average_precision_score(y_test, y_proba)

    metrics = {
        "roc_auc": float(roc_auc),
        "pr_auc": float(pr_auc),
        "train_pos_rate": float(y_train.mean()),
        "test_pos_rate": float(y_test.mean()),
        "n_train": int(len(y_train)),
        "n_test": int(len(y_test)),
        "cutoff_time": cutoff_time.isoformat(),
        "model": "RandomForestClassifier",
        "model_params": {
            "n_estimators": 300,
            "class_weight": "balanced_subsample",
            "random_state": 42,
            "min_samples_leaf": 2,
        },
    }

    print("Validation metrics:", json.dumps(metrics, indent=2))

    stack_name = get_backend_stack_name()
    # Persist artifacts to the stack-specific directory used by the CDK deployment.
    tar_path = save_model_artifacts(pipeline, stack_name, metrics)
    print(f"Saved stack-specific artifacts to {tar_path}")


# Allow the script to be executed directly from the command line.
if __name__ == "__main__":
    main()
