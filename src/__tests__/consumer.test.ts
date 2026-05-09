import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { SQSEvent } from 'aws-lambda';
import { handler } from '../consumer';

/**
 * O SNS entrega mensagens ao SQS com um envelope JSON.
 * O campo `Message` contém a mensagem original publicada no tópico.
 * consumer.ts lê `JSON.parse(record.body).Message`.
 */
function makeSnsEnvelopeEvent(message: string): SQSEvent {
  return {
    Records: [
      {
        messageId: 'msg-1',
        receiptHandle: 'handle-1',
        // Envelope SNS: body do SQS é o envelope SNS
        body: JSON.stringify({
          Type: 'Notification',
          MessageId: 'sns-msg-id-1',
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
        eventSourceARN: 'arn:aws:sqs:us-east-1:000000000000:minha-fila',
        awsRegion: 'us-east-1',
      },
    ],
  } as SQSEvent;
}

describe('consumer handler (SNS → SQS)', () => {
  test('processa um record com envelope SNS sem lançar exceção', async () => {
    const event = makeSnsEnvelopeEvent('{"email":"test@example.com"}');
    await assert.doesNotReject(
      () => Promise.resolve(handler(event, {} as any, () => {}))
    );
  });

  test('processa mensagem com conteúdo de texto simples no campo Message', async () => {
    const event = makeSnsEnvelopeEvent('hello world');
    await assert.doesNotReject(
      () => Promise.resolve(handler(event, {} as any, () => {}))
    );
  });

  test('processa mensagem com objeto JSON complexo no campo Message', async () => {
    const event = makeSnsEnvelopeEvent(JSON.stringify({ email: 'a@b.com', tags: ['x', 'y'] }));
    await assert.doesNotReject(
      () => Promise.resolve(handler(event, {} as any, () => {}))
    );
  });
});
