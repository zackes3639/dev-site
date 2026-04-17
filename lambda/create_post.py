import json
import boto3
import uuid
import os
from datetime import datetime, timezone

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('ZS_DEV_BLOG_POSTS')

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
}

def lambda_handler(event, context):
    method = event.get('requestContext', {}).get('http', {}).get('method', '')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': HEADERS, 'body': ''}

    try:
        body = json.loads(event.get('body') or '{}')
    except (json.JSONDecodeError, TypeError):
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Invalid JSON'})}

    # Validate password
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    if not admin_password or body.get('password') != admin_password:
        return {'statusCode': 403, 'headers': HEADERS, 'body': json.dumps({'error': 'Forbidden'})}

    title   = str(body.get('title', '')).strip()
    summary = str(body.get('summary', '')).strip()
    content = str(body.get('content', '')).strip()
    published = bool(body.get('published', False))

    if not title or not summary or not content:
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'title, summary, and content are required'})}

    post_id    = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    table.put_item(Item={
        'post_id':    post_id,
        'title':      title,
        'summary':    summary,
        'content':    content,
        'published':  published,
        'created_at': created_at
    })

    return {
        'statusCode': 200,
        'headers': HEADERS,
        'body': json.dumps({'success': True, 'post_id': post_id, 'created_at': created_at})
    }
