import json
import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("ZS_DEV_BLOG_POSTS")

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://zacksimon.dev"
}

def lambda_handler(event, context):
    try:
        response = table.scan()
        items = response.get("Items", [])

        published_posts = [p for p in items if p.get("published") == True]

        published_posts.sort(
            key=lambda x: x.get("created_at", ""),
            reverse=True
        )

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps(published_posts)
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({"message": "Error", "error": str(e)})
        }
