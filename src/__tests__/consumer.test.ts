import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import type { SQSEvent, Context } from 'aws-lambda';

const ctx = {} as Context;

function makeEvent(body: object = { email: 'test@example.com', order: 1 }): SQSEvent {
  return {
    Records: [
      {
        messageId: 'test-message-id',
        receiptHandle: 'test-receipt-handle',
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
        eventSourceARN: 'arn:aws:sqs:us-east-1:000000000000:input-queue',
        awsRegion: 'us-east-1',
      },
    ],
  };
}

/**
 * O consumer.ts usa um contador de módulo (let counter = 0) para simular
 * o comportamento de Lambda container warm/cold start. As primeiras 3
 * invocações lançam erro (simulando falhas de processamento que levam a
 * mensagem para a DLQ). A 4ª invocação processa com sucesso.
 *
 * NOTA: Este teste valida o comportamento sequencial completo. O contador
 * é reiniciado ao carregar o módulo, o que ocorre uma vez por arquivo de
 * teste (Node Test Runner isola arquivos por execução).
 */
describe('consumer handler — comportamento sequencial (simula retry SQS)', () => {
  let handler: typeof import('../consumer').handler;

  before(async () => {
    const m = await import('../consumer');
    handler = m.handler;
  });

  test('1ª invocação: lança erro (counter = 1 < 4)', async () => {
    await assert.rejects(
      () => Promise.resolve(handler(makeEvent(), ctx, () => {})),
      /Error on processing message/
    );
  });

  test('2ª invocação: lança erro (counter = 2 < 4)', async () => {
    await assert.rejects(
      () => Promise.resolve(handler(makeEvent(), ctx, () => {})),
      /Error on processing message/
    );
  });

  test('3ª invocação: lança erro (counter = 3 < 4)', async () => {
    await assert.rejects(
      () => Promise.resolve(handler(makeEvent(), ctx, () => {})),
      /Error on processing message/
    );
  });

  test('4ª invocação: processa a mensagem com sucesso (counter = 4 >= 4)', async () => {
    await assert.doesNotReject(
      () => Promise.resolve(handler(makeEvent(), ctx, () => {}))
    );
  });

  test('5ª invocação: continua processando sem erros (counter > 4)', async () => {
    await assert.doesNotReject(
      () => Promise.resolve(handler(makeEvent({ email: 'outro@example.com', order: 2 }), ctx, () => {}))
    );
  });
});
