const { DynamoDBClient, PutItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({});
const TABLE  = 'ZS_DEV_BLOG_POSTS';

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

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

  const adminPassword = process.env.ADMIN_PASSWORD || '';
  if (!adminPassword || body.password !== adminPassword) {
    return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  const title     = String(body.title   || '').trim();
  const summary   = String(body.summary || '').trim();
  const content   = String(body.content || '').trim();
  const published = Boolean(body.published);
  const slug      = body.slug ? slugify(String(body.slug)) : slugify(title);

  if (!title || !summary || !content) {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ error: 'title, summary, and content are required' }),
    };
  }

  if (!slug) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Could not generate a valid slug from title' }) };
  }

  const post_id  = randomUUID();
  const created_at = new Date().toISOString();

  await client.send(new PutItemCommand({
    TableName: TABLE,
    Item: marshall({ post_id, slug, title, summary, content, published, created_at }),
  }));

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ success: true, slug }),
  };
};
