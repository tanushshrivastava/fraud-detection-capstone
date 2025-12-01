"""End-to-end training script for the fraud detection classifier.

The script loads the labelled transactions CSV, engineers features, trains an
XGBoost (XGBClassifier) pipeline, and packages the resulting artifacts for deployment.
"""

import json
import os
import tarfile
from datetime import datetime
from pathlib import Path
from typing import List, Optional

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
from sklearn.metrics import roc_auc_score, average_precision_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
import numpy as np

from cdk_utils import get_artifact_root, get_backend_stack_name


def load_dataframe(csv_path: Path) -> pd.DataFrame:
    """Read the fraud dataset from disk and fail fast if it is missing."""
    if not csv_path.exists():
        raise FileNotFoundError(
            f"Training data not found at {csv_path}. "
            "Download fraudTrain.csv to the model/ directory before training."
        )
    return pd.read_csv(csv_path)


def load_and_combine_datasets(csv_paths: List[Path]) -> pd.DataFrame:
    """Load and combine multiple CSV datasets."""
    dfs = []
    for csv_path in csv_paths:
        if not csv_path.exists():
            print(f"Warning: {csv_path} not found, skipping...")
            continue
        print(f"Loading {csv_path}...")
        df = pd.read_csv(csv_path)
        dfs.append(df)
    
    if not dfs:
        raise FileNotFoundError("No valid datasets found!")
    
    combined = pd.concat(dfs, ignore_index=True)
    print(f"Combined dataset size: {len(combined):,} rows")
    return combined


def build_pipeline(
    numeric_features: List[str],
    categorical_features: List[str],
    *,
    scale_pos_weight: float = 1.0,
    use_early_stopping: bool = True,
    max_estimators: int = 1000,
    quick_mode: bool = False,
) -> Pipeline:
    """Create a preprocessing + classifier pipeline used for both training/inference.
    
    Args:
        use_early_stopping: If True, enables early stopping to prevent overfitting.
        max_estimators: Maximum number of boosting rounds (used with early stopping).
    """
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

    # Adjust parameters for quick mode
    xgb_params = {
        "max_depth": 5 if quick_mode else 7,  # Shallower in quick mode for speed
        "learning_rate": 0.08 if quick_mode else 0.02,  # Higher learning rate in quick mode for faster convergence
        "subsample": 0.8 if quick_mode else 0.9,  # Less data per tree in quick mode
        "colsample_bytree": 0.8 if quick_mode else 0.9,  # Less features per tree in quick mode
        "colsample_bylevel": 0.9,  # Use more features at each level
        "reg_lambda": 1.0 if quick_mode else 2.0,  # Less regularization in quick mode
        "reg_alpha": 0.1 if quick_mode else 0.3,  # Less regularization in quick mode
        "min_child_weight": 3 if quick_mode else 6,  # Lower in quick mode
        "gamma": 0.1 if quick_mode else 0.3,  # Lower minimum loss reduction in quick mode
        "random_state": 42,
        "n_jobs": -1,
        "tree_method": "hist",
        "eval_metric": ["aucpr", "auc"],  # Monitor both PR AUC and ROC AUC
        "scale_pos_weight": scale_pos_weight,
        "use_label_encoder": False,
        "objective": "binary:logistic",
    }
    
    if use_early_stopping:
        # early_stopping_rounds will be set by caller
        xgb_params.update({
            "n_estimators": max_estimators,
        })
    else:
        xgb_params["n_estimators"] = 500

    return Pipeline(
        [
            ("preprocessor", preprocessor),
            ("classifier", XGBClassifier(**xgb_params)),
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
    import argparse
    
    parser = argparse.ArgumentParser(description="Train fraud detection model")
    parser.add_argument(
        "--train-csv",
        nargs="+",
        default=["fraudTrain.csv"],
        help="Training CSV file(s) to use (can specify multiple, e.g., --train-csv fraudTrain.csv fraudTrain_new.csv)",
    )
    parser.add_argument(
        "--test-csv",
        nargs="+",
        default=["fraudTest.csv"],
        help="Test CSV file(s) to use (can specify multiple)",
    )
    parser.add_argument(
        "--fast",
        action="store_true",
        help="Use fast training mode (fewer estimators, less patience) for quicker iteration",
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Use quick mode to see results in ~5 minutes (fewer estimators, shorter patience, verbose progress)",
    )
    args = parser.parse_args()
    
    model_dir = Path(__file__).resolve().parent
    
    # Load and combine training datasets if multiple specified
    if len(args.train_csv) > 1:
        train_paths = [model_dir / path for path in args.train_csv]
        df = load_and_combine_datasets(train_paths)
    else:
        csv_path = model_dir / args.train_csv[0]
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
    df["log_amt"] = np.log(np.clip(df["amt"].values, 1e-6, None))
    # 2) Very high amount flags
    df["is_high_amount"] = (df["amt"] >= 1_000_000).astype(int)
    df["is_very_high_amount"] = (df["amt"] >= 10_000).astype(int)
    # 3) Amount normalized by city population
    df["amt_per_city_pop"] = df["amt"] / (df["city_pop"] + 1)
    # 4) Time features
    df["month"] = df["trans_date_trans_time"].dt.month
    df["day"] = df["trans_date_trans_time"].dt.day
    # 5) Cyclical encoding for time features
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24.0)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24.0)
    df["dow_sin"] = np.sin(2 * np.pi * df["dow"] / 7.0)
    df["dow_cos"] = np.cos(2 * np.pi * df["dow"] / 7.0)
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12.0)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12.0)
    # 6) Time flags
    df["is_night"] = df["hour"].isin([0,1,2,3,4,5,6]).astype(int)
    df["is_weekend"] = df["dow"].isin([5, 6]).astype(int)
    df["is_business_hours"] = df["hour"].between(9, 17).astype(int)
    # 7) Haversine distance between user and merchant (vectorized for speed)
    lat = df["lat"].fillna(0).values
    lon = df["long"].fillna(0).values
    mlat = df["merch_lat"].fillna(0).values
    mlon = df["merch_long"].fillna(0).values
    
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
    # 8) Geographic flags
    df["is_distant"] = (df["distance_km"] > 100).astype(int)
    df["is_very_distant"] = (df["distance_km"] > 500).astype(int)
    # 9) Interaction features
    df["high_amt_distant"] = (df["is_high_amount"] * df["is_distant"]).astype(int)
    df["night_high_amt"] = (df["is_night"] * df["is_very_high_amount"]).astype(int)

    target = "is_fraud"
    y = df[target]
    # Drop identifiers that should not be used by the model.
    X = df.drop(columns=[target, "trans_num"])

    # Time-based split to avoid temporal leakage
    # Split into train (80%), validation (10%), test (10%)
    # If test CSV is provided separately, use it; otherwise split from training data
    if len(args.test_csv) > 0 and (len(args.test_csv) > 1 or args.test_csv[0] != "fraudTest.csv" or (model_dir / args.test_csv[0]).exists()):
        # Use separate test dataset(s)
        if len(args.test_csv) > 1:
            test_paths = [model_dir / path for path in args.test_csv]
            df_test = load_and_combine_datasets(test_paths)
        else:
            test_path = model_dir / args.test_csv[0]
            if test_path.exists():
                df_test = load_dataframe(test_path)
            else:
                df_test = None
    else:
        df_test = None
    
    if df_test is not None:
        # Apply same feature engineering to test set
        df_test["trans_date_trans_time"] = pd.to_datetime(df_test["trans_date_trans_time"])
        df_test["dob"] = pd.to_datetime(df_test["dob"])
        df_test["hour"] = df_test["trans_date_trans_time"].dt.hour
        df_test["dow"] = df_test["trans_date_trans_time"].dt.dayofweek
        df_test["age"] = ((df_test["trans_date_trans_time"] - df_test["dob"]).dt.days / 365.25).clip(lower=0)
        df_test["log_amt"] = np.log(np.clip(df_test["amt"].values, 1e-6, None))
        df_test["is_high_amount"] = (df_test["amt"] >= 1_000_000).astype(int)
        df_test["is_very_high_amount"] = (df_test["amt"] >= 10_000).astype(int)
        df_test["amt_per_city_pop"] = df_test["amt"] / (df_test["city_pop"] + 1)
        df_test["month"] = df_test["trans_date_trans_time"].dt.month
        df_test["day"] = df_test["trans_date_trans_time"].dt.day
        df_test["hour_sin"] = np.sin(2 * np.pi * df_test["hour"] / 24.0)
        df_test["hour_cos"] = np.cos(2 * np.pi * df_test["hour"] / 24.0)
        df_test["dow_sin"] = np.sin(2 * np.pi * df_test["dow"] / 7.0)
        df_test["dow_cos"] = np.cos(2 * np.pi * df_test["dow"] / 7.0)
        df_test["month_sin"] = np.sin(2 * np.pi * df_test["month"] / 12.0)
        df_test["month_cos"] = np.cos(2 * np.pi * df_test["month"] / 12.0)
        df_test["is_night"] = df_test["hour"].isin([0,1,2,3,4,5,6]).astype(int)
        df_test["is_weekend"] = df_test["dow"].isin([5, 6]).astype(int)
        df_test["is_business_hours"] = df_test["hour"].between(9, 17).astype(int)
        # Vectorized haversine calculation for test set
        lat_test = df_test["lat"].fillna(0).values
        lon_test = df_test["long"].fillna(0).values
        mlat_test = df_test["merch_lat"].fillna(0).values
        mlon_test = df_test["merch_long"].fillna(0).values
        
        R = 6371.0
        lat1_rad = np.radians(lat_test)
        lat2_rad = np.radians(mlat_test)
        dlat_rad = np.radians(mlat_test - lat_test)
        dlon_rad = np.radians(mlon_test - lon_test)
        
        a = (np.sin(dlat_rad/2)**2 + 
             np.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(dlon_rad/2)**2)
        c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
        df_test["distance_km"] = R * c
        df_test["is_distant"] = (df_test["distance_km"] > 100).astype(int)
        df_test["is_very_distant"] = (df_test["distance_km"] > 500).astype(int)
        df_test["high_amt_distant"] = (df_test["is_high_amount"] * df_test["is_distant"]).astype(int)
        df_test["night_high_amt"] = (df_test["is_night"] * df_test["is_very_high_amount"]).astype(int)
        
        y_test = df_test[target]
        X_test = df_test.drop(columns=[target, "trans_num"])
        
        # Split training data into train (80%) and validation (20%)
        train_cutoff = df["trans_date_trans_time"].quantile(0.8)
        train_mask = df["trans_date_trans_time"] <= train_cutoff
        val_mask = df["trans_date_trans_time"] > train_cutoff
        
        X_train = X.loc[train_mask]
        X_val = X.loc[val_mask]
        y_train = y.loc[train_mask]
        y_val = y.loc[val_mask]
    else:
        # Split into train (70%), validation (10%), test (20%)
        train_cutoff = df["trans_date_trans_time"].quantile(0.7)
        val_cutoff = df["trans_date_trans_time"].quantile(0.8)
        
        train_mask = df["trans_date_trans_time"] <= train_cutoff
        val_mask = (df["trans_date_trans_time"] > train_cutoff) & (df["trans_date_trans_time"] <= val_cutoff)
        test_mask = df["trans_date_trans_time"] > val_cutoff

        X_train = X.loc[train_mask]
        X_val = X.loc[val_mask]
        X_test = X.loc[test_mask]
        y_train = y.loc[train_mask]
        y_val = y.loc[val_mask]
        y_test = y.loc[test_mask]
    
    print(f"Data split: Train={len(y_train)}, Validation={len(y_val)}, Test={len(y_test)}")
    print(f"Train fraud rate: {y_train.mean():.4f}, Val fraud rate: {y_val.mean():.4f}, Test fraud rate: {y_test.mean():.4f}")

    numeric_features = [
        "amt",
        "log_amt",
        "is_high_amount",
        "is_very_high_amount",
        "amt_per_city_pop",
        "lat",
        "long",
        "city_pop",
        "merch_lat",
        "merch_long",
        "distance_km",
        "hour",
        "hour_sin",
        "hour_cos",
        "dow",
        "dow_sin",
        "dow_cos",
        "month",
        "month_sin",
        "month_cos",
        "day",
        "is_night",
        "is_weekend",
        "is_business_hours",
        "is_distant",
        "is_very_distant",
        "high_amt_distant",
        "night_high_amt",
        "age",
    ]
    categorical_features = ["merchant", "category", "gender", "state", "job"]

    # Compute class imbalance weight for XGBoost
    pos = float(y_train.sum())
    neg = float(len(y_train) - y_train.sum())
    scale_pos_weight = (neg / pos) if pos > 0 else 1.0

    # Check for training mode (for development/testing)
    quick_mode = args.quick
    fast_mode = args.fast or (os.environ.get("FAST_TRAIN", "false").lower() == "true")
    
    if quick_mode:
        print("⚡ QUICK MODE ENABLED: Training optimized to show results in ~5 minutes")
        max_estimators = 150  # Fewer estimators for quick results
        early_stopping_rounds = 10  # Shorter patience
        verbose_level = 5  # More frequent updates
    elif fast_mode:
        print("⚠️  FAST MODE ENABLED: Using reduced model complexity for faster training")
        max_estimators = 300
        early_stopping_rounds = 20
        verbose_level = 10
    else:
        max_estimators = 600  # More estimators for better learning
        early_stopping_rounds = 50  # More patience for early stopping
        verbose_level = 10
        print(f"Training with {max_estimators} max estimators and early stopping patience of {early_stopping_rounds} rounds...")
    
    pipeline = build_pipeline(
        numeric_features, 
        categorical_features, 
        scale_pos_weight=scale_pos_weight,
        use_early_stopping=True,
        max_estimators=max_estimators,
        quick_mode=quick_mode
    )

    # Set early stopping rounds on the classifier
    classifier = pipeline.named_steps["classifier"]
    classifier.set_params(early_stopping_rounds=early_stopping_rounds)
    
    # Preprocess data for early stopping
    # We need to fit preprocessor first, then train classifier with eval_set
    preprocessor = pipeline.named_steps["preprocessor"]
    X_train_preprocessed = preprocessor.fit_transform(X_train)
    X_val_preprocessed = preprocessor.transform(X_val)
    print("\nTraining XGBoost with early stopping...")
    print(f"Training set: {len(y_train):,} samples ({y_train.sum():,} fraud cases)")
    print(f"Validation set: {len(y_val):,} samples ({y_val.sum():,} fraud cases)")
    if quick_mode:
        print("⚡ Quick mode: Expect results in ~3-5 minutes\n")
    elif fast_mode:
        print("Fast mode: Expect results in ~10-15 minutes\n")
    else:
        print("Full training mode: This may take 20-30 minutes...\n")
    
    import time
    start_time = time.time()
    classifier.fit(
        X_train_preprocessed, 
        y_train,
        eval_set=[(X_train_preprocessed, y_train), (X_val_preprocessed, y_val)],
        verbose=verbose_level  # Print progress more frequently in quick mode
    )
    training_time = time.time() - start_time
    print(f"\n✓ Training completed in {training_time:.1f} seconds ({training_time/60:.1f} minutes)")
    
    # XGBoost with early stopping automatically uses best iteration
    best_iteration = classifier.get_booster().best_iteration
    if best_iteration is not None:
        actual_iterations = best_iteration + 1  # best_iteration is 0-indexed
        print(f"Early stopping triggered at iteration {actual_iterations} (best validation performance)")
        print(f"Best iteration performance: {classifier.best_score if hasattr(classifier, 'best_score') else 'N/A'}")
    else:
        actual_iterations = classifier.n_estimators
        print(f"Training completed all {actual_iterations} iterations (no early stopping)")
    
    # Update pipeline with trained classifier
    pipeline.named_steps["classifier"] = classifier
    pipeline.named_steps["preprocessor"] = preprocessor
    
    # Evaluate on train, validation, and test sets to detect overfitting
    y_train_proba = pipeline.predict_proba(X_train)[:, 1]
    y_val_proba = pipeline.predict_proba(X_val)[:, 1]
    y_test_proba = pipeline.predict_proba(X_test)[:, 1]
    
    train_roc_auc = roc_auc_score(y_train, y_train_proba)
    train_pr_auc = average_precision_score(y_train, y_train_proba)
    val_roc_auc = roc_auc_score(y_val, y_val_proba)
    val_pr_auc = average_precision_score(y_val, y_val_proba)
    test_roc_auc = roc_auc_score(y_test, y_test_proba)
    test_pr_auc = average_precision_score(y_test, y_test_proba)
    
    # Check for overfitting (train performance >> test performance)
    roc_overfit = train_roc_auc - test_roc_auc
    pr_overfit = train_pr_auc - test_pr_auc
    
    print(f"\nOverfitting Analysis:")
    print(f"  ROC AUC: Train={train_roc_auc:.4f}, Val={val_roc_auc:.4f}, Test={test_roc_auc:.4f} (Gap={roc_overfit:.4f})")
    print(f"  PR AUC: Train={train_pr_auc:.4f}, Val={val_pr_auc:.4f}, Test={test_pr_auc:.4f} (Gap={pr_overfit:.4f})")
    
    if roc_overfit > 0.05 or pr_overfit > 0.10:
        print(f"  WARNING: Potential overfitting detected! Consider stronger regularization or more data.")
    elif roc_overfit > 0.02 or pr_overfit > 0.05:
        print(f"  CAUTION: Some overfitting may be present.")
    else:
        print(f"  Model generalization looks good.")
    
    # Use test set metrics for final evaluation
    roc_auc = test_roc_auc
    pr_auc = test_pr_auc
    y_proba = y_test_proba
    
    # Feature importance analysis
    try:
        feature_names = (numeric_features + 
                        list(preprocessor.named_transformers_["cat"].named_steps["onehot"].get_feature_names_out(categorical_features)))
        importances = classifier.feature_importances_
        importance_df = pd.DataFrame({
            "feature": feature_names,
            "importance": importances
        }).sort_values("importance", ascending=False)
        
        print(f"\nTop 10 Most Important Features:")
        for idx, row in importance_df.head(10).iterrows():
            print(f"  {row['feature']}: {row['importance']:.4f}")
    except Exception as e:
        print(f"Could not extract feature importance: {e}")

    # Train and evaluate baseline RandomForest on same split for comparison
    rf_pipeline = build_rf_pipeline(numeric_features, categorical_features)
    rf_pipeline.fit(X_train, y_train)
    rf_val_proba = rf_pipeline.predict_proba(X_val)[:, 1]
    rf_test_proba = rf_pipeline.predict_proba(X_test)[:, 1]
    rf_val_roc_auc = roc_auc_score(y_val, rf_val_proba)
    rf_val_pr_auc = average_precision_score(y_val, rf_val_proba)
    rf_roc_auc = roc_auc_score(y_test, rf_test_proba)
    rf_pr_auc = average_precision_score(y_test, rf_test_proba)

    # Determine winner by PR AUC (primary) then ROC AUC as tiebreaker
    def _winner(xgb_pr, xgb_roc, rf_pr, rf_roc):
        if abs(xgb_pr - rf_pr) > 1e-6:
            return "xgboost" if xgb_pr > rf_pr else "random_forest"
        # tie on PR AUC, use ROC AUC
        if abs(xgb_roc - rf_roc) > 1e-6:
            return "xgboost" if xgb_roc > rf_roc else "random_forest"
        return "tie"

    winner = _winner(pr_auc, roc_auc, rf_pr_auc, rf_roc_auc)

    # Get actual n_estimators used (after early stopping)
    best_iteration = classifier.get_booster().best_iteration
    if best_iteration is not None:
        actual_n_estimators = best_iteration + 1  # best_iteration is 0-indexed
    else:
        actual_n_estimators = classifier.n_estimators if hasattr(classifier, 'n_estimators') else 500
    
    metrics = {
        "roc_auc": float(roc_auc),  # Test set
        "pr_auc": float(pr_auc),  # Test set
        "train_roc_auc": float(train_roc_auc),
        "train_pr_auc": float(train_pr_auc),
        "val_roc_auc": float(val_roc_auc),
        "val_pr_auc": float(val_pr_auc),
        "test_roc_auc": float(test_roc_auc),
        "test_pr_auc": float(test_pr_auc),
        "overfitting_roc_gap": float(roc_overfit),
        "overfitting_pr_gap": float(pr_overfit),
        "train_pos_rate": float(y_train.mean()),
        "val_pos_rate": float(y_val.mean()),
        "test_pos_rate": float(y_test.mean()),
        "n_train": int(len(y_train)),
        "n_val": int(len(y_val)),
        "n_test": int(len(y_test)),
        "train_cutoff_time": train_cutoff.isoformat(),
        "val_cutoff_time": val_cutoff.isoformat(),
        "model": "XGBClassifier",
        "model_params": {
            "n_estimators": actual_n_estimators,
            "max_depth": 7,
            "learning_rate": 0.02,
            "subsample": 0.9,
            "colsample_bytree": 0.9,
            "colsample_bylevel": 0.9,
            "reg_lambda": 2.0,
            "reg_alpha": 0.3,
            "min_child_weight": 6,
            "gamma": 0.3,
            "random_state": 42,
            "tree_method": "hist",
            "eval_metric": "aucpr",
            "scale_pos_weight": float(scale_pos_weight),
            "early_stopping_rounds": 50,
        },
        "datasets_used": {
            "train": args.train_csv,
            "test": args.test_csv,
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

    print("\n" + "="*60)
    print("Final Evaluation Metrics")
    print("="*60)
    print(json.dumps(metrics, indent=2))
    print(f"\nComparison (Test Set):")
    print(f"  XGBoost: PR AUC={pr_auc:.4f}, ROC AUC={roc_auc:.4f}")
    print(f"  RandomForest: PR AUC={rf_pr_auc:.4f}, ROC AUC={rf_roc_auc:.4f}")
    print(f"  Winner: {winner}")

    stack_name = get_backend_stack_name()
    # Persist artifacts to the stack-specific directory used by the CDK deployment.
    tar_path = save_model_artifacts(pipeline, stack_name, metrics)
    print(f"Saved stack-specific artifacts to {tar_path}")


# Allow the script to be executed directly from the command line.
if __name__ == "__main__":
    import sys
    try:
        main()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
