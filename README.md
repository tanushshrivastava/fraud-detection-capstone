# Fraud Detection Capstone

Fraud Detection Capstone is an end-to-end project that trains a machine learning model to flag suspicious credit-card transactions and serves the predictions through a web application and an AWS Lambda backend. This repository contains everything from data preparation and model training to infrastructure-as-code for deploying the service.

## Repository Layout
- `model/` – Python training, inference, and utility scripts plus the serialized `model.joblib`.
- `backend/` – Java 17 AWS Lambda project packaged with Gradle (`buildLambda` task produces `fraud-backend.jar`).
- `frontend/` – React single-page application that calls the backend for real-time fraud probability.
- `cdk/` – AWS CDK stacks used to provision SageMaker, Lambda, and supporting infrastructure.
- `fraudTrain.csv` – **Not committed**. Download this dataset separately (see below) before training.

## Prerequisites
- Python 3.10+ with `pip` and the ability to create virtual environments.
- Node.js 18+ and `npm` (or `yarn`) for the React app.
- Java 17 and Gradle 8+ for building the Lambda package.
- AWS CLI v2, AWS CDK v2, and an AWS account (for deployment/testing in the cloud).

## Get the Dataset
1. Sign in to Kaggle and open the dataset: <https://www.kaggle.com/datasets/kartik2112/fraud-detection>.
2. Accept the terms and download `fraudTrain.csv`.
3. Place the file at the repository root or inside `model/` before running any training scripts. The default path expected by `model/train.py` is the current working directory, so running the script from `model/` with the CSV in that folder works out of the box.

## Model Workflow (`model/`)
```bash
cd model
python -m venv .venv
source .venv/bin/activate            # On Windows use: .venv\Scripts\activate
pip install pandas numpy scikit-learn joblib
python train.py                      # Reads fraudTrain.csv and writes model.joblib
```
After training, `model.joblib` can be uploaded to SageMaker or packaged with the Lambda. To smoke test locally, open `inference.py` and adapt it for your environment, or use `test_script.py` against a deployed SageMaker endpoint (requires AWS credentials and an active endpoint named `fraud-detector-endpoint`).

## Backend Lambda (`backend/`)
```bash
cd backend
gradle buildLambda                   # Produces build/libs/fraud-backend.jar
```
Deploy the JAR to AWS Lambda or reference it from your CDK stack. The handler class is `com.fraud.lambda.FraudLambdaHandler`, and it expects requests that mirror the features engineered in `model/preprocess`.

## Frontend (`frontend/`)
```bash
cd frontend
npm install
npm start                            # Runs the React dev server on http://localhost:3000
```
Set any required environment variables (e.g., API base URLs) in `.env` files following Create React App conventions.

### Connect the Frontend to Your API
After the first CDK deploy, note the API Gateway invoke URL that looks like `https://<api-id>.execute-api.<region>.amazonaws.com/prod`. Replace the hard-coded endpoint in `frontend/src/App.js` (or read it from `REACT_APP_API_URL` via `.env`) with this value so the React app talks to your deployed Lambda. Repeat whenever you promote to a new stage or region.

- Local development: run `npm start` and browse to `http://localhost:3000`; the UI will call whatever endpoint you configured.
- Hosted deployment: run `npm run build` and upload the `build/` directory to S3/CloudFront (or any static host) while ensuring the API URL points at the live stage.

## Infrastructure (`cdk/`)
```bash
cd cdk
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt      # If present; otherwise install CDK libs manually
cdk bootstrap
cdk deploy
```
Adjust stack parameters so that the Lambda points to the correct model artifact and endpoint configuration.

## Testing 
```
When you are done testing, please go to /cdk and run cdk destroy --all and enter 'y' to save credits

example JSON to use:

{
  "trans_date_trans_time": "2020-06-21 22:37:27",
  "cc_num": "6564459919350820",
  "merchant": "fraud_Nienow PLC",
  "category": "entertainment",
  "amt": 620.33,
  "first": "Douglas",
  "last": "Willis",
  "gender": "M",
  "street": "619 Jeremy Garden Apt. 681",
  "city": "Benton",
  "state": "WI",
  "zip": 53803,
  "lat": 42.5545,
  "long": -90.3508,
  "city_pop": 1306,
  "job": "Public relations officer",
  "dob": "1958-09-10",
  "trans_num": "47a9987ae81d99f7832a54b29a77bf4b",
  "unix_time": 1371854247,
  "merch_lat": 42.771834000000005,
  "merch_long": -90.158365
}
```