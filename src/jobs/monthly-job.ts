import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'monthly-job' });

/**
 * Executa o job mensal (último dia do mês às 18h)
 */
export async function runMonthlyJob(): Promise<void> {
  logger.info('Starting monthly job execution');

  // TODO: Implementar lógica do job mensal
  // Exemplo: processar relatórios mensais, enviar emails, etc.

  logger.info('Monthly job completed successfully');
}
