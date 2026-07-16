import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { isLastDayOfMonth } from '../date-utils';

describe('date-utils', () => {
  describe('isLastDayOfMonth', () => {
    it('should return true for the last day of the month (31st)', () => {
      // Janeiro tem 31 dias
      const lastDayJanuary = new Date('2024-01-31T15:00:00.000Z');
      assert.strictEqual(isLastDayOfMonth(lastDayJanuary), true);
    });

    it('should return true for the last day of February (leap year)', () => {
      // 2024 é ano bissexto, fevereiro tem 29 dias
      const lastDayFebruary = new Date('2024-02-29T15:00:00.000Z');
      assert.strictEqual(isLastDayOfMonth(lastDayFebruary), true);
    });

    it('should return true for the last day of February (non-leap year)', () => {
      // 2023 não é bissexto, fevereiro tem 28 dias
      const lastDayFebruary = new Date('2023-02-28T15:00:00.000Z');
      assert.strictEqual(isLastDayOfMonth(lastDayFebruary), true);
    });

    it('should return false for a day in the middle of the month', () => {
      const middleDay = new Date('2024-01-15T15:00:00.000Z');
      assert.strictEqual(isLastDayOfMonth(middleDay), false);
    });

    it('should return false for the first day of the month', () => {
      const firstDay = new Date('2024-01-01T15:00:00.000Z');
      assert.strictEqual(isLastDayOfMonth(firstDay), false);
    });

    it('should return false for the second-to-last day of the month', () => {
      const secondToLast = new Date('2024-01-30T15:00:00.000Z');
      assert.strictEqual(isLastDayOfMonth(secondToLast), false);
    });

    it('should handle months with 30 days correctly', () => {
      // Abril tem 30 dias
      const lastDayApril = new Date('2024-04-30T15:00:00.000Z');
      assert.strictEqual(isLastDayOfMonth(lastDayApril), true);

      const notLastDay = new Date('2024-04-29T15:00:00.000Z');
      assert.strictEqual(isLastDayOfMonth(notLastDay), false);
    });
  });
});
