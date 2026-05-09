import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { SQSEvent } from 'aws-lambda';
import { handler } from '../consumer2';

function makeSnsEnvelopeEvent(message: string): SQSEvent {
  return {
    Records: [
      {
        messageId: 'msg-2',
        receiptHandle: 'handle-2',
        body: JSON.stringify({
          Type: 'Notification',
          MessageId: 'sns-msg-id-2',
          TopicArn: 'arn:aws:sns:us-east-1:000000000000:minha-fila',
          Message: message,
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
        eventSourceARN: 'arn:aws:sqs:us-east-1:000000000000:minha-fila-2',
        awsRegion: 'us-east-1',
      },
    ],
  } as SQSEvent;
}

describe('consumer2 handler (SNS → SQS fila 2)', () => {
  test('processa um record com envelope SNS sem lançar exceção', async () => {
    const event = makeSnsEnvelopeEvent('{"email":"test2@example.com"}');
    await assert.doesNotReject(
      () => Promise.resolve(handler(event, {} as any, () => {}))
    );
  });

  test('processa mensagem com conteúdo de texto simples no campo Message', async () => {
    const event = makeSnsEnvelopeEvent('hello world from queue 2');
    await assert.doesNotReject(
      () => Promise.resolve(handler(event, {} as any, () => {}))
    );
  });

  test('processa mensagem com objeto JSON complexo no campo Message', async () => {
    const event = makeSnsEnvelopeEvent(JSON.stringify({ user: 'test', action: 'created' }));
    await assert.doesNotReject(
      () => Promise.resolve(handler(event, {} as any, () => {}))
    );
  });
});
