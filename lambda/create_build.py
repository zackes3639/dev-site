import json
import boto3
import uuid
import os
from datetime import datetime, timezone
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('ZS_DEV_BUILDS')

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
}

VALID_STATUSES = ('live', 'wip', 'idea')

def lambda_handler(event, context):
    method = event.get('requestContext', {}).get('http', {}).get('method', '')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': HEADERS, 'body': ''}

    try:
        body = json.loads(event.get('body') or '{}')
    except (json.JSONDecodeError, TypeError):
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Invalid JSON'})}

    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    if not admin_password or body.get('password') != admin_password:
        return {'statusCode': 403, 'headers': HEADERS, 'body': json.dumps({'error': 'Forbidden'})}

    title  = str(body.get('title', '')).strip()
    status = str(body.get('status', '')).strip()

    if not title:
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'title is required'})}
    if status not in VALID_STATUSES:
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'status must be live, wip, or idea'})}

    build_id   = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    item = {
        'build_id':   build_id,
        'title':      title,
        'status':     status,
        'created_at': created_at,
    }

    description = str(body.get('description', '')).strip()
    if description:
        item['description'] = description

    tags = body.get('tags', [])
    if isinstance(tags, list) and tags:
        item['tags'] = [str(t).strip() for t in tags if str(t).strip()]

    link = str(body.get('link', '')).strip()
    if link:
        item['link'] = link

    link_label = str(body.get('link_label', '')).strip()
    if link_label:
        item['link_label'] = link_label

    try:
        progress = int(body.get('progress', 0))
        if progress > 0:
            item['progress'] = Decimal(str(max(0, min(100, progress))))
    except (ValueError, TypeError):
        pass

    if body.get('dim'):
        item['dim'] = True

    try:
        item['sort_order'] = Decimal(str(int(body.get('sort_order', 0))))
    except (ValueError, TypeError):
        item['sort_order'] = Decimal('0')

    table.put_item(Item=item)

    return {
        'statusCode': 200,
        'headers': HEADERS,
        'body': json.dumps({'success': True, 'build_id': build_id})
    }
