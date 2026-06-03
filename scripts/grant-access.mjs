import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { FREE_TRIAL_DAYS } from '@brouklins/class-manager-shared';

const [teacherId, daysArg] = process.argv.slice(2);
const extraDays = Number(daysArg);
const tableName = process.env.TABLE_NAME;

if (!teacherId || !Number.isFinite(extraDays) || extraDays <= 0) {
  console.error('Usage: TABLE_NAME=<table> pnpm grant-access <teacherId> <days>');
  process.exit(1);
}

if (!tableName) {
  console.error('Missing TABLE_NAME environment variable.');
  process.exit(1);
}

const addDays = (isoDate, days) => {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

const now = new Date();
const nowIso = now.toISOString();

const baseClient = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(baseClient, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

const key = {
  PK: `TEACHER#${teacherId}`,
  SK: 'PROFILE'
};

const response = await dynamo.send(
  new GetCommand({
    TableName: tableName,
    Key: key
  })
);

if (!response.Item) {
  console.error('Teacher profile not found. The teacher must sign in at least once before renewal.');
  process.exit(1);
}

const existing = response.Item;
const trialStartedAt = existing.trialStartedAt ?? existing.createdAt ?? nowIso;
const trialEndsAt = existing.trialEndsAt ?? addDays(trialStartedAt, FREE_TRIAL_DAYS);
const currentAccessEndsAt =
  existing.accessEndsAt && new Date(existing.accessEndsAt).getTime() > now.getTime()
    ? existing.accessEndsAt
    : nowIso;
const nextAccessEndsAt = addDays(currentAccessEndsAt, extraDays);

const updated = {
  ...existing,
  trialStartedAt,
  trialEndsAt,
  accessEndsAt: nextAccessEndsAt,
  accessStatus: 'active',
  updatedAt: nowIso
};

await dynamo.send(
  new PutCommand({
    TableName: tableName,
    Item: updated
  })
);

console.log(
  JSON.stringify(
    {
      teacherId,
      addedDays: extraDays,
      accessEndsAt: nextAccessEndsAt
    },
    null,
    2
  )
);
