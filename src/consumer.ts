import { SQSEvent } from 'aws-lambda';

export const handler = async (event: SQSEvent) => {
  console.log('SQS Consumer Event Log:', JSON.stringify(event, null, 2));
};