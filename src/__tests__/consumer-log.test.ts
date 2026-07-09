import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { handler } from '../consumer-log';

function makeSnsWrappedEvent(payload: object): SQSEvent {
  return {
    Records: [
      {
        messageId: 'msg-1',
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
        eventSourceARN: 'arn:aws:sqs:us-east-1:000000000000:queue-logging',
        awsRegion: 'us-east-1',
      },
    ],
  } as SQSEvent;
}

describe('consumer-log handler', () => {
  test('processa mensagem SNS encapsulada sem falhar', async () => {
    const response = (await handler(
      makeSnsWrappedEvent({ eventType: 'PedidoCriado', payload: { email: 'test@example.com' } }),
      {} as any,
      () => {}
    )) as SQSBatchResponse;

    assert.deepEqual(response.batchItemFailures, []);
  });

  test('marca item como falho quando body é inválido', async () => {
    const event = makeSnsWrappedEvent({});
    event.Records[0].body = '{invalid-json';

    const response = (await handler(event, {} as any, () => {})) as SQSBatchResponse;
    assert.equal(response.batchItemFailures.length, 1);
    assert.equal(response.batchItemFailures[0].itemIdentifier, 'msg-1');
  });
});
