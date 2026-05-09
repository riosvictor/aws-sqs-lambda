import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Backoff } from '../backoff.class';

describe('Backoff', () => {
  describe('calculateExponentialDelay', () => {
    test('retorna base * 2^0 na tentativa 0', () => {
      const backoff = new Backoff(100, 900);
      assert.equal(backoff.calculateExponentialDelay(0), 100);
    });

    test('dobra o delay a cada tentativa subsequente', () => {
      const backoff = new Backoff(100, 900);
      assert.equal(backoff.calculateExponentialDelay(1), 200);
      assert.equal(backoff.calculateExponentialDelay(2), 400);
      assert.equal(backoff.calculateExponentialDelay(3), 800);
    });

    test('limita o delay ao limite configurado (900)', () => {
      const backoff = new Backoff(100, 900);
      assert.equal(backoff.calculateExponentialDelay(4), 900); // 1600 → capped em 900
      assert.equal(backoff.calculateExponentialDelay(10), 900); // muito acima do limite
    });

    test('respeita limite customizado menor que 900', () => {
      const backoff = new Backoff(50, 200);
      assert.equal(backoff.calculateExponentialDelay(0), 50);
      assert.equal(backoff.calculateExponentialDelay(2), 200); // 200 = limite
      assert.equal(backoff.calculateExponentialDelay(3), 200); // 400 → capped em 200
    });

    test('quando limite é menor que base, sempre retorna o limite', () => {
      const backoff = new Backoff(500, 100);
      assert.equal(backoff.calculateExponentialDelay(0), 100); // 500 > 100 → capped
    });
  });
});
