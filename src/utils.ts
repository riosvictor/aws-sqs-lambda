import { Backoff } from './backoff.class';

export const generateSQSQueueUrlFromArn = (arn: string | undefined): string => {
  if (!arn) return '';
  const [_, __, ___, region, accountId, queueName] = arn.split(':');
  return `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`;
};

export const getOfflineSqsQueueUrl = (sqsQueueUrl: string) => {
  const url = new URL(sqsQueueUrl);
  return `${process.env.SQS_OFFLINE_ENDPOINT}${url.pathname}`;
};

export const getDelaySeconds = (attempt: number) => {
  const base = parseInt(process.env.DELAY_BASE ?? '1');
  const delayMax = parseInt(process.env.DELAY_MAX ?? '900');
  const limit = delayMax > 900 ? 900 : delayMax;
  const backoffStrategy = new Backoff(base, limit);
  const delaySeconds = backoffStrategy.calculateExponentialDelay(attempt);

  return delaySeconds;
}