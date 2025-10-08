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
