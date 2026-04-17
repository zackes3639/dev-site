import json
import boto3
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('ZS_DEV_BLOG_POSTS')

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
}

def lambda_handler(event, context):
    method = event.get('requestContext', {}).get('http', {}).get('method', '')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': HEADERS, 'body': ''}

    posts = []
    scan_kwargs = {'FilterExpression': Attr('published').eq(True)}

    # Handle DynamoDB pagination
    while True:
        response = table.scan(**scan_kwargs)
        posts.extend(response.get('Items', []))
        last_key = response.get('LastEvaluatedKey')
        if not last_key:
            break
        scan_kwargs['ExclusiveStartKey'] = last_key

    posts.sort(key=lambda p: p.get('created_at', ''), reverse=True)

    return {
        'statusCode': 200,
        'headers': HEADERS,
        'body': json.dumps(posts)
    }
