import json
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('ZS_DEV_BUILDS')

HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
}

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)

def scan_all_items(table):
    items = []
    scan_kwargs = {}

    while True:
        response = table.scan(**scan_kwargs)
        items.extend(response.get('Items', []))

        last_evaluated_key = response.get('LastEvaluatedKey')
        if not last_evaluated_key:
            break

        scan_kwargs['ExclusiveStartKey'] = last_evaluated_key

    return items

def lambda_handler(event, context):
    method = event.get('requestContext', {}).get('http', {}).get('method', '')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': HEADERS, 'body': ''}

    try:
        items = scan_all_items(table)

        items.sort(key=lambda x: (int(x.get('sort_order', 0)), x.get('created_at', '')))

        return {
            'statusCode': 200,
            'headers': HEADERS,
            'body': json.dumps(items, cls=DecimalEncoder)
        }
    except Exception as e:
        print(f'get_builds failed: {e}')
        return {
            'statusCode': 500,
            'headers': HEADERS,
            'body': json.dumps({'message': 'Internal server error'})
        }
