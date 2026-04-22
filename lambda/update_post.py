import json
import boto3
import os
import re
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('ZS_DEV_BLOG_POSTS')

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Content-Type': 'application/json'
}

EDITABLE_FIELDS = ['title', 'slug', 'summary', 'content', 'published', 'tag']

def slugify(text):
    text = str(text).lower().strip()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'\s+', '-', text)
    text = re.sub(r'-+', '-', text).strip('-')
    return text

def lambda_handler(event, context):
    method = (
        event.get('httpMethod')
        or event.get('requestContext', {}).get('http', {}).get('method', '')
    )

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

    updates = {}

    if 'title' in body:
        title = str(body.get('title', '')).strip()
        if not title:
            return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'title cannot be empty'})}
        updates['title'] = title

    if 'slug' in body:
        slug = slugify(body.get('slug', ''))
        if not slug:
            return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'slug cannot be empty'})}
        updates['slug'] = slug

    if 'summary' in body:
        summary = str(body.get('summary', '')).strip()
        if not summary:
            return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'summary cannot be empty'})}
        updates['summary'] = summary

    if 'content' in body:
        content = str(body.get('content', '')).strip()
        if not content:
            return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'content cannot be empty'})}
        updates['content'] = content

    if 'published' in body:
        updates['published'] = bool(body.get('published'))

    if 'tag' in body:
        updates['tag'] = str(body.get('tag', '')).strip()

    # Ignore unknown fields so we only apply validated keys.
    updates = {k: v for k, v in updates.items() if k in EDITABLE_FIELDS}
    if not updates:
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'No fields to update'})}

    if 'slug' in updates:
        existing = table.scan(
            FilterExpression=Attr('slug').eq(updates['slug']) & Attr('post_id').ne(post_id),
            ProjectionExpression='post_id',
            Limit=1
        )
        if existing.get('Count', 0) > 0:
            return {'statusCode': 409, 'headers': HEADERS, 'body': json.dumps({'error': 'Slug already exists'})}

    expr_parts = []
    attr_names = {}
    attr_values = {}

    for i, (key, val) in enumerate(updates.items()):
        name_token = f'#f{i}'
        val_token = f':v{i}'
        expr_parts.append(f'{name_token} = {val_token}')
        attr_names[name_token] = key
        attr_values[val_token] = val

    try:
        table.update_item(
            Key={'post_id': post_id},
            UpdateExpression='SET ' + ', '.join(expr_parts),
            ExpressionAttributeNames=attr_names,
            ExpressionAttributeValues=attr_values,
            ConditionExpression='attribute_exists(post_id)'
        )
    except ClientError as e:
        if e.response.get('Error', {}).get('Code') == 'ConditionalCheckFailedException':
            return {'statusCode': 404, 'headers': HEADERS, 'body': json.dumps({'error': 'Post not found'})}
        raise

    return {
        'statusCode': 200,
        'headers': HEADERS,
        'body': json.dumps({'success': True})
    }
