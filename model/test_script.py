import boto3, json

runtime = boto3.client("sagemaker-runtime", region_name="us-east-1")

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

response = runtime.invoke_endpoint(
    EndpointName="fraud-detector-endpoint",
    ContentType="application/json",
    Body=json.dumps(sample)
)

print(json.loads(response["Body"].read().decode()))
