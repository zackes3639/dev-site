import json
import os
import re
import secrets
from datetime import datetime, timezone

import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://zacksimon.dev",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS"
}

def normalize_phone(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) == 10:
        return "+1" + digits
    if len(digits) == 11 and digits.startswith("1"):
        return "+" + digits
    if phone.startswith("+") and len(digits) >= 10:
        return "+" + digits
    return ""

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
        phone = (body.get("phone") or "").strip()

        if not email:
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({"message": "Email is required"})
            }

        if email and not EMAIL_RE.match(email):
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({"message": "Invalid email"})
            }

        normalized_phone = ""
        if phone:
            normalized_phone = normalize_phone(phone)
            if not normalized_phone:
                return {
                    "statusCode": 400,
                    "headers": HEADERS,
                    "body": json.dumps({"message": "Invalid phone"})
                }

        subscriber_id = f"email#{email}"
        now = datetime.now(timezone.utc).isoformat()

        item = {
            "subscriber_id": subscriber_id,
            "email": email,
            "phone": normalized_phone or "",
            "status": "active",
            "source": "website",
            "unsubscribe_token": secrets.token_urlsafe(32),
            "created_at": now,
            "updated_at": now
        }

        table.put_item(Item=item)

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps({"message": "Subscribed successfully"})
        }

    except Exception as e:
        print(f"subscribe lambda error: {e}")
        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({"message": "Internal server error"})
        }
