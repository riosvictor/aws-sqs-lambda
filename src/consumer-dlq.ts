import { Context, SQSEvent, SQSHandler } from 'aws-lambda';
import { getDelaySeconds } from './utils';
import { MessageAttributeValue, SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { MaxAttemptsError } from './max-attempts.exception';

const client = new SQSClient({
  endpoint: process.env.QUEUE_HOST_URL,
  region: process.env.AWS_REGION
});

const queueUrl = process.env.QUEUE_URL ?? ''

export const handler: SQSHandler = async (event: SQSEvent, context: Context): Promise<void> => {
  console.log('Messages received in [Consumer DLQ] at ', new Date().toISOString());
  
  for (const record of event.Records) {
    const body = JSON.parse(record.body)
    const maxAttempts = parseInt(process.env.MAX_ATTEMPTS ?? '3')
    const base = parseInt(process.env.DELAY_BASE ?? '100')
    const delayMax = 900 // 15 minutes delay max of AWS SQS
    const queueName = record.eventSourceARN.split(':').pop()
    const attempt =
      (record.messageAttributes?.attempts 
        ? parseInt(record.messageAttributes.attempts.stringValue!) 
        : 0
      ) + 1

    console.debug(`[${queueName}] Processing message in attempt [${attempt}] from [${maxAttempts}]`)

    if (attempt > maxAttempts) {
      throw new MaxAttemptsError(attempt, maxAttempts);
    }

    const attributes = (record.messageAttributes ?? {}) as unknown as Record<string, MessageAttributeValue>;
    attributes.attempts = {
      DataType: 'Number',
      StringValue: attempt.toString()
    };

    const delaySeconds = getDelaySeconds(attempt, base, delayMax);

    console.info(`Message replayed to main SQS queue with delay seconds ${delaySeconds}`);

    const command = new SendMessageCommand({
      MessageBody: JSON.stringify(body),
      QueueUrl: queueUrl,
      MessageAttributes: attributes,
      DelaySeconds: delaySeconds
    });

    await client.send(command);
  }

  console.log('Messages processed at ', new Date().toISOString());
};
