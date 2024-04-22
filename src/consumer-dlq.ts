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
  console.log('Max attempts: ', process.env.MAX_ATTEMPTS);
  console.log('Delay Base: ', process.env.DELAY_BASE);

  const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS ?? '3');
  
  for (const record of event.Records) {
    const messageBody = JSON.parse(record.body);
    const queueName = record.eventSourceARN.split(':').pop() ?? '';
    let attempts = 0;
    
    console.log(`[CONSUMER] at: ${queueName} | message: ${JSON.stringify(messageBody)}`);
    
    if (record.messageAttributes && record.messageAttributes.attempts) {
      attempts = parseInt(record.messageAttributes.attempts.stringValue!);
    }

    console.log('Number of retries already done: ', attempts);
    attempts++;

    if (attempts > MAX_ATTEMPTS) {
      throw new MaxAttemptsError(attempts, MAX_ATTEMPTS);
    }

    const attributes = (record.messageAttributes ?? {}) as unknown as Record<string, MessageAttributeValue>;
    attributes.attempts = {
      DataType: 'Number',
      StringValue: attempts.toString()
    };

    const delaySeconds = getDelaySeconds(attempts);

    console.info(`Message replayed to main SQS queue with delay seconds ${delaySeconds}`);

    const command = new SendMessageCommand({
      MessageBody: JSON.stringify(messageBody),
      QueueUrl: queueUrl,
      MessageAttributes: attributes,
      DelaySeconds: delaySeconds
    });

    await client.send(command);
  }

  console.log('Messages processed at ', new Date().toISOString());
};
