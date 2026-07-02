const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const dynamo = require("../dist/services/newsletter/src/lib/dynamo.js");
const {
  buildCampaignDraftFromPost,
  buildUnsubscribeUrl,
  renderCampaignBody
} = require("../dist/services/newsletter/src/lib/campaignContent.js");
const { validateUpdateNewsletterCampaign } = require("../dist/services/newsletter/src/lib/validators.js");
const { CampaignsRepository } = require("../dist/services/newsletter/src/repositories/campaignsRepository.js");
const { DeliveriesRepository } = require("../dist/services/newsletter/src/repositories/deliveriesRepository.js");
const { SubscribersRepository } = require("../dist/services/newsletter/src/repositories/subscribersRepository.js");

const originalSend = dynamo.ddb.send;

const conditionalError = () => {
  const error = new Error("conditional failed");
  error.name = "ConditionalCheckFailedException";
  return error;
};

afterEach(() => {
  dynamo.ddb.send = originalSend;
});

test("campaign drafts are keyed once per published post", () => {
  const campaign = buildCampaignDraftFromPost(
    {
      post_id: "abc123",
      slug: "hello-build-log",
      title: "Hello Build Log",
      summary: "A concise update.",
      content: "Full post body."
    },
    "2026-07-02T12:00:00.000Z",
    "https://zacksimon.dev/"
  );

  assert.equal(campaign.campaign_id, "post#abc123");
  assert.equal(campaign.status, "draft");
  assert.equal(campaign.subject, "The Build Log: Hello Build Log");
  assert.equal(campaign.source_url, "https://zacksimon.dev/blog/post/?slug=hello-build-log");
});

test("subscriber scans paginate and keep only active valid emails", async () => {
  const calls = [];
  dynamo.ddb.send = async (command) => {
    calls.push(command.input);
    if (calls.length === 1) {
      return {
        Items: [
          { subscriber_id: "email#one@example.com", email: "One@Example.com", status: "active" },
          { subscriber_id: "email#inactive@example.com", email: "inactive@example.com", status: "inactive" },
          { subscriber_id: "email#invalid", email: "not-an-email", status: "active" }
        ],
        LastEvaluatedKey: { subscriber_id: "email#one@example.com" }
      };
    }

    return {
      Items: [
        {
          subscriber_id: "email#two@example.com",
          email: "two@example.com",
          status: "active",
          unsubscribe_token: "existing-token"
        }
      ]
    };
  };

  const subscribers = await new SubscribersRepository("subscribers").scanActiveSubscribers();

  assert.equal(calls.length, 2);
  assert.deepEqual(subscribers, [
    { subscriber_id: "email#one@example.com", email: "one@example.com", status: "active" },
    {
      subscriber_id: "email#two@example.com",
      email: "two@example.com",
      status: "active",
      unsubscribe_token: "existing-token"
    }
  ]);
});

test("delivery rows are idempotent per campaign and subscriber", async () => {
  let putCount = 0;
  dynamo.ddb.send = async (command) => {
    if (command.constructor.name === "PutCommand") {
      putCount += 1;
      assert.equal(command.input.ConditionExpression, "attribute_not_exists(campaign_id) AND attribute_not_exists(subscriber_id)");
      if (putCount === 2) {
        throw conditionalError();
      }
      return {};
    }

    throw new Error(`Unexpected command ${command.constructor.name}`);
  };

  const repository = new DeliveriesRepository("deliveries");
  const first = await repository.createQueuedIfAbsent({
    campaign_id: "post#abc123",
    subscriber_id: "email#one@example.com",
    email: "one@example.com",
    created_at: "2026-07-02T12:00:00.000Z"
  });
  const duplicate = await repository.createQueuedIfAbsent({
    campaign_id: "post#abc123",
    subscriber_id: "email#one@example.com",
    email: "one@example.com",
    created_at: "2026-07-02T12:00:01.000Z"
  });

  assert.equal(first.delivery_id, "post#abc123#email#one@example.com");
  assert.equal(duplicate, null);
});

test("subscriber send gate maps Dynamo conditional failure to test_send_required", async () => {
  dynamo.ddb.send = async () => {
    throw conditionalError();
  };

  await assert.rejects(
    () => new CampaignsRepository("campaigns").markSending("post#abc123", "2026-07-02T12:00:00.000Z"),
    (error) => error.code === "test_send_required"
  );
});

test("campaign update validation requires a version and editable copy", () => {
  assert.deepEqual(
    validateUpdateNewsletterCampaign({
      expected_version: 3,
      subject: "Subject",
      body: "Body"
    }),
    {
      expected_version: 3,
      subject: "Subject",
      body: "Body"
    }
  );

  assert.throws(() => validateUpdateNewsletterCampaign({ subject: "Subject" }), /expected_version/);
});

test("unsubscribe links include the subscriber token and render into the email body", () => {
  const url = buildUnsubscribeUrl("https://zacksimon.dev", "one+test@example.com", "token/with=symbols");
  const body = renderCampaignBody("Body\n\n{{unsubscribe_url}}", url);

  assert.equal(
    url,
    "https://zacksimon.dev/unsubscribe/?email=one%2Btest%40example.com&token=token%2Fwith%3Dsymbols"
  );
  assert.match(body, /token%2Fwith%3Dsymbols/);
});
