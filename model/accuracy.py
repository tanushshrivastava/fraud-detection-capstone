from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, roc_auc_score
from sklearn.model_selection import train_test_split

from common import FEATURE_COLUMNS, prepare_training_features

MODEL_PATH = Path("model.joblib")
DATA_CSV = "synthetic_dataset_v4.csv"
TEST_SIZE = 0.2
RANDOM_STATE = 42


def load_model():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Expected {MODEL_PATH} to exist; run train_new.py first.")
    return joblib.load(MODEL_PATH)


def main():
    model = load_model()
    df = pd.read_csv(DATA_CSV)

    features = prepare_training_features(df)
    y = df["is_fraud"]
    X = features[FEATURE_COLUMNS]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, stratify=y, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )

    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    roc = roc_auc_score(y_test, y_proba)

    print(f"Data: {DATA_CSV}")
    print(f"Samples: train={len(y_train)}, test={len(y_test)}")
    print("Accuracy:", acc)
    print("ROC AUC:", roc)
    print("\nClassification report:")
    print(classification_report(y_test, y_pred))
    print("Confusion matrix:")
    print(confusion_matrix(y_test, y_pred))


if __name__ == "__main__":
    main()
