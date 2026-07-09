import { Logger } from '@aws-lambda-powertools/logger';
import { MetricUnit, Metrics } from '@aws-lambda-powertools/metrics';
import { IdempotencyConfig, makeIdempotent } from '@aws-lambda-powertools/idempotency';
import { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Context, SQSBatchResponse, SQSEvent, SQSHandler } from 'aws-lambda';

const logger = new Logger({ serviceName: 'consumer-resilient' });
const metrics = new Metrics({ namespace: 'CheckoutPOC', serviceName: 'consumer-resilient' });

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION,
  endpoint: process.env.QUEUE_HOST_URL,
});

const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: process.env.IDEMPOTENCY_TABLE_NAME ?? '',
  keyAttr: 'transactionId',
  clientConfig: {
    region: process.env.AWS_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT_URL,
  },
});

const idempotencyConfig = new IdempotencyConfig({
  eventKeyJmesPath: 'transactionId',
});

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

type CheckoutEvent = {
  eventType: string;
  transactionId: string;
  payload: {
    email?: string;
    invalid?: boolean;
    forceTransientError?: boolean;
  };
};

const parseEvent = (body: string): CheckoutEvent => {
  const snsEnvelope = JSON.parse(body) as { Message?: string };
  if (!snsEnvelope.Message) {
    throw new ValidationError('SNS envelope sem Message');
  }

  const event = JSON.parse(snsEnvelope.Message) as CheckoutEvent;
  if (!event.transactionId || !event.eventType) {
    throw new ValidationError('Evento sem transactionId/eventType');
  }

  return event;
};

type ProcessResult = {
  success: boolean;
  transactionId: string;
  processedAt: string;
};

const processBusinessLogic = async (
  event: CheckoutEvent,
  _context?: Context
): Promise<ProcessResult> => {
  if (event.payload.invalid) {
    throw new ValidationError('Payload inválido');
  }

  if (!event.payload.email || typeof event.payload.email !== 'string') {
    throw new ValidationError('email inválido');
  }

  if (event.payload.forceTransientError) {
    throw new Error('transient_failure');
  }

  const result: ProcessResult = {
    success: true,
    transactionId: event.transactionId,
    processedAt: new Date().toISOString(),
  };

  logger.info('Pedido processado com sucesso', {
    transactionId: event.transactionId,
    eventType: event.eventType,
  });

  return result;
};

const processBusinessLogicIdempotently = makeIdempotent(processBusinessLogic, {
  persistenceStore,
  config: idempotencyConfig,
});

const sendToFinalErrorQueue = async (recordBody: string): Promise<void> => {
  const queueUrl = process.env.FINAL_ERROR_QUEUE_URL;
  if (!queueUrl) {
    throw new Error('FINAL_ERROR_QUEUE_URL not configured');
  }

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: recordBody,
    })
  );
};

export const handler: SQSHandler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      const parsed = parseEvent(record.body);
      await processBusinessLogicIdempotently(parsed, context);
      metrics.addMetric('ResilientProcessed', MetricUnit.Count, 1);
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.warn('Poison pill detectada, desviando para fila de erro final', {
          messageId: record.messageId,
          error: error.message,
        });
        await sendToFinalErrorQueue(record.body);
        metrics.addMetric('PermanentFailures', MetricUnit.Count, 1);
        continue;
      }

      logger.error('Falha transiente, item retornará para retry', {
        messageId: record.messageId,
        error,
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
      metrics.addMetric('TransientFailures', MetricUnit.Count, 1);
    }
  }

  if (process.env.IS_OFFLINE === 'true' && batchItemFailures.length > 0) {
    metrics.publishStoredMetrics();
    throw new Error('offline_retry_required');
  }

  metrics.publishStoredMetrics();
  return { batchItemFailures };
};
