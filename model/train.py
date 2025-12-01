"""End-to-end training script for the fraud detection classifier.

The script loads the labelled transactions CSV, engineers features, trains a
RandomForest pipeline, and packages the resulting artifacts for deployment.
"""

import tarfile
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from cdk_utils import get_artifact_root, get_backend_stack_name
from common import (
    CATEGORICAL,
    FEATURE_COLUMNS,
    NUMERIC_FEATURES,
    prepare_training_features,
)


def load_dataframe(csv_path: Path) -> pd.DataFrame:
    """Read the fraud dataset from disk and fail fast if it is missing."""
    if not csv_path.exists():
        raise FileNotFoundError(
            f"Training data not found at {csv_path}. "
            "Download fraudTrain.csv to the model/ directory before training."
        )
    return pd.read_csv(csv_path)


def build_pipeline() -> Pipeline:
    """Create a preprocessing + classifier pipeline used for both training/inference."""
    numeric_transformer = Pipeline([("scaler", StandardScaler())])
    categorical_transformer = Pipeline([("onehot", OneHotEncoder(handle_unknown="ignore"))])

    preprocessor = ColumnTransformer(
        [
            ("num", numeric_transformer, NUMERIC_FEATURES),
            ("cat", categorical_transformer, CATEGORICAL),
        ]
    )

    return Pipeline(
        [
            ("preprocessor", preprocessor),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=200,
                    max_depth=None,
                    class_weight="balanced",
                    n_jobs=-1,
                    random_state=42,
                ),
            ),
        ]
    )


def ensure_directory(path: Path) -> None:
    """Create the directory (and parents) if it does not exist yet."""
    path.mkdir(parents=True, exist_ok=True)


def save_model_artifacts(model: Pipeline, stack_name: str, roc_auc: float) -> Path:
    """Persist the trained model and supporting files in both TAR and legacy formats."""
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
    # Load the raw labelled transactions into a DataFrame.
    df = load_dataframe(csv_path)
    # Engineer training features that mirror what inference will build.
    features = prepare_training_features(df)
    target = "is_fraud"
    y = df[target]

    # Keep only the columns the pipeline expects.
    X = features[FEATURE_COLUMNS]

    pipeline = build_pipeline()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, stratify=y, test_size=0.2, random_state=42
    )
    # Fit the end-to-end pipeline, including preprocessing, on the training split.
    pipeline.fit(X_train, y_train)

    # Track validation performance for visibility during training runs.
    roc_auc = roc_auc_score(y_test, pipeline.predict_proba(X_test)[:, 1])
    print("ROC AUC:", roc_auc)

    stack_name = get_backend_stack_name()
    # Persist artifacts to the stack-specific directory used by the CDK deployment.
    tar_path = save_model_artifacts(pipeline, stack_name, roc_auc)
    print(f"Saved stack-specific artifacts to {tar_path}")


# Allow the script to be executed directly from the command line.
if __name__ == "__main__":
    main()
