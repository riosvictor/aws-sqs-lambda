import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { APIGatewayProxyHandler, APIGatewayEvent, ProxyResult } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (event: APIGatewayEvent): Promise<ProxyResult> => {
  const client = new SNSClient({
    endpoint: process.env.SNS_ENDPOINT,
    region: process.env.AWS_REGION,
  });

  const topicArn = process.env.TOPIC_ARN ?? '';
  const body = JSON.parse(event.body ?? '{}');

  const command = new PublishCommand({
    Message: JSON.stringify(body),
    TopicArn: topicArn,
  });
  
  try {
    const data = await client.send(command);

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
        message: 'Error sending message to SNS',
        error: JSON.stringify(err),
      }),
    };
  }
};
