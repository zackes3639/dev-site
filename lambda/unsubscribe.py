import json
import os
import hmac
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
        body = event.get("body") or "{}"
        if isinstance(body, str):
            try:
                body = json.loads(body)
            except json.JSONDecodeError:
                return {
                    "statusCode": 400,
                    "headers": HEADERS,
                    "body": json.dumps({"message": "Invalid request body"})
                }
        if not isinstance(body, dict):
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({"message": "Invalid request body"})
            }

        email = (body.get("email") or "").strip().lower()
        token = (body.get("token") or "").strip()

        if not email:
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({"message": "Email is required"})
            }
        if not token:
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({"message": "Unsubscribe token is required"})
            }

        subscriber_id = f"email#{email}"
        existing = table.get_item(Key={"subscriber_id": subscriber_id}).get("Item")
        stored_token = (existing or {}).get("unsubscribe_token", "")

        if not stored_token or not hmac.compare_digest(str(stored_token), token):
            return {
                "statusCode": 403,
                "headers": HEADERS,
                "body": json.dumps({"message": "Invalid unsubscribe link"})
            }

        now = datetime.now(timezone.utc).isoformat()

        table.update_item(
            Key={"subscriber_id": subscriber_id},
            UpdateExpression="SET #s = :inactive, unsubscribed_at = :ts, updated_at = :ts",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":inactive": "inactive",
                ":ts": now
            }
        )

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps({"message": "Unsubscribed successfully"})
        }

    except Exception as e:
        print(f"unsubscribe lambda error: {e}")
        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({"message": "Internal server error"})
        }
