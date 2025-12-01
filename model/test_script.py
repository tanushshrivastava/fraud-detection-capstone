import json
import os

import boto3

from env_utils import get_env, sagemaker_resource_name


def resolve_endpoint_name() -> str:
    env_override = os.environ.get("SAGEMAKER_ENDPOINT_NAME") or get_env("SAGEMAKER_ENDPOINT_NAME", expand=True)
    if env_override:
        return env_override
    return sagemaker_resource_name("endpoint")


def resolve_region() -> str:
    return os.environ.get("AWS_REGION") or get_env("AWS_REGION") or "us-east-1"


def main() -> None:
    runtime = boto3.client("sagemaker-runtime", region_name=resolve_region())

    sample = {
        "amount": 420.75,
        "merchant": "fraud_LosAlamos",
        "category": "electronics",
        "state": "CA",
        "lat": 37.7749,
        "long": -122.4194,
        "merch_lat": 34.0522,
        "merch_long": -118.2437,
        "trans_date_trans_time": "2024-03-15 23:45:10",
    }

    endpoint_name = resolve_endpoint_name()
    response = runtime.invoke_endpoint(
        EndpointName=endpoint_name,
        ContentType="application/json",
        Body=json.dumps(sample),
    )

    print(f"Invoked endpoint {endpoint_name}")
    print(json.loads(response["Body"].read().decode()))


if __name__ == "__main__":
    main()
