import { test, describe, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayEvent, Context } from 'aws-lambda';

// Configura envs ANTES do carregamento do módulo
process.env.QUEUE_HOST_URL = 'http://localhost:4566';
process.env.AWS_REGION = 'us-east-1';
process.env.QUEUE_URL = 'http://localhost:4566/000000000000/input-queue';

// Mock do SQSClient.send antes de carregar o producer
const mockSend = mock.fn(async (_cmd: unknown) => ({ MessageId: 'test-message-id' }));

const sqsModule = require('@aws-sdk/client-sqs') as Record<string, unknown>;
sqsModule['SQSClient'] = class MockSQSClient {
  send = mockSend;
};

// Carrega producer com mock aplicado
const producerPath = require.resolve('../producer');
delete require.cache[producerPath];
const { handler } = require('../producer') as { handler: Function };

// ---------------------------------------------------------------------------

function makeEvent(body: string | null = '{"email":"test@example.com","order":1}'): APIGatewayEvent {
  return {
    body,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/producer',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayEvent['requestContext'],
    resource: '',
  };
}

const ctx = {} as Context;

// ---------------------------------------------------------------------------

describe('producer handler', () => {
  beforeEach(() => {
    mockSend.mock.resetCalls();
  });

  test('retorna status 200 com messageId em caso de sucesso', async () => {
    const response = await handler(makeEvent(), ctx, () => {});
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.messageId, 'test-message-id');
    assert.ok(body.message);
  });

  test('envia mensagem ao SQS com a URL correta', async () => {
    await handler(makeEvent(), ctx, () => {});
    assert.equal(mockSend.mock.calls.length, 1);
    const cmd = mockSend.mock.calls[0].arguments[0] as { input: { QueueUrl: string } };
    assert.equal(cmd.input['QueueUrl'], process.env.QUEUE_URL);
  });

  test('serializa o body do evento como MessageBody', async () => {
    const payload = { email: 'paulo@example.com', order: 42 };
    await handler(makeEvent(JSON.stringify(payload)), ctx, () => {});
    const cmd = mockSend.mock.calls[0].arguments[0] as { input: { MessageBody: string } };
    const sent = JSON.parse(cmd.input['MessageBody'] as string);
    assert.deepEqual(sent, payload);
  });

  test('retorna status 500 quando SQSClient.send lança erro', async () => {
    mockSend.mock.mockImplementationOnce(async () => {
      throw new Error('Conexão recusada pelo SQS');
    });
    const response = await handler(makeEvent(), ctx, () => {});
    assert.equal(response.statusCode, 500);
    const body = JSON.parse(response.body);
    assert.ok(body.message.includes('Error'));
  });

  test('processa body null sem lançar exceção (usa {} como padrão)', async () => {
    const response = await handler(makeEvent(null), ctx, () => {});
    assert.equal(response.statusCode, 200);
  });
});
