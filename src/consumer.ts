import { Context, SQSEvent, SQSHandler } from 'aws-lambda';

let counter = 0;

export const handler: SQSHandler = async (event: SQSEvent, context: Context): Promise<void> => {
  console.log('Messages received in [Consumer] at ', new Date().toISOString());
  console.log(`Counter value: ${++counter}`)

  if (counter < 4) {
    throw new Error('Error on processing message');
  }

  for (const record of event.Records) {
    const messageBody = JSON.parse(record.body);
    console.log('[CONSUMER]:', messageBody);
    // Adicione sua lógica de processamento de mensagem aqui
  }

  console.log('Messages processed at ', new Date().toISOString());
};
