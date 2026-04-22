import json
import boto3
import os

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('ZS_DEV_BUILDS')

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

    build_id = str(body.get('build_id', '')).strip()
    if not build_id:
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'build_id is required'})}

    table.delete_item(Key={'build_id': build_id})

    return {
        'statusCode': 200,
        'headers': HEADERS,
        'body': json.dumps({'success': True})
    }
