import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { APIGatewayProxyHandler, APIGatewayEvent, ProxyResult } from 'aws-lambda';

const client = new SNSClient({
  endpoint: process.env.SNS_ENDPOINT_URL,
  region: process.env.AWS_REGION,
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const handler: APIGatewayProxyHandler = async (event: APIGatewayEvent): Promise<ProxyResult> => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid request body',
        }),
      };
    }

    const body = JSON.parse(event.body);
    if (!isObject(body)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid request body' }),
      };
    }

    const transactionId =
      typeof body.transactionId === 'string' && body.transactionId.trim().length > 0
        ? body.transactionId
        : `tx-${Date.now()}`;

    const message = {
      eventType: 'PedidoCriado',
      eventId: `evt-${Date.now()}`,
      transactionId,
      createdAt: new Date().toISOString(),
      source: 'checkout-api',
      payload: body,
    };

    const command = new PublishCommand({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Message: JSON.stringify(message),
    });

    const data = await client.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Message published successfully',
        messageId: data.MessageId,
      }),
    };
  } catch (err) {
    if (err instanceof SyntaxError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid JSON body',
        }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error publishing message to SNS',
        error: JSON.stringify(err),
      }),
    };
  } finally {
    console.log('Message published at', new Date().toISOString());
  }
};