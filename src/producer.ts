import { APIGatewayProxyHandler, APIGatewayEvent, ProxyResult } from 'aws-lambda';
import { SQS } from 'aws-sdk';

export const handler: APIGatewayProxyHandler = async (event: APIGatewayEvent): Promise<ProxyResult> => {
  const sqs = new SQS({
    endpoint: process.env.QUEUE_HOST_URL,
    region: process.env.AWS_REGION
  });

  const queueUrl = process.env.QUEUE_URL ?? ''
  const body = JSON.parse(event.body ?? '{}')
  
  const params: SQS.SendMessageRequest = {
    MessageBody: JSON.stringify(body),
    QueueUrl: queueUrl,
  };

  try {
    const data = await sqs.sendMessage(params).promise();
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Message sent successfully', 
        messageId: data.MessageId
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error sending message to SQS',
        error: JSON.stringify(err),
      }),
    };
  }
};