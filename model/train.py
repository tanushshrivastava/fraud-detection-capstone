from pathlib import Path

import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.metrics import roc_auc_score, classification_report, confusion_matrix
from sklearn.ensemble import HistGradientBoostingClassifier

from common import FEATURE_COLUMNS, prepare_training_features

CSV_PATH = Path(__file__).resolve().parent / "synthetic_dataset_v4.csv"


def main():
    df = pd.read_csv(CSV_PATH)

    print("Class balance:\n", df["is_fraud"].value_counts(normalize=True))

    # Map dataset_v4 fields into the simplified feature set
    if "distance_km" not in df and "distance_from_home" in df:
        df["distance_km"] = df["distance_from_home"]
    if "merchant_risk" not in df and "is_known_merchant" in df:
        df["merchant_risk"] = 1 - df["is_known_merchant"]
    features = prepare_training_features(df)
    X = features[FEATURE_COLUMNS]
    y = df["is_fraud"]

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, stratify=y, test_size=0.2, random_state=42
    )

    numeric_features = ["amount", "distance_km", "merchant_risk", "is_night", "hour"]
    categorical_features = ["category"]

    numeric_transformer = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
        ]
    )

    categorical_transformer = Pipeline(
        steps=[
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
        ]
    )

    clf = HistGradientBoostingClassifier(
        max_depth=8,
        learning_rate=0.05,
        max_iter=500,
        class_weight="balanced",
        random_state=42,
    )

    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", clf),
        ]
    )

    model.fit(X_train, y_train)

    # Evaluation
    probs = model.predict_proba(X_test)[:, 1]
    preds = model.predict(X_test)

    auc = roc_auc_score(y_test, probs)
    print("ROC AUC:", auc)
    print("\nClassification report:\n", classification_report(y_test, preds))
    print("Confusion matrix:\n", confusion_matrix(y_test, preds))

    joblib.dump(model, "model.joblib")
    print("Saved model.joblib")


if __name__ == "__main__":
    main()
