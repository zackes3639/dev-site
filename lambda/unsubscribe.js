const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');

const client = new DynamoDBClient({});
const TABLE = 'ZS_DEV_BLOG_SIGN_UP_DATA';

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const email = String(body.email || '').trim().toLowerCase();

  if (!email) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Email is required' }) };
  }

  await client.send(new UpdateItemCommand({
    TableName: TABLE,
    Key: marshall({ email }),
    UpdateExpression: 'SET active = :false, unsubscribed_at = :ts',
    ExpressionAttributeValues: marshall({ ':false': false, ':ts': new Date().toISOString() }),
  }));

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ success: true }),
  };
};
