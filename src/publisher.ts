import { APIGatewayEvent, ProxyResult } from 'aws-lambda';
import SQS from 'aws-sdk/clients/sqs';
import { generateSQSQueueUrlFromArn, getOfflineSqsQueueUrl } from './utils';

const isOffline = process.env.IS_OFFLINE === 'true'
const sqsQueueUrl = generateSQSQueueUrlFromArn(process.env.FIFO_QUEUE_ARN);
const url = isOffline ? getOfflineSqsQueueUrl(sqsQueueUrl) : sqsQueueUrl;

const options = isOffline ? {
  credentials: {
    accessKeyId: 'doesnt_matter',
    secretAccessKey: 'doesnt_matter'
  },
  endpoint: 'http://localhost:9324'
} : {}

const sqs = new SQS(options);

export const handler = async (event: APIGatewayEvent): Promise<ProxyResult> => {
  if (!sqsQueueUrl) {
    return {
      statusCode: 404,
      body: 'Queue not found',
    };
  }

  let statusCode = 200;
  let message;

  try {
    await sqs
      .sendMessage({
        QueueUrl: url,
        MessageBody: event.body || ''
      })
      .promise();

    message = "Successfully enqueued message!";
  } catch (error) {
    console.log(error);
    message = error;
    statusCode = 500;
  } finally {
    return {
      statusCode,
      body: JSON.stringify({
        message,
      }),
    };
  }
};