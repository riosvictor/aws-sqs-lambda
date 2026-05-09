import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { SQSEvent } from 'aws-lambda';
import { handler } from '../consumer';

function makeEvent(records: object[]): SQSEvent {
  return {
    Records: records.map((body, i) => ({
      messageId: `msg-${i}`,
      receiptHandle: `handle-${i}`,
      body: JSON.stringify(body),
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '1623100000000',
        SenderId: 'test-sender',
        ApproximateFirstReceiveTimestamp: '1623100000000',
      },
      messageAttributes: {},
      md5OfBody: 'test-md5',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-1:000000000000:minha-fila',
      awsRegion: 'us-east-1',
    })),
  } as SQSEvent;
}

describe('consumer handler', () => {
  test('processa um único record sem lançar exceção', async () => {
    await assert.doesNotReject(
      () => Promise.resolve(handler(makeEvent([{ email: 'test@example.com' }]), {} as any, () => {}))
    );
  });

  test('processa múltiplos records sem lançar exceção', async () => {
    await assert.doesNotReject(
      () => Promise.resolve(
        handler(
          makeEvent([
            { email: 'a@example.com' },
            { email: 'b@example.com' },
            { email: 'c@example.com' },
          ]),
          {} as any,
          () => {}
        )
      )
    );
  });

  test('processa evento com body de objeto complexo', async () => {
    const payload = { email: 'test@example.com', metadata: { id: 42, tags: ['foo', 'bar'] } };
    await assert.doesNotReject(
      () => Promise.resolve(handler(makeEvent([payload]), {} as any, () => {}))
    );
  });
});
