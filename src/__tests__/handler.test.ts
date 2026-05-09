import { test, describe, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'stream';
import type { S3Event, Context, Callback } from 'aws-lambda';

const ctx = {} as Context;
const cb = (() => {}) as Callback;

function makeS3Event(bucketName: string, objectKey: string): S3Event {
  return {
    Records: [
      {
        s3: {
          bucket: { name: bucketName },
          object: { key: objectKey },
        },
      },
    ],
  } as unknown as S3Event;
}

describe('execute handler (S3 trigger)', () => {
  let mockSend: ReturnType<typeof mock.fn>;
  let execute: (event: S3Event, context: Context, callback: Callback) => Promise<unknown>;

  before(() => {
    mockSend = mock.fn(async (_cmd: unknown) => ({
      Body: Readable.from([Buffer.from(JSON.stringify({ email: 'test@example.com' }))]),
    }));

    // S3Client é non-configurable no módulo real — injeta módulo fake diretamente no cache
    const s3ModulePath = require.resolve('@aws-sdk/client-s3');
    delete require.cache[s3ModulePath];
    require.cache[s3ModulePath] = {
      id: s3ModulePath,
      filename: s3ModulePath,
      loaded: true,
      exports: {
        S3Client: class MockS3Client { send = mockSend; },
        GetObjectCommand: class GetObjectCommand { constructor(public input: unknown) {} },
      },
      children: [],
      paths: [],
    } as unknown as NodeModule;

    delete require.cache[require.resolve('../handler')];
    ({ execute } = require('../handler') as { execute: typeof execute });
  });

  beforeEach(() => {
    mockSend.mock.resetCalls();
  });

  test('retorna status 200 com conteúdo do arquivo ao processar objeto S3', async () => {
    mockSend.mock.mockImplementationOnce(async () => ({
      Body: Readable.from([Buffer.from(JSON.stringify({ email: 'test@example.com' }))]),
    }));
    const result = await execute(makeS3Event('local-bucket', 'example.json'), ctx, cb) as any;
    assert.equal(result.statusCode, 200);
    const body = JSON.parse(result.body);
    assert.ok(body.message.includes('example.json'));
    assert.ok(body.message.includes('local-bucket'));
  });

  test('envia GetObjectCommand com Bucket e Key corretos', async () => {
    mockSend.mock.mockImplementationOnce(async () => ({
      Body: Readable.from([Buffer.from(JSON.stringify({ data: 'x' }))]),
    }));
    await execute(makeS3Event('meu-bucket', 'pasta/arquivo.json'), ctx, cb);
    const cmd = mockSend.mock.calls[0].arguments[0] as any;
    assert.equal(cmd.input.Bucket, 'meu-bucket');
    assert.equal(cmd.input.Key, 'pasta/arquivo.json');
  });

  test('retorna o conteúdo original do arquivo no body da resposta', async () => {
    const content = JSON.stringify({ id: 1, valor: 'teste' });
    mockSend.mock.mockImplementationOnce(async () => ({
      Body: Readable.from([Buffer.from(content)]),
    }));
    const result = await execute(makeS3Event('local-bucket', 'data.json'), ctx, cb) as any;
    assert.equal(result.statusCode, 200);
    assert.equal(JSON.parse(result.body).content, content);
  });

  test('retorna status 500 quando S3Client.send lança exceção', async () => {
    mockSend.mock.mockImplementationOnce(async () => {
      throw new Error('S3 connection refused');
    });
    const result = await execute(makeS3Event('local-bucket', 'fail.json'), ctx, cb) as any;
    assert.equal(result.statusCode, 500);
    const body = JSON.parse(result.body);
    assert.ok(body.message.includes('Erro ao processar'));
  });

  test('retorna status 500 quando o conteúdo não é JSON válido', async () => {
    mockSend.mock.mockImplementationOnce(async () => ({
      Body: Readable.from([Buffer.from('not-valid-json{')]),
    }));
    const result = await execute(makeS3Event('local-bucket', 'broken.json'), ctx, cb) as any;
    assert.equal(result.statusCode, 500);
  });
});
