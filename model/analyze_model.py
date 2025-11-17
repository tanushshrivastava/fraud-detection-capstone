"""Analyze the fraud detection model to understand how it makes predictions."""

import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score, average_precision_score


def load_model(model_path: Path):
    """Load the trained model from disk."""
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found at {model_path}")
    return joblib.load(model_path)


def preprocess_data(df: pd.DataFrame):
    """Apply the same preprocessing as in train.py."""
    df = df.copy()
    
    df["trans_date_trans_time"] = pd.to_datetime(df["trans_date_trans_time"])
    df["dob"] = pd.to_datetime(df["dob"])
    df["hour"] = df["trans_date_trans_time"].dt.hour
    df["dow"] = df["trans_date_trans_time"].dt.dayofweek
    df["age"] = ((df["trans_date_trans_time"] - df["dob"]).dt.days / 365.25).clip(lower=0)

    amt_clipped = np.clip(df["amt"].values, 1e-6, None)
    df["log_amt"] = np.log(amt_clipped)
    df["is_high_amount"] = (df["amt"] >= 1_000_000).astype(int)
    hour_rad = 2 * np.pi * df["hour"].values / 24.0
    df["hour_sin"] = np.sin(hour_rad)
    df["hour_cos"] = np.cos(hour_rad)
    df["is_night"] = df["hour"].isin([0,1,2,3,4,5,6]).astype(int)
    
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

    y = df["is_fraud"]
    X = df.drop(columns=["is_fraud", "trans_num"])
    
    return X, y


def show_feature_importance(model, numeric_features, categorical_features):
    """Display feature importance from the model."""
    print("\n" + "="*60)
    print("FEATURE IMPORTANCE ANALYSIS")
    print("="*60)
    
    try:
        # Get the preprocessor and classifier
        preprocessor = model.named_steps["preprocessor"]
        classifier = model.named_steps["classifier"]
        
        # Get feature names after preprocessing
        numeric_feature_names = numeric_features
        
        # Get categorical feature names (one-hot encoded)
        try:
            cat_transformer = preprocessor.named_transformers_["cat"]
            if hasattr(cat_transformer, "named_steps"):
                onehot = cat_transformer.named_steps["onehot"]
            else:
                onehot = cat_transformer
            
            if hasattr(onehot, "get_feature_names_out"):
                cat_feature_names = list(onehot.get_feature_names_out(categorical_features))
            else:
                # Fallback for older sklearn versions
                cat_feature_names = []
                for cat_feat in categorical_features:
                    # This is approximate - actual categories depend on training data
                    cat_feature_names.append(f"{cat_feat}_unknown")
        except Exception as e:
            print(f"Warning: Could not extract categorical feature names: {e}")
            cat_feature_names = []
        
        all_feature_names = numeric_feature_names + cat_feature_names
        
        # Get feature importances
        if hasattr(classifier, "feature_importances_"):
            importances = classifier.feature_importances_
            
            # Create importance dataframe
            importance_df = pd.DataFrame({
                "feature": all_feature_names[:len(importances)],
                "importance": importances
            }).sort_values("importance", ascending=False)
            
            print(f"\nTop 20 Most Important Features:")
            print("-" * 60)
            for idx, row in importance_df.head(20).iterrows():
                print(f"  {row['feature']:30s} {row['importance']:10.6f}")
            
            print(f"\nFeature Importance Statistics:")
            print(f"  Total features: {len(importances)}")
            print(f"  Mean importance: {importances.mean():.6f}")
            print(f"  Std importance: {importances.std():.6f}")
            print(f"  Max importance: {importances.max():.6f}")
            print(f"  Min importance: {importances.min():.6f}")
            
            return importance_df
        else:
            print("Model does not have feature_importances_ attribute")
            return None
            
    except Exception as e:
        print(f"Error extracting feature importance: {e}")
        import traceback
        traceback.print_exc()
        return None


def analyze_predictions(model, X, y, dataset_name):
    """Analyze predictions to understand model behavior."""
    print("\n" + "="*60)
    print(f"PREDICTION ANALYSIS: {dataset_name}")
    print("="*60)
    
    y_proba = model.predict_proba(X)[:, 1]
    y_pred = (y_proba >= 0.5).astype(int)
    
    # Analyze fraud vs legitimate predictions
    fraud_mask = y == 1
    legit_mask = y == 0
    
    print(f"\nFraud Cases (Actual):")
    print(f"  Count: {fraud_mask.sum():,}")
    print(f"  Mean predicted probability: {y_proba[fraud_mask].mean():.4f}")
    print(f"  Median predicted probability: {np.median(y_proba[fraud_mask]):.4f}")
    print(f"  Min predicted probability: {y_proba[fraud_mask].min():.4f}")
    print(f"  Max predicted probability: {y_proba[fraud_mask].max():.4f}")
    print(f"  Predicted as fraud: {(y_pred[fraud_mask] == 1).sum():,} ({(y_pred[fraud_mask] == 1).mean()*100:.1f}%)")
    
    print(f"\nLegitimate Cases (Actual):")
    print(f"  Count: {legit_mask.sum():,}")
    print(f"  Mean predicted probability: {y_proba[legit_mask].mean():.4f}")
    print(f"  Median predicted probability: {np.median(y_proba[legit_mask]):.4f}")
    print(f"  Min predicted probability: {y_proba[legit_mask].min():.4f}")
    print(f"  Max predicted probability: {y_proba[legit_mask].max():.4f}")
    print(f"  Predicted as fraud: {(y_pred[legit_mask] == 1).sum():,} ({(y_pred[legit_mask] == 1).mean()*100:.1f}%)")
    
    # Analyze threshold sensitivity
    print(f"\nThreshold Analysis:")
    thresholds = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    print(f"  Threshold | Precision | Recall  | F1")
    print(f"  ----------|-----------|---------|--------")
    for thresh in thresholds:
        y_pred_thresh = (y_proba >= thresh).astype(int)
        tp = ((y_pred_thresh == 1) & (y == 1)).sum()
        fp = ((y_pred_thresh == 1) & (y == 0)).sum()
        fn = ((y_pred_thresh == 0) & (y == 1)).sum()
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        
        print(f"  {thresh:8.2f} | {precision:8.4f} | {recall:6.4f} | {f1:.4f}")


def compare_data_distributions(df_old, df_new, feature_cols):
    """Compare distributions between old and new data."""
    print("\n" + "="*60)
    print("DATA DISTRIBUTION COMPARISON")
    print("="*60)
    
    for col in feature_cols:
        if col not in df_old.columns or col not in df_new.columns:
            continue
            
        old_vals = df_old[col].dropna()
        new_vals = df_new[col].dropna()
        
        if len(old_vals) == 0 or len(new_vals) == 0:
            continue
        
        print(f"\n{col}:")
        print(f"  Old data - Mean: {old_vals.mean():.4f}, Std: {old_vals.std():.4f}, "
              f"Min: {old_vals.min():.4f}, Max: {old_vals.max():.4f}")
        print(f"  New data - Mean: {new_vals.mean():.4f}, Std: {new_vals.std():.4f}, "
              f"Min: {new_vals.min():.4f}, Max: {new_vals.max():.4f}")
        
        # Check if distributions are significantly different
        if old_vals.std() > 0 and new_vals.std() > 0:
            mean_diff = abs(old_vals.mean() - new_vals.mean())
            pooled_std = np.sqrt((old_vals.std()**2 + new_vals.std()**2) / 2)
            if pooled_std > 0:
                effect_size = mean_diff / pooled_std
                if effect_size > 0.5:
                    print(f"  ⚠️  WARNING: Significant difference detected (effect size: {effect_size:.2f})")


def main():
    model_dir = Path(__file__).resolve().parent
    
    # Load model
    model_path = model_dir / "model.joblib"
    model = load_model(model_path)
    print("✓ Model loaded")
    
    # Load new test data
    test_new_path = model_dir / "fraudTest_new.csv"
    print(f"\nLoading {test_new_path}...")
    df_new = pd.read_csv(test_new_path)
    X_new, y_new = preprocess_data(df_new)
    
    # Load original test data for comparison (if available)
    test_old_path = model_dir / "fraudTest.csv"
    df_old = None
    if test_old_path.exists():
        print(f"Loading {test_old_path} for comparison...")
        df_old = pd.read_csv(test_old_path)
        # Preprocess old data
        df_old["trans_date_trans_time"] = pd.to_datetime(df_old["trans_date_trans_time"])
        df_old["dob"] = pd.to_datetime(df_old["dob"])
        df_old["hour"] = df_old["trans_date_trans_time"].dt.hour
        df_old["dow"] = df_old["trans_date_trans_time"].dt.dayofweek
        df_old["age"] = ((df_old["trans_date_trans_time"] - df_old["dob"]).dt.days / 365.25).clip(lower=0)
        amt_clipped_old = np.clip(df_old["amt"].values, 1e-6, None)
        df_old["log_amt"] = np.log(amt_clipped_old)
        df_old["is_high_amount"] = (df_old["amt"] >= 1_000_000).astype(int)
        hour_rad_old = 2 * np.pi * df_old["hour"].values / 24.0
        df_old["hour_sin"] = np.sin(hour_rad_old)
        df_old["hour_cos"] = np.cos(hour_rad_old)
        df_old["is_night"] = df_old["hour"].isin([0,1,2,3,4,5,6]).astype(int)
        lat_old = df_old["lat"].fillna(0).values
        lon_old = df_old["long"].fillna(0).values
        mlat_old = df_old["merch_lat"].fillna(0).values
        mlon_old = df_old["merch_long"].fillna(0).values
        R = 6371.0
        lat1_rad_old = np.radians(lat_old)
        lat2_rad_old = np.radians(mlat_old)
        dlat_rad_old = np.radians(mlat_old - lat_old)
        dlon_rad_old = np.radians(mlon_old - lon_old)
        a_old = (np.sin(dlat_rad_old/2)**2 + 
                np.cos(lat1_rad_old) * np.cos(lat2_rad_old) * np.sin(dlon_rad_old/2)**2)
        c_old = 2 * np.arctan2(np.sqrt(a_old), np.sqrt(1 - a_old))
        df_old["distance_km"] = R * c_old
    
    # Feature importance
    numeric_features = [
        "amt", "log_amt", "is_high_amount", "lat", "long", "city_pop",
        "merch_lat", "merch_long", "distance_km", "hour", "hour_sin",
        "hour_cos", "is_night", "age", "dow",
    ]
    categorical_features = ["merchant", "category", "gender", "state", "job"]
    
    importance_df = show_feature_importance(model, numeric_features, categorical_features)
    
    # Prediction analysis
    analyze_predictions(model, X_new, y_new, "fraudTest_new.csv")
    
    # Compare distributions if old data available
    if df_old is not None:
        compare_data_distributions(df_old, df_new, numeric_features)
    
    # Recommendations
    print("\n" + "="*60)
    print("RECOMMENDATIONS FOR IMPROVEMENT")
    print("="*60)
    print("""
Based on the analysis, here are ways to improve the model:

1. **Retrain on New Data**: The model was trained on different data distributions.
   Consider retraining on the new data or a combination of old + new data.

2. **Adjust Decision Threshold**: The default 0.5 threshold may not be optimal.
   Use the threshold analysis above to find a better balance between precision and recall.

3. **Feature Engineering**: Review the top features and consider:
   - Creating interaction features between important variables
   - Adding more domain-specific features (e.g., transaction velocity, merchant patterns)
   - Normalizing or transforming features differently

4. **Class Imbalance**: With only 0.1% fraud rate, consider:
   - Using different class weights
   - Trying different sampling techniques (SMOTE, undersampling)
   - Using ensemble methods

5. **Model Architecture**: Consider:
   - Trying different algorithms (LightGBM, CatBoost)
   - Ensemble of multiple models
   - Deep learning for complex pattern detection

6. **Data Quality**: Ensure the synthetic data generation captures:
   - Real fraud patterns and relationships
   - Realistic feature distributions
   - Temporal patterns and sequences
    """)


if __name__ == "__main__":
    main()

