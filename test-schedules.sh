#!/bin/bash

# Script para testar invocações da Lambda com duplo schedule

echo "🧪 Testando Lambda com Duplo Schedule"
echo "======================================"
echo ""

# Teste 1: Job Mensal
echo "📅 Teste 1: Job Mensal"
echo "Esperado: Executar runMonthlyJob()"
echo "---"
npx serverless invoke local -f scheduled-jobs --data '{"jobType":"monthly"}'
echo ""
echo ""

# Teste 2: Job Semanal (dia normal)
echo "📊 Teste 2: Job Semanal (dia normal)"
echo "Esperado: Executar runWeeklyJob()"
echo "---"
npx serverless invoke local -f scheduled-jobs --data '{"jobType":"weekly"}'
echo ""
echo ""

# Teste 3: Job Semanal usando arquivo
echo "📁 Teste 3: Job Semanal (usando arquivo de payload)"
echo "---"
npx serverless invoke local -f scheduled-jobs --path test-payloads/weekly.json
echo ""
echo ""

# Teste 4: JobType inválido
echo "❌ Teste 4: JobType Inválido"
echo "Esperado: Erro e stack trace"
echo "---"
npx serverless invoke local -f scheduled-jobs --data '{"jobType":"invalid"}'
echo ""
echo ""

echo "✅ Testes concluídos!"
echo ""
echo "💡 Nota: Para testar o skip do job semanal no último dia do mês,"
echo "   modifique temporariamente date-utils.ts para forçar isLastDayOfMonth() retornar true"
