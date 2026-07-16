import { describe, it, mock } from 'node:test';
import * as assert from 'node:assert';
import { Context } from 'aws-lambda';
import * as dateUtils from '../date-utils';
import * as monthlyJob from '../jobs/monthly-job';
import * as weeklyJob from '../jobs/weekly-job';

// Mock do Context Lambda
const createMockContext = (): Context => ({
  awsRequestId: 'test-request-id',
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'scheduled-jobs',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:scheduled-jobs',
  memoryLimitInMB: '128',
  logGroupName: '/aws/lambda/scheduled-jobs',
  logStreamName: '2024/01/15/[$LATEST]test',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
});

describe('scheduled-handler', () => {
  it('should execute monthly job when jobType is monthly', async () => {
    const { handler } = await import('../scheduled-handler');
    
    // Mock das funções
    const isLastDayMock = mock.fn(() => false);
    const runMonthlyMock = mock.fn(async () => {});
    const runWeeklyMock = mock.fn(async () => {});

    mock.method(dateUtils, 'isLastDayOfMonth', isLastDayMock);
    mock.method(dateUtils, 'getCurrentDateInSaoPaulo', () => new Date('2024-01-15T18:00:00.000Z'));
    mock.method(monthlyJob, 'runMonthlyJob', runMonthlyMock);
    mock.method(weeklyJob, 'runWeeklyJob', runWeeklyMock);

    await handler({ jobType: 'monthly' }, createMockContext());

    assert.strictEqual(runMonthlyMock.mock.callCount(), 1);
    assert.strictEqual(runWeeklyMock.mock.callCount(), 0);
  });

  it('should execute weekly job when jobType is weekly and not last day of month', async () => {
    const { handler } = await import('../scheduled-handler');
    
    const isLastDayMock = mock.fn(() => false);
    const runMonthlyMock = mock.fn(async () => {});
    const runWeeklyMock = mock.fn(async () => {});

    mock.method(dateUtils, 'isLastDayOfMonth', isLastDayMock);
    mock.method(dateUtils, 'getCurrentDateInSaoPaulo', () => new Date('2024-01-15T18:00:00.000Z'));
    mock.method(monthlyJob, 'runMonthlyJob', runMonthlyMock);
    mock.method(weeklyJob, 'runWeeklyJob', runWeeklyMock);

    await handler({ jobType: 'weekly' }, createMockContext());

    assert.strictEqual(runMonthlyMock.mock.callCount(), 0);
    assert.strictEqual(runWeeklyMock.mock.callCount(), 1);
  });

  it('should skip weekly job when it is the last day of month', async () => {
    const { handler } = await import('../scheduled-handler');
    
    const isLastDayMock = mock.fn(() => true);
    const runMonthlyMock = mock.fn(async () => {});
    const runWeeklyMock = mock.fn(async () => {});

    mock.method(dateUtils, 'isLastDayOfMonth', isLastDayMock);
    mock.method(dateUtils, 'getCurrentDateInSaoPaulo', () => new Date('2024-01-31T18:00:00.000Z'));
    mock.method(monthlyJob, 'runMonthlyJob', runMonthlyMock);
    mock.method(weeklyJob, 'runWeeklyJob', runWeeklyMock);

    await handler({ jobType: 'weekly' }, createMockContext());

    // Nenhum job deve ser executado (weekly é pulado)
    assert.strictEqual(runMonthlyMock.mock.callCount(), 0);
    assert.strictEqual(runWeeklyMock.mock.callCount(), 0);
  });

  it('should throw error for invalid jobType', async () => {
    const { handler } = await import('../scheduled-handler');
    
    mock.method(dateUtils, 'isLastDayOfMonth', () => false);
    mock.method(dateUtils, 'getCurrentDateInSaoPaulo', () => new Date('2024-01-15T18:00:00.000Z'));

    await assert.rejects(
      async () => handler({ jobType: 'invalid' as any }, createMockContext()),
      /Invalid jobType/
    );
  });
});
