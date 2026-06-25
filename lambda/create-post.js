const { DynamoDBClient, GetItemCommand, ScanCommand, TransactWriteItemsCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({});
const TABLE  = 'ZS_DEV_BLOG_POSTS';
const POST_SLUGS_TABLE = process.env.POST_SLUGS_TABLE || 'briefly_post_slugs';
const LEGACY_SLUG_SOURCE = 'legacy_blog';

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

async function slugExists(slug) {
  let exclusiveStartKey;

  do {
    const input = {
      TableName: TABLE,
      FilterExpression: 'slug = :slug',
      ExpressionAttributeValues: { ':slug': { S: slug } },
      ProjectionExpression: 'post_id',
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    };

    const result = await client.send(new ScanCommand(input));
    if ((result.Count || 0) > 0) {
      return true;
    }

    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return false;
}

async function slugLockExists(slug) {
  const result = await client.send(new GetItemCommand({
    TableName: POST_SLUGS_TABLE,
    Key: { slug: { S: slug } },
    ProjectionExpression: 'slug',
  }));

  return Boolean(result.Item);
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

  if (body._validate === true) {
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true }) };
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

  if ((await slugExists(slug)) || (await slugLockExists(slug))) {
    return { statusCode: 409, headers: HEADERS, body: JSON.stringify({ error: 'Slug already exists' }) };
  }

  const post_id  = randomUUID();
  const created_at = new Date().toISOString();
  const tag = String(body.tag || '').trim();

  const item = { post_id, slug, title, summary, content, published, created_at };
  if (tag) item.tag = tag;

  try {
    await client.send(new TransactWriteItemsCommand({
      TransactItems: [
        {
          Put: {
            TableName: POST_SLUGS_TABLE,
            Item: marshall({
              slug,
              post_id,
              source: LEGACY_SLUG_SOURCE,
              created_at,
            }),
            ConditionExpression: 'attribute_not_exists(slug)',
          },
        },
        {
          Put: {
            TableName: TABLE,
            Item: marshall(item),
            ConditionExpression: 'attribute_not_exists(post_id)',
          },
        },
      ],
    }));
  } catch (error) {
    if (error && error.name === 'TransactionCanceledException') {
      return { statusCode: 409, headers: HEADERS, body: JSON.stringify({ error: 'Slug already exists' }) };
    }

    throw error;
  }

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ success: true, slug }),
  };
};
