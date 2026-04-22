import json
import os
import re
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
            body = json.loads(body)

        email = (body.get("email") or "").strip().lower()
        phone = (body.get("phone") or "").strip()
        age = body.get("age")

        if not email and not phone:
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({"message": "Email or phone is required"})
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

        if age:
            try:
                age = int(age)
                if age < 1 or age > 99:
                    raise ValueError
            except:
                return {
                    "statusCode": 400,
                    "headers": HEADERS,
                    "body": json.dumps({"message": "Invalid age"})
                }

        subscriber_id = f"email#{email}" if email else f"phone#{normalized_phone}"

        item = {
            "subscriber_id": subscriber_id,
            "email": email or "",
            "phone": normalized_phone or "",
            "age": age,
            "status": "active",
            "source": "website",
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        table.put_item(Item=item)

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps({"message": "Subscribed successfully"})
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({"message": "Internal server error", "error": str(e)})
        }
