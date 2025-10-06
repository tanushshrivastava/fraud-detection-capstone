import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score
import joblib

df = pd.read_csv("fraudTrain.csv")

df["trans_date_trans_time"] = pd.to_datetime(df["trans_date_trans_time"])
df["dob"] = pd.to_datetime(df["dob"])
df["hour"] = df["trans_date_trans_time"].dt.hour
df["dow"] = df["trans_date_trans_time"].dt.dayofweek
df["age"] = ((datetime.now() - df["dob"]).dt.days / 365.25).astype(int)

target = "is_fraud"
y = df[target]
X = df.drop(columns=[target, "trans_num"])

numeric_features = ["amt", "lat", "long", "city_pop", "merch_lat", "merch_long", "hour", "age", "dow"]
categorical_features = ["merchant", "category", "gender", "state", "job"]

numeric_transformer = Pipeline([("scaler", StandardScaler())])
categorical_transformer = Pipeline([("onehot", OneHotEncoder(handle_unknown="ignore"))])

preprocessor = ColumnTransformer([
    ("num", numeric_transformer, numeric_features),
    ("cat", categorical_transformer, categorical_features)
])

clf = Pipeline([
    ("preprocessor", preprocessor),
    ("classifier", RandomForestClassifier(n_estimators=100, class_weight="balanced", n_jobs=-1))
])

X_train, X_test, y_train, y_test = train_test_split(X, y, stratify=y, test_size=0.2, random_state=42)
clf.fit(X_train, y_train)

print("ROC AUC:", roc_auc_score(y_test, clf.predict_proba(X_test)[:, 1]))

joblib.dump(clf, "model.joblib", compress=3)
