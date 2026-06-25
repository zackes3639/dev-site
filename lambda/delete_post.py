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
