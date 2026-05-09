import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MaxAttemptsError } from '../max-attempts.exception';

describe('MaxAttemptsError', () => {
  test('é uma instância de Error', () => {
    const err = new MaxAttemptsError(4, 3);
    assert.ok(err instanceof Error);
  });

  test('tem name igual a MaxAttemptsError', () => {
    const err = new MaxAttemptsError(4, 3);
    assert.equal(err.name, 'MaxAttemptsError');
  });

  test('gera mensagem padrão com valores de replay e max', () => {
    const err = new MaxAttemptsError(4, 3);
    assert.ok(err.message.includes('4'));
    assert.ok(err.message.includes('3'));
  });

  test('aceita mensagem customizada', () => {
    const err = new MaxAttemptsError(4, 3, 'mensagem customizada');
    assert.equal(err.message, 'mensagem customizada');
  });

  test('pode ser capturado com instanceof MaxAttemptsError', () => {
    try {
      throw new MaxAttemptsError(5, 3);
    } catch (e) {
      assert.ok(e instanceof MaxAttemptsError);
      assert.ok(e instanceof Error);
    }
  });
});
