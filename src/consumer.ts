import { SQSEvent, SQSHandler } from 'aws-lambda';

export const handler: SQSHandler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    const messageBody = JSON.parse(record.body);
    console.log('[CONSUMER]:', messageBody);
    // Adicione sua lógica de processamento de mensagem aqui
  }
};
