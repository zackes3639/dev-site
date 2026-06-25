import json
import boto3
import os
import re
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

def slug_conflicts(slug, post_id):
    scan_kwargs = {
        'FilterExpression': Attr('slug').eq(slug) & Attr('post_id').ne(post_id),
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

def slug_lock_conflicts(slug, post_id):
    response = dynamodb.meta.client.get_item(
        TableName=post_slugs_table_name,
        Key={'slug': {'S': slug}},
        ProjectionExpression='post_id'
    )
    item = response.get('Item')
    if not item:
        return False

    locked_post_id = item.get('post_id', {}).get('S')
    return locked_post_id != post_id

def marshal_value(value):
    return serializer.serialize(value)

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

    admin_password = os.environ.get('ADMIN_PASSWORD', '')
    if not admin_password or body.get('password') != admin_password:
        return {'statusCode': 403, 'headers': HEADERS, 'body': json.dumps({'error': 'Forbidden'})}

    post_id = str(body.get('post_id', '')).strip()
    if not post_id:
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'post_id is required'})}

    existing_post = None
    if 'slug' in body:
        existing_response = table.get_item(Key={'post_id': post_id})
        existing_post = existing_response.get('Item')
        if not existing_post:
            return {'statusCode': 404, 'headers': HEADERS, 'body': json.dumps({'error': 'Post not found'})}

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
        if slug_conflicts(updates['slug'], post_id) or slug_lock_conflicts(updates['slug'], post_id):
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

    update_expression = 'SET ' + ', '.join(expr_parts)

    if 'slug' in updates and existing_post and updates['slug'] != existing_post.get('slug'):
        now_slug_item = {
            'slug': updates['slug'],
            'post_id': post_id,
            'source': LEGACY_SLUG_SOURCE
        }
        transaction_attr_names = {
            **attr_names,
            '#currentSlug': 'slug'
        }
        transaction_attr_values = {
            **{key: marshal_value(value) for key, value in attr_values.items()},
            ':oldSlug': marshal_value(existing_post.get('slug'))
        }

        try:
            dynamodb.meta.client.transact_write_items(
                TransactItems=[
                    {
                        'Put': {
                            'TableName': post_slugs_table_name,
                            'Item': marshal_item(now_slug_item),
                            'ConditionExpression': 'attribute_not_exists(slug)'
                        }
                    },
                    {
                        'Update': {
                            'TableName': table.name,
                            'Key': {'post_id': {'S': post_id}},
                            'UpdateExpression': update_expression,
                            'ExpressionAttributeNames': transaction_attr_names,
                            'ExpressionAttributeValues': transaction_attr_values,
                            'ConditionExpression': 'attribute_exists(post_id) AND #currentSlug = :oldSlug'
                        }
                    },
                    {
                        'Delete': {
                            'TableName': post_slugs_table_name,
                            'Key': {'slug': marshal_value(existing_post.get('slug'))},
                            'ConditionExpression': 'attribute_not_exists(slug) OR (post_id = :postId AND #source = :legacySource)',
                            'ExpressionAttributeNames': {'#source': 'source'},
                            'ExpressionAttributeValues': {
                                ':postId': marshal_value(post_id),
                                ':legacySource': marshal_value(LEGACY_SLUG_SOURCE)
                            }
                        }
                    }
                ]
            )
        except ClientError as e:
            if e.response.get('Error', {}).get('Code') == 'TransactionCanceledException':
                return {'statusCode': 409, 'headers': HEADERS, 'body': json.dumps({'error': 'Slug update conflict'})}
            raise
    else:
        try:
            table.update_item(
                Key={'post_id': post_id},
                UpdateExpression=update_expression,
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
