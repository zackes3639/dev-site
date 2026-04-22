import json
import boto3
import os

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('ZS_DEV_BLOG_POSTS')

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Content-Type': 'application/json'
}

EDITABLE_FIELDS = ['title', 'slug', 'summary', 'content', 'published', 'tag']

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

    post_id = str(body.get('post_id', '')).strip()
    if not post_id:
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'post_id is required'})}

    updates = {k: body[k] for k in EDITABLE_FIELDS if k in body}
    if not updates:
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'No fields to update'})}

    expr_parts = []
    attr_names = {}
    attr_values = {}

    for i, (key, val) in enumerate(updates.items()):
        name_token = f'#f{i}'
        val_token = f':v{i}'
        expr_parts.append(f'{name_token} = {val_token}')
        attr_names[name_token] = key
        attr_values[val_token] = val

    table.update_item(
        Key={'post_id': post_id},
        UpdateExpression='SET ' + ', '.join(expr_parts),
        ExpressionAttributeNames=attr_names,
        ExpressionAttributeValues=attr_values
    )

    return {
        'statusCode': 200,
        'headers': HEADERS,
        'body': json.dumps({'success': True})
    }
