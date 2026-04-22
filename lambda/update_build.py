import json
import boto3
import os
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('ZS_DEV_BUILDS')

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
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

    build_id = str(body.get('build_id', '')).strip()
    if not build_id:
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'build_id is required'})}

    expr_parts  = []
    attr_names  = {}
    attr_values = {}

    def add(field, value):
        i = len(expr_parts)
        n, v = f'#f{i}', f':v{i}'
        expr_parts.append(f'{n} = {v}')
        attr_names[n]  = field
        attr_values[v] = value

    if 'title' in body:
        title = str(body['title']).strip()
        if not title:
            return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'title cannot be empty'})}
        add('title', title)

    if 'status' in body:
        status = str(body['status']).strip()
        if status not in VALID_STATUSES:
            return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'invalid status'})}
        add('status', status)

    if 'description' in body:
        add('description', str(body['description']).strip())

    if 'tags' in body:
        tags = body['tags']
        add('tags', [str(t).strip() for t in tags if str(t).strip()] if isinstance(tags, list) else [])

    if 'link' in body:
        add('link', str(body['link']).strip())

    if 'link_label' in body:
        add('link_label', str(body['link_label']).strip())

    if 'progress' in body:
        try:
            add('progress', Decimal(str(max(0, min(100, int(body['progress']))))))
        except (ValueError, TypeError):
            add('progress', Decimal('0'))

    if 'dim' in body:
        add('dim', bool(body['dim']))

    if 'sort_order' in body:
        try:
            add('sort_order', Decimal(str(int(body['sort_order']))))
        except (ValueError, TypeError):
            add('sort_order', Decimal('0'))

    if not expr_parts:
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'No fields to update'})}

    table.update_item(
        Key={'build_id': build_id},
        UpdateExpression='SET ' + ', '.join(expr_parts),
        ExpressionAttributeNames=attr_names,
        ExpressionAttributeValues=attr_values
    )

    return {
        'statusCode': 200,
        'headers': HEADERS,
        'body': json.dumps({'success': True})
    }
