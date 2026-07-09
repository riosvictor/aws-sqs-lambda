import { Logger } from '@aws-lambda-powertools/logger';
import { MetricUnit, Metrics } from '@aws-lambda-powertools/metrics';
import { SQSBatchResponse, SQSEvent, SQSHandler } from 'aws-lambda';

const logger = new Logger({ serviceName: 'consumer-log' });
const metrics = new Metrics({ namespace: 'CheckoutPOC', serviceName: 'consumer-log' });

const parseSnsPayload = (body: string): unknown => {
  const snsEnvelope = JSON.parse(body) as { Message?: string };
  if (!snsEnvelope.Message) {
    throw new Error('SNS envelope without Message');
  }

  return JSON.parse(snsEnvelope.Message);
};

export const handler: SQSHandler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      const payload = parseSnsPayload(record.body);
      logger.info('Mensagem recebida na fila de log', {
        messageId: record.messageId,
        payload,
      });
      metrics.addMetric('LoggingQueueProcessed', MetricUnit.Count, 1);
    } catch (error) {
      logger.error('Falha ao processar mensagem na fila de log', {
        messageId: record.messageId,
        error,
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
      metrics.addMetric('LoggingQueueFailed', MetricUnit.Count, 1);
    }
  }

  metrics.publishStoredMetrics();
  return { batchItemFailures };
};
