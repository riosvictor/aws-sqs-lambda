import { test, describe, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayEvent, Context } from 'aws-lambda';

// Configura envs ANTES do carregamento do módulo
process.env.SNS_ENDPOINT = 'http://localhost:4566';
process.env.AWS_REGION = 'us-east-1';
process.env.TOPIC_ARN = 'arn:aws:sns:us-east-1:000000000000:minha-fila';

const mockSend = mock.fn(async (_cmd: unknown) => ({ MessageId: 'sns-test-message-id' }));

const snsModule = require('@aws-sdk/client-sns') as Record<string, unknown>;
snsModule['SNSClient'] = class MockSNSClient {
  send = mockSend;
};

const producerPath = require.resolve('../producer');
delete require.cache[producerPath];
const { handler } = require('../producer') as { handler: Function };

// ---------------------------------------------------------------------------

function makeEvent(body: string | null = '{"email":"test@example.com"}'): APIGatewayEvent {
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

describe('producer handler (SNS)', () => {
  beforeEach(() => {
    mockSend.mock.resetCalls();
  });

  test('retorna status 200 com messageId em caso de sucesso', async () => {
    const response = await handler(makeEvent(), ctx, () => {});
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.messageId, 'sns-test-message-id');
    assert.ok(body.message);
  });

  test('publica no tópico com o TopicArn correto', async () => {
    await handler(makeEvent(), ctx, () => {});
    assert.equal(mockSend.mock.calls.length, 1);
    const cmd = mockSend.mock.calls[0].arguments[0] as { input: { TopicArn: string } };
    assert.equal(cmd.input['TopicArn'], process.env.TOPIC_ARN);
  });

  test('serializa o body do evento como Message do SNS', async () => {
    const payload = { email: 'paulo@example.com' };
    await handler(makeEvent(JSON.stringify(payload)), ctx, () => {});
    const cmd = mockSend.mock.calls[0].arguments[0] as { input: { Message: string } };
    assert.deepEqual(JSON.parse(cmd.input['Message']), payload);
  });

  test('retorna status 500 quando SNSClient.send lança erro', async () => {
    mockSend.mock.mockImplementationOnce(async () => {
      throw new Error('SNS indisponível');
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
