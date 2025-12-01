"""Evaluate the existing trained fraud detection model on new test datasets.

This script loads the existing trained model (model.joblib) and evaluates it
on the new fraudTrain_new.csv and fraudTest_new.csv datasets without retraining.
"""

import json
import sys
from pathlib import Path
from typing import Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    classification_report,
    confusion_matrix,
)


def load_model(model_path: Path):
    """Load the trained model from disk."""
    if not model_path.exists():
        raise FileNotFoundError(
            f"Model not found at {model_path}. "
            f"Please train the model first using train.py"
        )
    print(f"Loading existing model from {model_path}...")
    return joblib.load(model_path)


def preprocess_data(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    """Apply the same preprocessing as in train.py."""
    df = df.copy()
    
    # Recreate time-based and demographic features
    df["trans_date_trans_time"] = pd.to_datetime(df["trans_date_trans_time"])
    df["dob"] = pd.to_datetime(df["dob"])
    df["hour"] = df["trans_date_trans_time"].dt.hour
    df["dow"] = df["trans_date_trans_time"].dt.dayofweek
    # Compute age at transaction time
    df["age"] = ((df["trans_date_trans_time"] - df["dob"]).dt.days / 365.25).clip(lower=0)

    # Additional stateless features (same as train.py)
    # 1) Log-transformed amount
    amt_clipped = np.clip(df["amt"].values, 1e-6, None)
    df["log_amt"] = np.log(amt_clipped)
    # 2) Very high amount flag
    df["is_high_amount"] = (df["amt"] >= 1_000_000).astype(int)
    # 3) Cyclical encoding for hour of day
    hour_rad = 2 * np.pi * df["hour"].values / 24.0
    df["hour_sin"] = np.sin(hour_rad)
    df["hour_cos"] = np.cos(hour_rad)
    # 4) Night flag
    df["is_night"] = df["hour"].isin([0,1,2,3,4,5,6]).astype(int)
    # 5) Haversine distance between user and merchant
    lat = df["lat"].fillna(0).values
    lon = df["long"].fillna(0).values
    mlat = df["merch_lat"].fillna(0).values
    mlon = df["merch_long"].fillna(0).values
    
    R = 6371.0
    lat1_rad = np.radians(lat)
    lat2_rad = np.radians(mlat)
    dlat_rad = np.radians(mlat - lat)
    dlon_rad = np.radians(mlon - lon)
    
    a = (np.sin(dlat_rad/2)**2 + 
         np.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(dlon_rad/2)**2)
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    df["distance_km"] = R * c

    # Extract target and features
    target = "is_fraud"
    if target not in df.columns:
        raise ValueError(f"Target column '{target}' not found in dataset")
    
    y = df[target]
    # Drop identifiers that should not be used by the model
    X = df.drop(columns=[target, "trans_num"])
    
    return X, y


def evaluate_model(model, X: pd.DataFrame, y: pd.Series, dataset_name: str) -> dict:
    """Evaluate the model and return metrics."""
    print(f"\n{'='*60}")
    print(f"Evaluating on {dataset_name}")
    print(f"{'='*60}")
    print(f"Dataset size: {len(y):,} samples")
    print(f"Fraud rate: {y.mean():.4f} ({y.sum():,} fraud cases, {len(y) - y.sum():,} legitimate)")
    
    # Get predictions
    y_proba = model.predict_proba(X)[:, 1]
    y_pred = (y_proba >= 0.5).astype(int)
    
    # Calculate metrics
    roc_auc = roc_auc_score(y, y_proba)
    pr_auc = average_precision_score(y, y_proba)
    
    # Classification report
    print(f"\nClassification Report:")
    print(classification_report(y, y_pred, target_names=['Legitimate', 'Fraud']))
    
    # Confusion matrix
    cm = confusion_matrix(y, y_pred)
    print(f"\nConfusion Matrix:")
    print(f"                Predicted")
    print(f"              Legit  Fraud")
    print(f"Actual Legit  {cm[0,0]:6d} {cm[0,1]:6d}")
    print(f"       Fraud  {cm[1,0]:6d} {cm[1,1]:6d}")
    
    # Calculate additional metrics
    tn, fp, fn, tp = cm.ravel()
    accuracy = (tp + tn) / (tp + tn + fp + fn)
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    
    print(f"\nMetrics Summary:")
    print(f"  ROC AUC:        {roc_auc:.4f}")
    print(f"  PR AUC:         {pr_auc:.4f}")
    print(f"  Accuracy:       {accuracy:.4f}")
    print(f"  Precision:      {precision:.4f}")
    print(f"  Recall:         {recall:.4f}")
    print(f"  F1 Score:       {f1:.4f}")
    print(f"  Specificity:    {specificity:.4f}")
    
    return {
        "dataset": dataset_name,
        "n_samples": len(y),
        "n_fraud": int(y.sum()),
        "fraud_rate": float(y.mean()),
        "roc_auc": float(roc_auc),
        "pr_auc": float(pr_auc),
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1_score": float(f1),
        "specificity": float(specificity),
        "confusion_matrix": {
            "tn": int(tn),
            "fp": int(fp),
            "fn": int(fn),
            "tp": int(tp),
        }
    }


def main():
    """Main evaluation function."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Evaluate existing trained model on new CSV files"
    )
    parser.add_argument(
        "--train-csv",
        type=str,
        default="fraudTrain_new.csv",
        help="Path to new training CSV file (default: fraudTrain_new.csv)"
    )
    parser.add_argument(
        "--test-csv",
        type=str,
        default="fraudTest_new.csv",
        help="Path to new test CSV file (default: fraudTest_new.csv)"
    )
    parser.add_argument(
        "--model",
        type=str,
        default="model.joblib",
        help="Path to trained model file (default: model.joblib)"
    )
    parser.add_argument(
        "--skip-train",
        action="store_true",
        help="Skip evaluation on training set, only evaluate on test set"
    )
    args = parser.parse_args()
    
    model_dir = Path(__file__).resolve().parent
    
    # Load model
    model_path = model_dir / args.model
    model = load_model(model_path)
    print("✓ Model loaded successfully\n")
    
    results = {}
    
    # Load and evaluate on new training set (optional)
    if not args.skip_train:
        train_new_path = model_dir / args.train_csv
        if train_new_path.exists():
            print(f"Loading {train_new_path}...")
            df_train_new = pd.read_csv(train_new_path)
            X_train_new, y_train_new = preprocess_data(df_train_new)
            train_metrics = evaluate_model(model, X_train_new, y_train_new, args.train_csv)
            results["train_new"] = train_metrics
        else:
            print(f"Warning: {train_new_path} not found, skipping...")
    
    # Load and evaluate on new test set
    test_new_path = model_dir / args.test_csv
    if test_new_path.exists():
        print(f"\nLoading {test_new_path}...")
        df_test_new = pd.read_csv(test_new_path)
        X_test_new, y_test_new = preprocess_data(df_test_new)
        test_metrics = evaluate_model(model, X_test_new, y_test_new, args.test_csv)
        results["test_new"] = test_metrics
    else:
        print(f"Error: {test_new_path} not found!")
        return 1
    
    # Summary
    print(f"\n{'='*60}")
    print("Evaluation Summary")
    print(f"{'='*60}")
    
    if "train_new" in results:
        print(f"\nTraining Set ({args.train_csv}):")
        print(f"  ROC AUC: {results['train_new']['roc_auc']:.4f}")
        print(f"  PR AUC:  {results['train_new']['pr_auc']:.4f}")
        print(f"  F1:      {results['train_new']['f1_score']:.4f}")
    
    if "test_new" in results:
        print(f"\nTest Set ({args.test_csv}):")
        print(f"  ROC AUC: {results['test_new']['roc_auc']:.4f}")
        print(f"  PR AUC:  {results['test_new']['pr_auc']:.4f}")
        print(f"  F1:      {results['test_new']['f1_score']:.4f}")
    
    # Save results to JSON
    results_path = model_dir / "evaluation_results_new_data.json"
    with open(results_path, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\n✓ Detailed results saved to {results_path}")
    
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


