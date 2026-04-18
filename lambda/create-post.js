const { DynamoDBClient, PutItemCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');

const client = new DynamoDBClient({});
const TABLE  = 'blog-posts';

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

  // Reject if slug already exists
  const existing = await client.send(new GetItemCommand({
    TableName: TABLE,
    Key: marshall({ slug }),
  }));
  if (existing.Item) {
    return { statusCode: 409, headers: HEADERS, body: JSON.stringify({ error: `Slug "${slug}" already exists` }) };
  }

  const createdAt = new Date().toISOString();

  await client.send(new PutItemCommand({
    TableName: TABLE,
    Item: marshall({ slug, title, summary, content, published, createdAt }),
  }));

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ success: true, slug }),
  };
};
