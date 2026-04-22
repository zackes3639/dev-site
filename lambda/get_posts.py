import json
import os
import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("ZS_DEV_BLOG_POSTS")

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://zacksimon.dev",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
}

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
        response = table.scan()
        items = response.get("Items", [])

        query = event.get("queryStringParameters") or {}
        include_drafts = str(query.get("include_drafts", "")).lower() in ("1", "true", "yes")

        if include_drafts:
            admin_password = os.environ.get("ADMIN_PASSWORD", "")
            provided_password = str(query.get("password", "")).strip()
            if not admin_password or provided_password != admin_password:
                return {
                    "statusCode": 403,
                    "headers": HEADERS,
                    "body": json.dumps({"error": "Forbidden"}),
                }
            posts = items
        else:
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
        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({"message": "Error", "error": str(e)})
        }
