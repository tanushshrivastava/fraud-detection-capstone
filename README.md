# Fraud Detection Capstone

Fraud Detection Capstone is an end-to-end project that trains a machine learning model to flag suspicious credit-card transactions and serves the predictions through a web application and an AWS Lambda backend. This repository contains everything from data preparation and model training to infrastructure-as-code for deploying the service.

## Repository Layout
- `model/` – Python training, inference, and utility scripts plus stack-scoped artifacts under `artifacts/<stack-name>/`.
- `backend/` – Java 17 AWS Lambda project packaged with Gradle (`buildLambda` task produces `fraud-backend.jar`).
- `frontend/` – React single-page application that calls the backend for real-time fraud probability.
- `cdk/` – AWS CDK stacks used to provision SageMaker, Lambda, and supporting infrastructure.
- `fraudTrain.csv` – **Not committed**. Download this dataset separately (see below) before training.

## Prerequisites
- Python 3.9 with `pip` and the ability to create virtual environments.
- Node.js 18+ and `npm` (or `yarn`) for the React app.
- Java 17 and Gradle 8+ for building the Lambda package.
- AWS CLI v2 and AWS CDK v2.
- An AWS account with a developer IAM user (or temporary credentials) that can assume the project role and provision resources (SageMaker, Lambda, API Gateway, DynamoDB, S3, CloudFront).

## Get the Dataset
1. Sign in to Kaggle and open the dataset: <https://www.kaggle.com/datasets/kartik2112/fraud-detection>.
2. Accept the terms and download `fraudTrain.csv`.
3. Place the file at the repository root or inside `model/` before running any training scripts. The default path expected by `model/train.py` is the current working directory, so running the script from `model/` with the CSV in that folder works out of the box.

## Model Workflow (`model/`)
```bash
cd model
python -m venv .venv
source .venv/bin/activate            # On Windows use: .venv\Scripts\activate
pip install --upgrade pip setuptools
pip install numpy==1.26.4 pandas==2.2.2 scikit-learn==1.2.2 joblib==1.3.2 xgboost==2.0.3
python train.py                      # Reads fraudTrain.csv and writes artifacts/model.tar.gz for your stack
```

> ℹ️ Run `pip show numpy` (and the others) if you want to verify the pinned versions before training.

After training, stack-aware assets land in `model/artifacts/<stack-name>/` (`model.joblib`, `metadata.json`, and `model.tar.gz` that bundles inference code). `model/test_script.py` automatically resolves the matching SageMaker endpoint name based on your `.env` configuration, so you can sanity-check local predictions against the deployed endpoint later.

## Backend Lambda (`backend/`)
```bash
cd backend
gradle buildLambda                   # Produces build/libs/fraud-backend.jar
```

## Frontend (`frontend/`)
```bash
cd frontend
npm install
npm start                            # Runs the React dev server on http://localhost:3000
```
Set any required environment variables (e.g., API base URLs) in `.env` files following Create React App conventions.

### Connect the Frontend to Your API
After the first CDK deploy, note the API Gateway invoke URL that looks like `https://<api-id>.execute-api.<region>.amazonaws.com/prod`. Populate either `REACT_APP_API_URL` or the trio `REACT_APP_API_ID`, `REACT_APP_API_REGION`, and optional `REACT_APP_API_STAGE` in `frontend/.env` so the React app targets the correct backend without source changes. Update these when you promote to a new stage or region.

- Local development: run `npm start` and browse to `http://localhost:3000`; the UI will call whatever endpoint you configured.
- Hosted deployment: run `npm run build` and upload the `build/` directory to S3/CloudFront (or any static host) while ensuring the API URL points at the live stage.

## Deployment Guide

The backend infrastructure now assumes you keep model artifacts in a shared S3 bucket and only varies by stack name. Follow the sequence below when standing up a new environment.

### 1. Authenticate with AWS
1. Sign in to the correct AWS account in the console and create (or locate) an IAM user/role with the necessary permissions. Record the access key ID and secret key, or prepare to assume-role with SSO.
2. Configure the AWS CLI locally:
   ```bash
   aws configure
   # AWS Access Key ID [None]: <your key>
   # AWS Secret Access Key [None]: <your secret>
   # Default region name [None]: us-east-1   # or the region you plan to use
   # Default output format [None]: json
   ```
3. Verify with `aws sts get-caller-identity`.

### 2. Populate `.env`
Update the repository root `.env` with values that match your AWS profile:

```dotenv
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-east-1
STACK_SUFFIX=myname            # optional; used to create unique stack/resource names

REACT_APP_API_ID=xxxxxxxxxx    # fill in after the first deploy, or leave blank until then
REACT_APP_API_REGION=us-east-1
REACT_APP_API_STAGE=prod
```

- `STACK_SUFFIX` is automatically appended to every stack (`FraudEndpointStack-<suffix>`, etc.) and drives the `user-<stack>` prefix for model artifacts.
- The SageMaker execution role ARN is derived automatically from the account and region; you do **not** need to edit it unless you use a custom role name.

### 3. Prepare the Trained Model Artifact
The SageMaker model expects to download `model.tar.gz` from the shared bucket `trained-data-<account>-<region>`, under `user-<FraudBackendStack[Suffix]>/model.tar.gz`.

1. Run the training pipeline (see [Model Workflow](#model-workflow-model)) so you have an up-to-date `model.tar.gz`.
2. Create the bucket once (only if it does not exist):
   ```bash
   aws s3 mb s3://trained-data-${AWS_ACCOUNT_ID}-${AWS_REGION}
   ```
3. Create the prefix (“folder”) for your stack and upload the artifact:
   ```bash
   STACK_NAME="FraudBackendStack${STACK_SUFFIX:+-$STACK_SUFFIX}"

   # Create the logical folder (no-op if it already exists)
   aws s3api put-object \
     --bucket trained-data-${AWS_ACCOUNT_ID}-${AWS_REGION} \
     --key user-${STACK_NAME}/

   # Upload the trained model tarball
   aws s3 cp model/artifacts/$STACK_NAME/model.tar.gz \
     s3://trained-data-${AWS_ACCOUNT_ID}-${AWS_REGION}/user-${STACK_NAME}/model.tar.gz
   ```
4. If you opt to use a different key name, set `MODEL_OBJECT_KEY` in `.env` before deploying (example: `MODEL_OBJECT_KEY=my/custom/path/model.tar.gz`).

### 4. Build Artifacts
- **Lambda**: `cd backend && gradle buildLambda`
- **Frontend** (optional before deploy, required before static hosting): `cd frontend && npm run build`

### 5. Deploy Infrastructure
```bash
cd cdk
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt      # if a requirements file exists
cdk bootstrap                        # run once per environment
cdk deploy --all
```

The CDK app synthesises four stacks: endpoint (SageMaker), data (DynamoDB), lambda, and API Gateway. Because the endpoint stack imports the shared bucket, deployment will **not** fail if the bucket already exists, but you must ensure the trained artifact is in place before calling the endpoint.

### 6. Update Frontend Configuration
After `cdk deploy`, note the `ApiEndpoint` output or the REST API ID. Populate the frontend environment variables (already sourced from `.env`) with the new values:

```dotenv
REACT_APP_API_ID=<rest-api-id-from-cdk>
REACT_APP_API_REGION=<region>
REACT_APP_API_STAGE=prod        # or whatever stage you chose
REACT_APP_API_URL=https://<rest-api-id>.execute-api.<region>.amazonaws.com/<stage>
```

Rebuild if you plan to host the SPA or want to run the optimized bundle locally:

```bash
cd frontend
npm run build
```

### 7. Smoke Test
Send the sample JSON (see [Testing](#testing)) through the API using `curl`, Postman, or the React UI. Confirm the Lambda logs in CloudWatch show successful invocations and the DynamoDB table receives entries if you turn on persistence.

### 8. Tear Down (when finished)
Destroy the stacks to conserve AWS credit:
```bash
cd cdk
cdk destroy --all
```

Buckets and artifacts are not deleted automatically when you destroy stacks, so clean them up manually if they are no longer needed:

```bash
aws s3 rm s3://trained-data-${AWS_ACCOUNT_ID}-${AWS_REGION}/ \
  --recursive --exclude "*" --include "user-${STACK_NAME}/*"
```

## Testing 
```
When you are done testing, please run aws sagemaker delete-endpoint --endpoint-name fraudbackendstack-{suffix}-endpoint to delete the endpoint

you can restart it by running aws sagemaker create-endpoint \
  --endpoint-name fraudbackendstack-{suffix}-endpoint \
  --endpoint-config-name fraudbackendstack-{suffix}-endpoint-config

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


### 9. Deploy to AWS From Git

Create in root ".github/workflow/deploy.yml"
```
name: Deploy CDK

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Install AWS CDK CLI
        run: npm install -g aws-cdk@2

      - name: Build Lambda package
        run: |
          cd backend
          if [ -f gradlew ]; then
            chmod +x gradlew
            ./gradlew buildLambda
          else
            gradle buildLambda
          fi

      - name: Build frontend
        env:
          REACT_APP_API_ID: ${{ secrets.REACT_APP_API_ID }}
          REACT_APP_API_REGION: ${{ secrets.REACT_APP_API_REGION }}
          REACT_APP_API_STAGE: ${{ secrets.REACT_APP_API_STAGE }}
        run: |
          cd frontend
          npm ci
          npm run build

      - name: Deploy CDK
        env:
          AWS_ACCOUNT_ID: ${{ secrets.AWS_ACCOUNT_ID }}
          AWS_REGION: ${{ secrets.AWS_REGION }}
          STACK_SUFFIX: ${{ secrets.STACK_SUFFIX || '' }}
          MODEL_OBJECT_KEY: ${{ secrets.MODEL_OBJECT_KEY || '' }}
        run: |
          cd cdk
          cdk deploy --all --require-approval never
```

Fill in each secret defined in the deploy.yml file