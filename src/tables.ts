import { DynamoDBClient, ListTablesCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { APIGatewayEvent, ProxyResult } from 'aws-lambda';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION as string,
  endpoint: process.env.DB_HOST_URL as string,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})


export const get = async (event: APIGatewayEvent): Promise<ProxyResult> => {
  const tableName = event.queryStringParameters?.tableName;
  // ListTablesInput
  const command = new ListTablesCommand({
    ExclusiveStartTableName: tableName,
  });
  const response = await client.send(command);
  console.log(response.TableNames);

  return {
    statusCode: 200,
    body: JSON.stringify(response.TableNames),
  };
}

export const postItem = async (event: APIGatewayEvent): Promise<ProxyResult> => {
  const tableName = event.queryStringParameters?.tableName;
  const body = JSON.parse(event.body as string);
  const Item = Object.keys(body).reduce((acc, key) => {
    acc[key] = { S: body[key] };
    return acc;
  }, {} as any);

  // ListTablesInput
  const command = new PutItemCommand({
    TableName: tableName,
    Item
  });
  await client.send(command);
  
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Item added successfully' }),
  };
}

