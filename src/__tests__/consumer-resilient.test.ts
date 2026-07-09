import { test, describe, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Context, SQSEvent } from 'aws-lambda';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

process.env.IDEMPOTENCY_TABLE_NAME = 'idempotency-table';
process.env.FINAL_ERROR_QUEUE_URL = 'http://localhost:4566/000000000000/queue-resilient-final-dlq';
process.env.QUEUE_HOST_URL = 'http://localhost:4566';
process.env.AWS_REGION = 'us-east-1';

const mockSqsSend = mock.fn(async () => ({ MessageId: 'dlq-message-id' }));
const ddbStore = new Map<string, Record<string, unknown>>();

const ddbModule = require('@aws-sdk/client-dynamodb') as Record<string, unknown>;
const ConditionalCheckFailedException = ddbModule['ConditionalCheckFailedException'] as new (options?: Record<string, unknown>) => Error;
ddbModule['DynamoDBClient'] = class MockDynamoDBClient {
  send = async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
    const commandName = command.constructor.name;

    if (commandName === 'PutItemCommand') {
      const item = unmarshall(command.input['Item'] as any) as Record<string, unknown>;
      const key = String(item['transactionId']);

      if (ddbStore.has(key)) {
        const error = new ConditionalCheckFailedException({ message: 'duplicate item' }) as Error & {
          Item?: Record<string, unknown>;
        };
        error.Item = marshall(ddbStore.get(key) as Record<string, unknown>, {
          removeUndefinedValues: true,
        });
        throw error;
      }

      ddbStore.set(key, item);
      return {};
    }

    if (commandName === 'UpdateItemCommand') {
      const keyData = unmarshall(command.input['Key'] as any) as Record<string, unknown>;
      const key = String(keyData['transactionId']);
      const existing = ddbStore.get(key) ?? {};
      const attrs = unmarshall(command.input['ExpressionAttributeValues'] as any) as Record<string, unknown>;

      ddbStore.set(key, {
        ...existing,
        status: attrs[':status'],
        expiration: attrs[':expiry'],
        data: attrs[':response_data'],
        validation: attrs[':validation_key'],
      });

      return {};
    }

    if (commandName === 'DeleteItemCommand') {
      const keyData = unmarshall(command.input['Key'] as any) as Record<string, unknown>;
      ddbStore.delete(String(keyData['transactionId']));
      return {};
    }

    if (commandName === 'GetItemCommand') {
      const keyData = unmarshall(command.input['Key'] as any) as Record<string, unknown>;
      const item = ddbStore.get(String(keyData['transactionId']));
      return item
        ? {
            Item: marshall(item, {
              removeUndefinedValues: true,
            }),
          }
        : {};
    }

    return {};
  };
};

const sqsModule = require('@aws-sdk/client-sqs') as Record<string, unknown>;
sqsModule['SQSClient'] = class MockSQSClient {
  send = mockSqsSend;
};

const resilientPath = require.resolve('../consumer-resilient');
delete require.cache[resilientPath];
const { handler } = require('../consumer-resilient') as { handler: Function };

const ctx = {
  getRemainingTimeInMillis: () => 30_000,
} as Context;

function makeEvent(payload: object, messageId = 'msg-1'): SQSEvent {
  return {
    Records: [
      {
        messageId,
        receiptHandle: 'handle-1',
        body: JSON.stringify({
          Type: 'Notification',
          Message: JSON.stringify(payload),
        }),
        attributes: {
          ApproximateReceiveCount: '1',
          SentTimestamp: '1623100000000',
          SenderId: 'test-sender',
          ApproximateFirstReceiveTimestamp: '1623100000000',
        },
        messageAttributes: {},
        md5OfBody: 'test-md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-east-1:000000000000:queue-resilient',
        awsRegion: 'us-east-1',
      },
    ],
  } as SQSEvent;
}

describe('consumer-resilient handler', () => {
  beforeEach(() => {
    mockSqsSend.mock.resetCalls();
    ddbStore.clear();
    delete process.env.IS_OFFLINE;
  });

  test('processa mensagem válida sem falhas de batch', async () => {
    const event = makeEvent({
      eventType: 'PedidoCriado',
      transactionId: 'tx-1',
      payload: { email: 'valid@example.com' },
    });

    const response = await handler(event, ctx, () => {});
    assert.deepEqual(response.batchItemFailures, []);
  });

  test('ignora duplicidade quando idempotência detectar ConditionalCheckFailedException', async () => {
    const event = makeEvent({
      eventType: 'PedidoCriado',
      transactionId: 'tx-dup',
      payload: { email: 'dup@example.com' },
    });

    await handler(event, ctx, () => {});
    const response = await handler(event, ctx, () => {});
    assert.deepEqual(response.batchItemFailures, []);
  });

  test('retorna falha parcial para erro transiente', async () => {
    const event = makeEvent({
      eventType: 'PedidoCriado',
      transactionId: 'tx-transient',
      payload: { email: 'transient@example.com', forceTransientError: true },
    });

    const response = await handler(event, ctx, () => {});
    assert.equal(response.batchItemFailures.length, 1);
    assert.equal(response.batchItemFailures[0].itemIdentifier, 'msg-1');

    const recoveryResponse = await handler(
      makeEvent({
        eventType: 'PedidoCriado',
        transactionId: 'tx-transient',
        payload: { email: 'transient@example.com' },
      }),
      ctx,
      () => {}
    );

    assert.deepEqual(recoveryResponse.batchItemFailures, []);
  });

  test('em modo offline lança exceção para permitir retry/redrive do plugin SQS', async () => {
    process.env.IS_OFFLINE = 'true';

    const event = makeEvent({
      eventType: 'PedidoCriado',
      transactionId: 'tx-transient-offline',
      payload: { email: 'transient@example.com', forceTransientError: true },
    });

    await assert.rejects(() => handler(event, ctx, () => {}), /offline_retry_required/);
  });

  test('envia para fila de erro final em falha permanente e não retorna retry', async () => {
    const event = makeEvent({
      eventType: 'PedidoCriado',
      transactionId: 'tx-perm',
      payload: { invalid: true },
    });

    const response = await handler(event, ctx, () => {});
    assert.deepEqual(response.batchItemFailures, []);
    assert.equal(mockSqsSend.mock.calls.length, 1);
  });
});
