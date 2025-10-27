# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a fraud detection system that trains a RandomForest ML model to predict fraudulent credit card transactions. The system consists of:
- Python model training pipeline (scikit-learn)
- Java 17 AWS Lambda backend with SageMaker integration
- React frontend SPA
- AWS CDK infrastructure-as-code (Java)
- Optional Twilio SMS fraud alerts

## Development Commands

### Model Training
```bash
cd model
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install numpy==1.26.4 pandas==2.2.2 scikit-learn==1.2.2 joblib==1.3.2
python train.py  # Outputs to artifacts/<stack-name>/model.tar.gz
```

### Backend (Lambda)
```bash
cd backend
gradle buildLambda  # Produces build/libs/fraud-backend.jar
gradle test         # Run tests (if any)
```

### Frontend (React)
```bash
cd frontend
npm install
npm start    # Dev server on http://localhost:3000
npm test     # Run Jest tests
npm run build  # Production build to build/
```

### Infrastructure (CDK)
```bash
cd cdk
cdk bootstrap  # One-time per AWS account/region
cdk synth      # Preview CloudFormation
cdk deploy --all  # Deploy all stacks
cdk destroy --all  # Tear down infrastructure
```

## Architecture

### High-Level Data Flow
```
React UI → API Gateway → Lambda → SageMaker Endpoint (fraud score)
                              ↓
                         DynamoDB (persist) + Twilio (SMS alerts if score ≥ threshold)
```

### Stack Dependencies
The CDK app deploys 5 stacks with dependencies:
```
FraudEndpointStack (SageMaker) ──┐
                                 ├──→ FraudLambdaStack ──→ FraudApiStack
FraudDataStack (DynamoDB) ───────┘

FraudFrontendStack (S3/CloudFront, independent)
```

### Stack Suffix System
The `STACK_SUFFIX` environment variable enables multiple deployments in the same account:
- Set `STACK_SUFFIX=dev` to create `FraudLambdaStack-dev`, `FraudDataStack-dev`, etc.
- All resource names include suffix: `fraudbackendstack-dev-endpoint`, `fraudbackendstack-dev-transactions`
- Model artifacts use suffix in S3 key: `user-FraudBackendStack-dev/model.tar.gz`

Training scripts (`model/train.py`) and Lambda both resolve stack name from `STACK_SUFFIX` to locate the correct artifacts.

### Backend Lambda Architecture

**FraudLambdaHandler.java** (main handler) routes requests:
- `POST /accounts` - Create account with password hash, phone number, fraud threshold (0.0-1.0)
- `POST /login` - Authenticate with accountId + password
- `POST /transactions` or `POST /` - Main fraud detection endpoint
- `POST /webhook/twilio` - Handle SMS confirmations (YES/NO)

**Transaction Flow:**
1. Validate accountId exists in DynamoDB Accounts table
2. Send transaction JSON to SageMaker endpoint
3. Extract fraud_probability from flexible response formats (handles `{score: x}`, `{predictions: [x]}`, or raw number)
4. Persist transaction to DynamoDB Transactions table
5. If score ≥ account.fraudThreshold AND Twilio configured, send SMS alert
6. Return prediction to caller

**TwilioService.java** handles SMS:
- Lazy initialization with graceful degradation if env vars not set
- Sends fraud alert: "FRAUD ALERT! Score: {percentage}%"
- Parses YES/NO confirmations from inbound SMS

### SageMaker Model Details

**Training** (`model/train.py`):
- Reads `fraudTrain.csv` (not in repo, download from Kaggle)
- Engineers features: hour, day-of-week, age from transaction timestamp/DOB
- Pipeline: StandardScaler (numeric) + OneHotEncoder (categorical) → RandomForestClassifier
- Outputs: `artifacts/<stack-name>/model.tar.gz` with model.joblib + inference.py

**Inference** (`model/inference.py`):
- SageMaker entry points: `model_fn`, `input_fn`, `predict_fn`, `output_fn`
- Recreates engineered features at inference time
- Returns `{"fraud_probability": <score>}`

**Deployment:**
1. Upload model.tar.gz to S3: `s3://trained-data-<account>-<region>/user-<stack-name>/model.tar.gz`
2. FraudEndpointStack creates SageMaker Model pointing to S3 artifact
3. Creates endpoint config (ml.t2.medium) and endpoint
4. Lambda reads endpoint name from `SAGEMAKER_ENDPOINT_NAME` environment variable

### Frontend-Backend Integration

**API Configuration Resolution** (frontend/.env or process env):
1. If `REACT_APP_API_URL` set, use it directly
2. Else construct from `REACT_APP_API_ID` + `REACT_APP_API_REGION` + `REACT_APP_API_STAGE` (default: "prod")
3. Example: `https://<api-id>.execute-api.us-east-1.amazonaws.com/prod`

**Risk Score Extraction:**
Frontend has flexible parsing to handle various SageMaker output formats:
- Checks payload.prediction first
- Recursively searches for keys: score, fraudScore, fraud_probability, probability, risk
- Handles arrays, objects, primitives

**Risk Levels:**
- 0.0–0.3: Low (green)
- 0.4–0.7: Medium (yellow)
- 0.8–1.0: High (red)

### Environment Configuration Pattern

Three-tier priority:
1. **Process environment** (highest) - `export AWS_ACCOUNT_ID=...`
2. **.env file** (medium) - `.env` at repo root
3. **Hard-coded defaults** (lowest)

**Java:** `EnvConfig` class loads .env with upward directory search
**Python:** `cdk_utils.py` and `env_utils.py` with same logic
**React:** Create React App's `REACT_APP_*` convention

## Required Environment Variables

### Core (all components read these)
- `AWS_ACCOUNT_ID` - AWS account number (e.g., 123456789012)
- `AWS_REGION` - AWS region (e.g., us-east-1)
- `STACK_SUFFIX` - Optional suffix for multi-environment deployments (e.g., "dev", "staging")

### Model & CDK
- `MODEL_OBJECT_KEY` - Optional S3 key override (default: `user-<stack>/model.tar.gz`)
- `SAGEMAKER_EXECUTION_ROLE_ARN` or `SAGEMAKER_EXECUTION_ROLE_NAME` - Optional, creates new role if not set
- `SAGEMAKER_IMAGE_URI` - Optional, defaults to scikit-learn 1.2-1 container
- `SAGEMAKER_ENDPOINT_NAME` - Optional, defaults to `<stack>-endpoint`

### Lambda Runtime
- `SAGEMAKER_ENDPOINT_NAME` - Auto-set by FraudLambdaStack from endpoint stack output
- `ACCOUNTS_TABLE_NAME` - Auto-set from data stack output
- `TRANSACTION_TABLE_NAME` - Auto-set from data stack output
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - Optional, enables SMS alerts if all present

### Frontend
- `REACT_APP_API_URL` - Full API URL (override), OR
- `REACT_APP_API_ID` + `REACT_APP_API_REGION` + `REACT_APP_API_STAGE` - Construct URL from parts

## Deployment Sequence

1. **Train Model:**
   ```bash
   cd model
   python train.py  # Creates artifacts/<stack>/model.tar.gz
   ```

2. **Upload to S3:**
   ```bash
   STACK_NAME="FraudBackendStack${STACK_SUFFIX:+-$STACK_SUFFIX}"
   aws s3 mb s3://trained-data-${AWS_ACCOUNT_ID}-${AWS_REGION}  # One-time
   aws s3 cp model/artifacts/$STACK_NAME/model.tar.gz \
     s3://trained-data-${AWS_ACCOUNT_ID}-${AWS_REGION}/user-${STACK_NAME}/model.tar.gz
   ```

3. **Build Backend:**
   ```bash
   cd backend
   gradle buildLambda
   ```

4. **Deploy Infrastructure:**
   ```bash
   cd cdk
   cdk deploy --all
   # Note API Gateway ID from output
   ```

5. **Configure & Build Frontend:**
   ```bash
   cd frontend
   # Update .env with REACT_APP_API_ID from CDK output
   npm run build
   ```

6. **Deploy Frontend:**
   ```bash
   cd cdk
   cdk deploy FraudFrontendStack  # Or FraudFrontendStack-<suffix>
   ```

## SageMaker Endpoint Management

After testing, stop endpoint to save costs:
```bash
aws sagemaker delete-endpoint --endpoint-name fraudbackendstack-{suffix}-endpoint
```

Restart endpoint when needed:
```bash
aws sagemaker create-endpoint \
  --endpoint-name fraudbackendstack-{suffix}-endpoint \
  --endpoint-config-name fraudbackendstack-{suffix}-endpoint-config
```

## Testing

### Example Transaction JSON
```json
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

### Testing with cURL
```bash
# Create account
curl -X POST https://<api-id>.execute-api.<region>.amazonaws.com/prod/accounts \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","address":"123 Main St","needs":"banking","password":"test123","phoneNumber":"+15551234567","smsOptIn":true,"fraudThreshold":0.7}'

# Login
curl -X POST https://<api-id>.execute-api.<region>.amazonaws.com/prod/login \
  -H "Content-Type: application/json" \
  -d '{"accountId":"<account-id>","password":"test123"}'

# Submit transaction
curl -X POST https://<api-id>.execute-api.<region>.amazonaws.com/prod/transactions \
  -H "Content-Type: application/json" \
  -d '{"accountId":"<account-id>","transaction":{...transaction JSON...}}'
```

## Key File References

### Lambda Handler
- `backend/src/main/java/com/fraud/lambda/FraudLambdaHandler.java:572` - Main request handler
- `backend/src/main/java/com/fraud/lambda/FraudLambdaHandler.java:295` - handleTransaction() method
- `backend/src/main/java/com/fraud/lambda/TwilioService.java` - SMS notification service

### CDK Stacks
- `cdk/src/main/java/com/fraud/cdk/AppMain.java` - Stack orchestration
- `cdk/src/main/java/com/fraud/cdk/FraudEndpointStack.java` - SageMaker provisioning
- `cdk/src/main/java/com/fraud/cdk/FraudLambdaStack.java` - Lambda deployment
- `cdk/src/main/java/com/fraud/cdk/FraudDataStack.java` - DynamoDB tables

### Model Training
- `model/train.py` - Training pipeline
- `model/inference.py` - SageMaker entry points
- `model/common.py` - Shared feature definitions

### Frontend
- `frontend/src/App.js` - Main React app with routing
- `frontend/src/components/HomePage.js:852` - Transaction submission UI
- `frontend/src/components/HomePage.js:12-22` - API URL configuration

## Common Patterns

### Adding a New Feature to Transaction Processing

1. Update `model/common.py` with new feature in CATEGORICAL or NUMERIC_BASE
2. Update `model/train.py` to include feature in training data
3. Retrain model: `cd model && python train.py`
4. Upload new model.tar.gz to S3
5. Redeploy endpoint: `cd cdk && cdk deploy FraudEndpointStack`
6. Update frontend form in `frontend/src/components/HomePage.js` if field is user-facing
7. No Lambda changes needed (forwards all fields to SageMaker)

### Adding a New API Endpoint

1. Add route handling in `backend/src/main/java/com/fraud/lambda/FraudLambdaHandler.java:handleRequest()`
2. Create handler method (e.g., `handleNewEndpoint()`)
3. Rebuild Lambda: `cd backend && gradle buildLambda`
4. Redeploy: `cd cdk && cdk deploy FraudLambdaStack`
5. Update frontend to call new endpoint

### Changing Stack Suffix (e.g., dev → prod)

1. Update `.env`: `STACK_SUFFIX=prod`
2. Retrain model (creates artifacts/FraudBackendStack-prod/)
3. Upload to new S3 prefix: `user-FraudBackendStack-prod/model.tar.gz`
4. Deploy all stacks: `cd cdk && cdk deploy --all`
5. Update frontend `.env` with new API ID
6. Rebuild and redeploy frontend

## Dataset

The training data (`fraudTrain.csv`) is NOT in the repository. Download from:
https://www.kaggle.com/datasets/kartik2112/fraud-detection

Place in `model/` directory before running `train.py`.
