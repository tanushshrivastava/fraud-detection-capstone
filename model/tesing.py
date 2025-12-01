import json
import boto3

ENDPOINT_NAME = "fraudbackendstack-newmodels-endpoint"  # change if needed
REGION = "us-east-1"

payload = {
    "transaction": {
        "amount": 20000000.75,
        "merchant": "Target",
        "category": "retail",
        "distance_from_home": 18.5,
        "is_known_merchant": 1,
        "is_night": 1,
        "hour": 14,
    }
}

def main():
    runtime = boto3.client("sagemaker-runtime", region_name=REGION)
    resp = runtime.invoke_endpoint(
        EndpointName=ENDPOINT_NAME,
        ContentType="application/json",
        Body=json.dumps(payload),
    )
    body = resp["Body"].read().decode()
    print(f"Endpoint: {ENDPOINT_NAME}")
    print(body)

if __name__ == "__main__":
    main()
