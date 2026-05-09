import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateSQSQueueUrlFromArn, getOfflineSqsQueueUrl } from '../utils';

describe('generateSQSQueueUrlFromArn', () => {
  test('converte um ARN válido em URL de fila SQS', () => {
    const arn = 'arn:aws:sqs:us-east-1:000000000000:minha-fila';
    assert.equal(
      generateSQSQueueUrlFromArn(arn),
      'https://sqs.us-east-1.amazonaws.com/000000000000/minha-fila'
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

  test('substitui o host da URL pelo endpoint offline configurado em env', () => {
    const result = getOfflineSqsQueueUrl(
      'https://sqs.us-east-1.amazonaws.com/000000000000/minha-fila'
    );
    assert.equal(result, 'http://localhost:4566/000000000000/minha-fila');
  });
});
