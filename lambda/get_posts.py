import json
import os
import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("ZS_DEV_BLOG_POSTS")

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://zacksimon.dev",
    "Access-Control-Allow-Headers": "Content-Type,X-Admin-Password",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
}

def get_header(event, name):
    headers = event.get("headers") or {}
    name_lower = name.lower()
    for key, value in headers.items():
        if key.lower() == name_lower:
            return value
    return ""

def scan_all_items(table):
    items = []
    scan_kwargs = {}

    while True:
        response = table.scan(**scan_kwargs)
        items.extend(response.get("Items", []))

        last_evaluated_key = response.get("LastEvaluatedKey")
        if not last_evaluated_key:
            break

        scan_kwargs["ExclusiveStartKey"] = last_evaluated_key

    return items

def lambda_handler(event, context):
    method = (
        event.get("httpMethod")
        or event.get("requestContext", {}).get("http", {}).get("method", "")
    )

    if method == "OPTIONS":
        return {
            "statusCode": 204,
            "headers": HEADERS,
            "body": "",
        }

    try:
        query = event.get("queryStringParameters") or {}
        include_drafts = str(query.get("include_drafts", "")).lower() in ("1", "true", "yes")

        if include_drafts:
            admin_password = os.environ.get("ADMIN_PASSWORD", "")
            provided_password = str(get_header(event, "X-Admin-Password")).strip()
            if not admin_password or provided_password != admin_password:
                return {
                    "statusCode": 403,
                    "headers": HEADERS,
                    "body": json.dumps({"error": "Forbidden"}),
                }
            posts = scan_all_items(table)
        else:
            items = scan_all_items(table)
            posts = [p for p in items if p.get("published") is True]

        posts.sort(
            key=lambda x: x.get("created_at", ""),
            reverse=True
        )

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps(posts)
        }

    except Exception as e:
        print(f"get_posts failed: {e}")
        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({"message": "Internal server error"})
        }
