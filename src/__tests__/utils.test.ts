/**
 * Testes para utils.ts — branch dynamodb
 *
 * NOTA: As funções generateSQSQueueUrlFromArn, getOfflineSqsQueueUrl e getDelaySeconds
 * são código morto neste branch (não utilizadas por tables.ts). Os testes abaixo
 * documentam o comportamento esperado e servem de guard rail para o caso de
 * essas funções serem reutilizadas.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateSQSQueueUrlFromArn, getOfflineSqsQueueUrl } from '../utils';

describe('generateSQSQueueUrlFromArn', () => {
  test('converte ARN de fila SQS em URL', () => {
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

  test('substitui o host da URL pelo endpoint offline', () => {
    const result = getOfflineSqsQueueUrl(
      'https://sqs.us-east-1.amazonaws.com/000000000000/minha-fila'
    );
    assert.equal(result, 'http://localhost:4566/000000000000/minha-fila');
  });
});
