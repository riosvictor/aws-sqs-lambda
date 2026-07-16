/**
 * Verifica se uma data é o último dia do mês no timezone America/Sao_Paulo
 */
export function isLastDayOfMonth(date: Date): boolean {
  // Formatar data no timezone de São Paulo
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find((p) => p.type === 'month')!.value, 10);
  const day = parseInt(parts.find((p) => p.type === 'day')!.value, 10);

  // Criar data do próximo dia
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tomorrowParts = formatter.formatToParts(tomorrow);
  const tomorrowMonth = parseInt(
    tomorrowParts.find((p) => p.type === 'month')!.value,
    10
  );

  // Se amanhã está em outro mês, hoje é o último dia do mês
  return month !== tomorrowMonth;
}

/**
 * Obtém a data/hora atual no timezone America/Sao_Paulo
 */
export function getCurrentDateInSaoPaulo(): Date {
  return new Date();
}
