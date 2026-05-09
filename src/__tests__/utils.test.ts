import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateSQSQueueUrlFromArn, getDelaySeconds, getOfflineSqsQueueUrl } from '../utils';

describe('generateSQSQueueUrlFromArn', () => {
  test('converte um ARN válido em URL de fila', () => {
    const arn = 'arn:aws:sqs:us-east-1:123456789012:my-queue';
    assert.equal(
      generateSQSQueueUrlFromArn(arn),
      'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue'
    );
  });

  test('retorna string vazia quando ARN é undefined', () => {
    assert.equal(generateSQSQueueUrlFromArn(undefined), '');
  });
});

describe('getOfflineSqsQueueUrl', () => {
  let originalEndpoint: string | undefined;

  before(() => {
    originalEndpoint = process.env.SQS_OFFLINE_ENDPOINT;
    process.env.SQS_OFFLINE_ENDPOINT = 'http://localhost:4566';
  });

  after(() => {
    process.env.SQS_OFFLINE_ENDPOINT = originalEndpoint;
  });

  test('substitui o host pela variável SQS_OFFLINE_ENDPOINT', () => {
    const result = getOfflineSqsQueueUrl(
      'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue'
    );
    assert.equal(result, 'http://localhost:4566/123456789012/my-queue');
  });
});

describe('getDelaySeconds', () => {
  test('retorna delay exponencial com base na tentativa e base', () => {
    assert.equal(getDelaySeconds(1, 100, 900), 200); // 2^1 * 100 = 200
    assert.equal(getDelaySeconds(2, 100, 900), 400); // 2^2 * 100 = 400
    assert.equal(getDelaySeconds(3, 100, 900), 800); // 2^3 * 100 = 800
  });

  test('retorna 100 para tentativa 0 (2^0 * 100)', () => {
    assert.equal(getDelaySeconds(0, 100, 900), 100);
  });

  test('limita delay a 900 quando delayMax > 900', () => {
    assert.equal(getDelaySeconds(10, 100, 9000), 900);
  });

  test('limita delay ao delayMax quando delayMax <= 900', () => {
    assert.equal(getDelaySeconds(5, 100, 500), 500); // 3200 → capped em 500
    assert.equal(getDelaySeconds(4, 100, 900), 900); // 1600 → capped em 900
  });
});
