import json
import tarfile
from datetime import datetime
from pathlib import Path
from typing import List

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from cdk_utils import get_artifact_root, get_backend_stack_name


def load_dataframe(csv_path: Path) -> pd.DataFrame:
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
    numeric_transformer = Pipeline([("scaler", StandardScaler())])
    categorical_transformer = Pipeline([("onehot", OneHotEncoder(handle_unknown="ignore"))])

    preprocessor = ColumnTransformer(
        [
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
        ]
    )

    return Pipeline(
        [
            ("preprocessor", preprocessor),
            ("classifier", RandomForestClassifier(n_estimators=100, class_weight="balanced", n_jobs=-1)),
        ]
    )


def ensure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def save_model_artifacts(model: Pipeline, stack_name: str, roc_auc: float) -> Path:
    artifact_root = get_artifact_root()
    stack_dir = artifact_root / stack_name
    ensure_directory(stack_dir)

    model_joblib = stack_dir / "model.joblib"
    joblib.dump(model, model_joblib, compress=3)



    tar_path = stack_dir / "model.tar.gz"
    model_dir = Path(__file__).resolve().parent
    files_to_package = [
        (model_joblib, "model.joblib"),
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
    df = load_dataframe(csv_path)

    df["trans_date_trans_time"] = pd.to_datetime(df["trans_date_trans_time"])
    df["dob"] = pd.to_datetime(df["dob"])
    df["hour"] = df["trans_date_trans_time"].dt.hour
    df["dow"] = df["trans_date_trans_time"].dt.dayofweek
    df["age"] = ((datetime.now() - df["dob"]).dt.days / 365.25).astype(int)

    target = "is_fraud"
    y = df[target]
    X = df.drop(columns=[target, "trans_num"])

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
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, stratify=y, test_size=0.2, random_state=42
    )
    pipeline.fit(X_train, y_train)

    roc_auc = roc_auc_score(y_test, pipeline.predict_proba(X_test)[:, 1])
    print("ROC AUC:", roc_auc)

    stack_name = get_backend_stack_name()
    tar_path = save_model_artifacts(pipeline, stack_name, roc_auc)
    print(f"Saved stack-specific artifacts to {tar_path}")


if __name__ == "__main__":
    main()
