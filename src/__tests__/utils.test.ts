import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'stream';
import { streamToString } from '../utils';

describe('streamToString', () => {
  test('converte stream de chunks em string UTF-8', async () => {
    const stream = Readable.from([Buffer.from('hello'), Buffer.from(' '), Buffer.from('world')]);
    const result = await streamToString(stream);
    assert.equal(result, 'hello world');
  });

  test('converte stream com conteúdo JSON em string', async () => {
    const json = JSON.stringify({ email: 'test@example.com', id: 42 });
    const stream = Readable.from([Buffer.from(json)]);
    const result = await streamToString(stream);
    assert.equal(result, json);
    // o caller pode fazer JSON.parse sem erros
    assert.deepEqual(JSON.parse(result), { email: 'test@example.com', id: 42 });
  });

  test('rejeita a promise quando o stream emite erro', async () => {
    const stream = new Readable({
      read() {
        this.emit('error', new Error('stream read error'));
      },
    });
    await assert.rejects(
      () => streamToString(stream),
      /stream read error/
    );
  });

  test('resolve com string vazia para stream sem dados', async () => {
    const stream = Readable.from([]);
    const result = await streamToString(stream);
    assert.equal(result, '');
  });
});
