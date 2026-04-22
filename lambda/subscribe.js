const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
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
  const phone = String(body.phone || '').trim();
  const age   = body.age ? String(body.age) : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Valid email is required' }) };
  }

  const item = { email, subscribed_at: new Date().toISOString(), active: true };
  if (phone) item.phone = phone;
  if (age)   item.age   = age;

  await client.send(new PutItemCommand({
    TableName: TABLE,
    Item: marshall(item),
  }));

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ success: true }),
  };
};
