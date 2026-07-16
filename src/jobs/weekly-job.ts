import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'weekly-job' });

/**
 * Executa o job semanal (toda sexta-feira às 18h, exceto no último dia do mês)
 */
export async function runWeeklyJob(): Promise<void> {
  logger.info('Starting weekly job execution');

  // TODO: Implementar lógica do job semanal
  // Exemplo: enviar relatórios semanais, processar dados, etc.

  logger.info('Weekly job completed successfully');
}
