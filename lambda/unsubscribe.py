import json
import os
import boto3
from datetime import datetime, timezone

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://zacksimon.dev",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS"
}

def lambda_handler(event, context):
    method = (
        event.get("httpMethod")
        or event.get("requestContext", {}).get("http", {}).get("method", "")
    )

    if method == "OPTIONS":
        return {"statusCode": 204, "headers": HEADERS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
        email = (body.get("email") or "").strip().lower()

        if not email:
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({"message": "Email is required"})
            }

        subscriber_id = f"email#{email}"

        table.update_item(
            Key={"subscriber_id": subscriber_id},
            UpdateExpression="SET #s = :inactive, unsubscribed_at = :ts",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":inactive": "inactive",
                ":ts": datetime.now(timezone.utc).isoformat()
            }
        )

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps({"message": "Unsubscribed successfully"})
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({"message": "Error", "error": str(e)})
        }
