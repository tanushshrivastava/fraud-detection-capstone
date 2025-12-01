import joblib
import pandas as pd
from sklearn.metrics import accuracy_score, roc_auc_score

from common import FEATURE_COLUMNS, prepare_training_features

# 1. Load model
model = joblib.load("model.joblib")

# 2. Load your test data
df = pd.read_csv("fraudTest.csv")

# 3. Engineer features to match training
features = prepare_training_features(df)
y_test = df["is_fraud"]
X_test = features[FEATURE_COLUMNS]

# 4. Predict
y_pred = model.predict(X_test)
y_proba = model.predict_proba(X_test)[:, 1]

# 5. Compute metrics
acc = accuracy_score(y_test, y_pred)
roc = roc_auc_score(y_test, y_proba)
print("Accuracy:", acc)
print("ROC AUC:", roc)
