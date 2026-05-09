import { test, describe, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { SQSEvent, Context } from 'aws-lambda';
import { MaxAttemptsError } from '../max-attempts.exception';

// Configura envs ANTES do carregamento do módulo consumer-dlq
process.env.QUEUE_HOST_URL = 'http://localhost:4566';
process.env.AWS_REGION = 'us-east-1';
process.env.QUEUE_URL = 'http://localhost:4566/000000000000/input-queue';
process.env.MAX_ATTEMPTS = '3';
process.env.DELAY_BASE = '100';

// Cria função mock para client.send
const mockSend = mock.fn(async (_cmd: unknown) => ({ MessageId: 'mock-message-id' }));

// Substitui SQSClient no require.cache ANTES de carregar consumer-dlq
// Com ts-node (CommonJS), `import { SQSClient } from '@aws-sdk/client-sqs'` compila para
// require('@aws-sdk/client-sqs').SQSClient — ao patchear o exports aqui, o módulo
// consumer-dlq.ts receberá o MockSQSClient ao ser carregado logo abaixo.
const sqsModule = require('@aws-sdk/client-sqs') as Record<string, unknown>;
sqsModule['SQSClient'] = class MockSQSClient {
  send = mockSend;
};

// Garante carregamento fresco de consumer-dlq com o mock aplicado
const consumerDlqPath = require.resolve('../consumer-dlq');
delete require.cache[consumerDlqPath];
const { handler } = require('../consumer-dlq') as { handler: Function };

// ---------------------------------------------------------------------------

function makeRecord(attemptsAttr?: number) {
  return {
    messageId: 'test-id',
    receiptHandle: 'test-handle',
    body: JSON.stringify({ email: 'test@example.com', order: 1 }),
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: '1623100000000',
      SenderId: 'test-sender',
      ApproximateFirstReceiveTimestamp: '1623100000000',
    },
    messageAttributes:
      attemptsAttr !== undefined
        ? { attempts: { stringValue: String(attemptsAttr), dataType: 'Number' } }
        : {},
    md5OfBody: 'test-md5',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:us-east-1:000000000000:input-queue-dlq',
    awsRegion: 'us-east-1',
  };
}

function makeEvent(attemptsAttr?: number): SQSEvent {
  return { Records: [makeRecord(attemptsAttr) as SQSEvent['Records'][0]] };
}

const ctx = {} as Context;

// ---------------------------------------------------------------------------

describe('consumer-dlq handler', () => {
  beforeEach(() => {
    mockSend.mock.resetCalls();
  });

  test('lança MaxAttemptsError quando tentativas excedem MAX_ATTEMPTS', async () => {
    // attemptsAttr=3 → attempt = 4 > MAX_ATTEMPTS(3) → lança
    await assert.rejects(
      () => Promise.resolve(handler(makeEvent(3), ctx, () => {})),
      (err: unknown) => {
        assert.ok(err instanceof MaxAttemptsError, 'deveria ser MaxAttemptsError');
        return true;
      }
    );
    // Nenhuma chamada ao SQS após exceder o limite
    assert.equal(mockSend.mock.calls.length, 0);
  });

  test('re-enfileira a mensagem quando tentativas estão dentro do limite', async () => {
    // attemptsAttr=0 → attempt = 1 <= 3 → re-enfileira
    await handler(makeEvent(0), ctx, () => {});
    assert.equal(mockSend.mock.calls.length, 1);
  });

  test('incrementa o atributo attempts na mensagem re-enfileirada', async () => {
    // attemptsAttr=1 → attempt = 2 → MessageAttributes.attempts.StringValue = '2'
    await handler(makeEvent(1), ctx, () => {});
    const cmd = mockSend.mock.calls[0].arguments[0] as { input: Record<string, unknown> };
    const attrsInCmd = cmd.input['MessageAttributes'] as Record<string, { StringValue: string }>;
    assert.equal(attrsInCmd['attempts'].StringValue, '2');
  });

  test('aplica delay exponencial correto baseado na tentativa', async () => {
    // attemptsAttr=1 → attempt=2 → getDelaySeconds(2, 100, 900) = 400
    await handler(makeEvent(1), ctx, () => {});
    const cmd = mockSend.mock.calls[0].arguments[0] as { input: { DelaySeconds: number } };
    assert.equal(cmd.input['DelaySeconds'], 400);
  });

  test('processa mensagem sem atributo de tentativas (primeira vez na DLQ)', async () => {
    // sem attemptsAttr → attempt = 0 + 1 = 1 <= 3 → re-enfileira com attempts='1'
    await handler(makeEvent(), ctx, () => {});
    assert.equal(mockSend.mock.calls.length, 1);
    const cmd = mockSend.mock.calls[0].arguments[0] as { input: Record<string, unknown> };
    const attrsInCmd = cmd.input['MessageAttributes'] as Record<string, { StringValue: string }>;
    assert.equal(attrsInCmd['attempts'].StringValue, '1');
  });

  test('delay na primeira tentativa é 200ms (2^1 * 100)', async () => {
    // attemptsAttr=0 → attempt=1 → getDelaySeconds(1, 100, 900) = 200
    await handler(makeEvent(0), ctx, () => {});
    const cmd = mockSend.mock.calls[0].arguments[0] as { input: { DelaySeconds: number } };
    assert.equal(cmd.input['DelaySeconds'], 200);
  });
});
