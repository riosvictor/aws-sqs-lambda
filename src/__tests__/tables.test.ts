import { test, describe, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

const ctx = {} as Context;

function makeGetEvent(tableName?: string): APIGatewayProxyEvent {
  return {
    queryStringParameters: tableName ? { tableName } : null,
  } as unknown as APIGatewayProxyEvent;
}

function makePostEvent(tableName: string, body: Record<string, string>): APIGatewayProxyEvent {
  return {
    queryStringParameters: { tableName },
    body: JSON.stringify(body),
  } as unknown as APIGatewayProxyEvent;
}

describe('get handler (ListTablesCommand)', () => {
  let mockSend: ReturnType<typeof mock.fn>;
  let get: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

  before(() => {
    mockSend = mock.fn(async (_cmd: unknown) => ({
      TableNames: ['tabela-1', 'tabela-2'],
    }));
    const clientModule = require('@aws-sdk/client-dynamodb') as Record<string, unknown>;
    clientModule['DynamoDBClient'] = class MockDynamoDBClient {
      send = mockSend;
    };
    delete require.cache[require.resolve('../tables')];
    ({ get } = require('../tables') as { get: typeof get });
  });

  beforeEach(() => {
    mockSend.mock.resetCalls();
  });

  test('retorna status 200 com lista de tabelas', async () => {
    const result = await get(makeGetEvent());
    assert.equal(result.statusCode, 200);
    assert.deepEqual(JSON.parse(result.body), ['tabela-1', 'tabela-2']);
  });

  test('passa tableName como ExclusiveStartTableName quando fornecido', async () => {
    await get(makeGetEvent('tabela-1'));
    assert.equal(mockSend.mock.calls.length, 1);
    const cmd = mockSend.mock.calls[0].arguments[0] as any;
    assert.equal(cmd.input.ExclusiveStartTableName, 'tabela-1');
  });

  test('passa undefined como ExclusiveStartTableName quando tableName não fornecido', async () => {
    await get(makeGetEvent());
    const cmd = mockSend.mock.calls[0].arguments[0] as any;
    assert.equal(cmd.input.ExclusiveStartTableName, undefined);
  });

  test('propaga erro quando DynamoDBClient.send lança exceção', async () => {
    mockSend.mock.mockImplementationOnce(async () => {
      throw new Error('DynamoDB unavailable');
    });
    await assert.rejects(
      () => Promise.resolve(get(makeGetEvent())),
      /DynamoDB unavailable/
    );
  });
});

describe('postItem handler (PutItemCommand)', () => {
  let mockSend: ReturnType<typeof mock.fn>;
  let postItem: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

  before(() => {
    mockSend = mock.fn(async (_cmd: unknown) => ({}));
    const clientModule = require('@aws-sdk/client-dynamodb') as Record<string, unknown>;
    clientModule['DynamoDBClient'] = class MockDynamoDBClient {
      send = mockSend;
    };
    delete require.cache[require.resolve('../tables')];
    ({ postItem } = require('../tables') as { postItem: typeof postItem });
  });

  beforeEach(() => {
    mockSend.mock.resetCalls();
  });

  test('retorna status 200 com mensagem de sucesso', async () => {
    const result = await postItem(makePostEvent('sdksTable', { key: 'test', payload: '{}' }));
    assert.equal(result.statusCode, 200);
    assert.deepEqual(JSON.parse(result.body), { message: 'Item added successfully' });
  });

  test('converte os campos do body para formato AttributeValue {S: value}', async () => {
    await postItem(makePostEvent('sdksTable', { key: 'abc', payload: '{"x":1}' }));
    const cmd = mockSend.mock.calls[0].arguments[0] as any;
    assert.deepEqual(cmd.input.Item, {
      key: { S: 'abc' },
      payload: { S: '{"x":1}' },
    });
  });

  test('usa o tableName da query string como TableName', async () => {
    await postItem(makePostEvent('minha-tabela', { campo: 'valor' }));
    const cmd = mockSend.mock.calls[0].arguments[0] as any;
    assert.equal(cmd.input.TableName, 'minha-tabela');
  });

  test('propaga erro quando DynamoDBClient.send lança exceção', async () => {
    mockSend.mock.mockImplementationOnce(async () => {
      throw new Error('DynamoDB write error');
    });
    await assert.rejects(
      () => Promise.resolve(postItem(makePostEvent('t', { k: 'v' }))),
      /DynamoDB write error/
    );
  });
});
