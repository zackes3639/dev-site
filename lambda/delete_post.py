import json
import boto3
import os
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('ZS_DEV_BLOG_POSTS')
post_slugs_table = dynamodb.Table(os.environ.get('POST_SLUGS_TABLE', 'briefly_post_slugs'))
LEGACY_SLUG_SOURCE = 'legacy_blog'

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Content-Type': 'application/json'
}

def get_slug_lock(slug):
    if not slug:
        return None

    response = post_slugs_table.get_item(
        Key={'slug': slug},
        ProjectionExpression='post_id, #source, source_draft_id',
        ExpressionAttributeNames={'#source': 'source'}
    )
    return response.get('Item')

def is_briefly_owned_slug_lock(item, post_id):
    if not item:
        return False

    if item.get('post_id') != post_id:
        return False

    return item.get('source') != LEGACY_SLUG_SOURCE

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

    existing_response = table.get_item(Key={'post_id': post_id})
    existing_post = existing_response.get('Item')

    if existing_post and existing_post.get('slug'):
        existing_slug_lock = get_slug_lock(existing_post.get('slug'))
        if is_briefly_owned_slug_lock(existing_slug_lock, post_id):
            return {'statusCode': 409, 'headers': HEADERS, 'body': json.dumps({'error': 'Post is managed by Briefly'})}

    table.delete_item(Key={'post_id': post_id})

    if existing_post and existing_post.get('slug'):
        try:
            post_slugs_table.delete_item(
                Key={'slug': existing_post.get('slug')},
                ConditionExpression=Attr('post_id').eq(post_id) & Attr('source').eq(LEGACY_SLUG_SOURCE)
            )
        except ClientError as e:
            if e.response.get('Error', {}).get('Code') != 'ConditionalCheckFailedException':
                raise

    return {
        'statusCode': 200,
        'headers': HEADERS,
        'body': json.dumps({'success': True})
    }
