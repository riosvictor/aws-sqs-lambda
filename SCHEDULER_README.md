# Lambda com Duplo Schedule (Mensal/Semanal)

## Visão Geral

Lambda TypeScript disparada por dois schedules no EventBridge Scheduler:
- **Mensal**: Último dia do mês às 18h (São Paulo)
- **Semanal**: Toda sexta-feira às 18h (São Paulo)

**Regra de Colisão**: Se o disparo semanal cair no último dia do mês, a execução semanal é **pulada** automaticamente.

## Arquitetura

```
EventBridge Scheduler (monthly)  ─┐
  cron(0 18 L * ? *)               │
  payload: {jobType: "monthly"}    ├──> Lambda Handler
                                   │     └─> Roteamento + Skip Logic
EventBridge Scheduler (weekly)   ─┘
  cron(0 18 ? * FRI *)
  payload: {jobType: "weekly"}
```

## Estrutura de Arquivos

```
src/
├── scheduled-handler.ts        # Handler principal com roteamento
├── date-utils.ts               # Helper para verificar último dia do mês
└── jobs/
    ├── monthly-job.ts          # Stub do job mensal
    └── weekly-job.ts           # Stub do job semanal
```

## Funcionamento

### Handler Principal

1. Recebe evento do EventBridge Scheduler com payload `{jobType: "monthly" | "weekly"}`
2. Verifica a data atual no timezone `America/Sao_Paulo`
3. Determina se hoje é o último dia do mês
4. Executa a lógica:
   - `monthly` → Sempre executa `runMonthlyJob()`
   - `weekly` + último dia → **Pula** (log + return)
   - `weekly` + não último dia → Executa `runWeeklyJob()`

### Verificação de Último Dia

O helper `isLastDayOfMonth()` usa `Intl.DateTimeFormat` nativo do Node.js para:
1. Formatar a data no timezone correto
2. Verificar se amanhã está em outro mês
3. Retornar `true` se hoje é o último dia

## Schedules Configurados

| Nome | Cron | Timezone | Payload |
|------|------|----------|---------|
| monthly-job-schedule | `0 18 L * ? *` | America/Sao_Paulo | `{jobType: "monthly"}` |
| weekly-job-schedule | `0 18 ? * FRI *` | America/Sao_Paulo | `{jobType: "weekly"}` |

**Nota**: `L` = último dia do mês (varia entre 28-31)

## Logs (AWS Powertools Logger)

Todos os logs incluem:
- `serviceName`: Identifica o componente (handler, monthly-job, weekly-job)
- `jobType`: Tipo do job sendo executado
- `isLastDayOfMonth`: Flag de verificação
- `reason`: Motivo do skip (quando aplicável)

Exemplo de log de skip:
```json
{
  "level": "INFO",
  "message": "Skipping weekly job - today is the last day of the month",
  "service": "scheduled-jobs-handler",
  "jobType": "weekly",
  "reason": "collision_avoidance",
  "date": "2024-01-31T18:00:00.000Z"
}
```

## Testes

### Executar Todos os Testes
```bash
npm test
```

### Testes Implementados

**date-utils.test.ts**:
- ✅ Verifica último dia de meses com 28, 29, 30 e 31 dias
- ✅ Testa dias no meio do mês
- ✅ Valida primeiro e penúltimo dias

**scheduled-handler.test.ts**:
- ✅ Executa job mensal quando `jobType: "monthly"`
- ✅ Executa job semanal em dias normais
- ✅ **Pula job semanal no último dia do mês**
- ✅ Lança erro para `jobType` inválido

## Teste Manual

### Método 1: NPM Scripts (Recomendado)

```bash
npm run invoke:monthly   # Testa job mensal
npm run invoke:weekly    # Testa job semanal
```

### Método 2: Serverless Framework

```bash
# Com dados inline
npx serverless invoke local -f scheduled-jobs --data '{"jobType":"monthly"}'
npx serverless invoke local -f scheduled-jobs --data '{"jobType":"weekly"}'

# Com arquivo de payload
npx serverless invoke local -f scheduled-jobs --path test-payloads/monthly.json
npx serverless invoke local -f scheduled-jobs --path test-payloads/weekly.json
```

### Simular Colisão (Último Dia do Mês)

Para testar o skip, modifique temporariamente `date-utils.ts` para forçar `isLastDayOfMonth()` retornar `true`, ou ajuste a data do sistema.

## Deploy

```bash
serverless deploy
```

Recursos criados:
- 1 Lambda Function: `scheduled-jobs`
- 2 EventBridge Schedules: `monthly-job-schedule`, `weekly-job-schedule`
- IAM Roles necessárias para invocação

## Próximos Passos

1. **Implementar lógica de negócio** em `runMonthlyJob()` e `runWeeklyJob()`
2. **Adicionar métricas** (Powertools Metrics) se necessário
3. **Configurar alarmes** no CloudWatch para falhas
4. **Adicionar retry policy** se os jobs puderem falhar temporariamente

## Observabilidade

- **Logs**: CloudWatch Logs (grupo `/aws/lambda/scheduled-jobs`)
- **Métricas**: CloudWatch Metrics (Invocations, Errors, Duration)
- **Tracing**: Não configurado (Logger apenas, conforme requisito)

## Ajustes de Horário

Para alterar o horário de disparo:
1. Editar `serverless.yml`
2. Modificar o cron: `cron(0 HH L * ? *)` onde `HH` é a hora desejada (0-23)
3. Redesploy: `serverless deploy`

## Ajuste do Dia Semanal

Para mudar de sexta-feira (FRI) para outro dia:
```yaml
rate: cron(0 18 ? * MON *)  # Segunda-feira
rate: cron(0 18 ? * TUE *)  # Terça-feira
rate: cron(0 18 ? * WED *)  # Quarta-feira
rate: cron(0 18 ? * THU *)  # Quinta-feira
rate: cron(0 18 ? * SAT *)  # Sábado
rate: cron(0 18 ? * SUN *)  # Domingo
```
