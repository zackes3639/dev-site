import json
import boto3
import uuid
import os
import re
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Attr
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('ZS_DEV_BLOG_POSTS')
post_slugs_table_name = os.environ.get('POST_SLUGS_TABLE', 'briefly_post_slugs')
serializer = TypeSerializer()
LEGACY_SLUG_SOURCE = 'legacy_blog'

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
}

def slugify(text):
    text = str(text).lower().strip()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'\s+', '-', text)
    text = re.sub(r'-+', '-', text).strip('-')
    return text

def slug_exists(slug):
    scan_kwargs = {
        'FilterExpression': Attr('slug').eq(slug),
        'ProjectionExpression': 'post_id'
    }

    while True:
        response = table.scan(**scan_kwargs)
        if response.get('Count', 0) > 0:
            return True

        last_evaluated_key = response.get('LastEvaluatedKey')
        if not last_evaluated_key:
            return False

        scan_kwargs['ExclusiveStartKey'] = last_evaluated_key

def slug_lock_exists(slug):
    response = dynamodb.meta.client.get_item(
        TableName=post_slugs_table_name,
        Key={'slug': {'S': slug}},
        ProjectionExpression='slug'
    )
    return 'Item' in response

def marshal_item(item):
    return {key: serializer.serialize(value) for key, value in item.items()}

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

    # Validate password
    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    if not admin_password or body.get('password') != admin_password:
        return {'statusCode': 403, 'headers': HEADERS, 'body': json.dumps({'error': 'Forbidden'})}

    if body.get('_validate') is True:
        return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'success': True})}

    title   = str(body.get('title', '')).strip()
    summary = str(body.get('summary', '')).strip()
    content = str(body.get('content', '')).strip()
    slug = slugify(body.get('slug') or title)
    published = bool(body.get('published', False))

    if not title or not summary or not content:
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'title, summary, and content are required'})}

    if not slug:
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Could not generate a valid slug from title'})}

    if slug_exists(slug) or slug_lock_exists(slug):
        return {'statusCode': 409, 'headers': HEADERS, 'body': json.dumps({'error': 'Slug already exists'})}

    post_id    = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    item = {
        'post_id':    post_id,
        'slug':       slug,
        'title':      title,
        'summary':    summary,
        'content':    content,
        'published':  published,
        'created_at': created_at
    }

    tag = str(body.get('tag', '')).strip()
    if tag:
        item['tag'] = tag

    slug_item = {
        'slug': slug,
        'post_id': post_id,
        'source': LEGACY_SLUG_SOURCE,
        'created_at': created_at
    }

    try:
        dynamodb.meta.client.transact_write_items(
            TransactItems=[
                {
                    'Put': {
                        'TableName': post_slugs_table_name,
                        'Item': marshal_item(slug_item),
                        'ConditionExpression': 'attribute_not_exists(slug)'
                    }
                },
                {
                    'Put': {
                        'TableName': table.name,
                        'Item': marshal_item(item),
                        'ConditionExpression': 'attribute_not_exists(post_id)'
                    }
                }
            ]
        )
    except ClientError as e:
        if e.response.get('Error', {}).get('Code') == 'TransactionCanceledException':
            return {'statusCode': 409, 'headers': HEADERS, 'body': json.dumps({'error': 'Slug already exists'})}
        raise

    return {
        'statusCode': 200,
        'headers': HEADERS,
        'body': json.dumps({'success': True, 'post_id': post_id, 'created_at': created_at, 'slug': slug})
    }
