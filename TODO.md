# TODO — Oportunidades de Melhoria com AWS Lambda Powertools

Este arquivo lista melhorias recomendadas para elevar esta POC a um padrão de produção,
utilizando a biblioteca [@aws-lambda-powertools for TypeScript](https://docs.powertools.aws.dev/lambda/typescript/latest/).

---

## 1. Observabilidade — Logger

**Situação atual:** `console.log`, `console.error`, `console.debug` sem estruturação.

**Melhoria:** Substituir por `@aws-lambda-powertools/logger` para logs estruturados em JSON,
com correlation IDs automáticos, níveis de log configuráveis via env e integração nativa com
CloudWatch Logs Insights.

```typescript
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'sqs-dlq-consumer' });

// Substitui: console.log('Messages received...', new Date())
logger.info('Mensagem recebida', { attempt, queueName });

// Substitui: console.debug(...)
logger.debug('Processando tentativa', { attempt, maxAttempts });
```

**Impacto:** Rastreabilidade de mensagens por `requestId`, melhor filtragem no CloudWatch.

---

## 2. Observabilidade — Tracer (X-Ray)

**Situação atual:** Sem rastreamento distribuído.

**Melhoria:** Adicionar `@aws-lambda-powertools/tracer` para instrumentação automática
das chamadas ao SQS com AWS X-Ray.

```typescript
import { Tracer } from '@aws-lambda-powertools/tracer';

const tracer = new Tracer({ serviceName: 'sqs-dlq-consumer' });

// Instrumenta automaticamente o SQSClient
const client = tracer.captureAWSv3Client(new SQSClient({ ... }));
```

**Impacto:** Mapa de serviços no X-Ray, latência de cada chamada ao SQS, rastreamento end-to-end.

---

## 3. Observabilidade — Metrics

**Situação atual:** Sem métricas customizadas de negócio.

**Melhoria:** Usar `@aws-lambda-powertools/metrics` para publicar métricas no CloudWatch EMF.

```typescript
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

const metrics = new Metrics({ namespace: 'SQSPoc', serviceName: 'dlq-consumer' });

// No consumer-dlq.ts
metrics.addMetric('MessagesRequeued', MetricUnit.Count, 1);
metrics.addMetric('MaxAttemptsReached', MetricUnit.Count, 1);
metrics.publishStoredMetrics();
```

**Sugestões de métricas:**
- `MessagesRequeued` — mensagens re-enfileiradas com sucesso
- `MaxAttemptsReached` — mensagens que esgotaram as tentativas
- `ProcessingSuccess` — mensagens processadas pelo consumer principal
- `RetryDelay` — valor do delay aplicado por tentativa

---

## 4. Processamento em Lote — Batch Processing

**Situação atual:** `batchSize: 1` no serverless.yml e processamento sem reporte granular de falhas.

**Melhoria:** Usar `@aws-lambda-powertools/batch` com `BatchProcessor` para processar múltiplos
records por invocação com reporte individual de falhas (`ReportBatchItemFailures`).

```typescript
import { BatchProcessor, EventType, processPartialResponse } from '@aws-lambda-powertools/batch';
import type { SQSRecord } from 'aws-lambda';

const processor = new BatchProcessor(EventType.SQS);

async function recordHandler(record: SQSRecord): Promise<void> {
  const body = JSON.parse(record.body);
  // lógica de processamento
}

export const handler = async (event: SQSEvent, context: Context) => {
  return processPartialResponse(event, recordHandler, processor, { context });
};
```

**Impacto:** Aumentar `batchSize` para 10+ com `functionResponseType: ReportBatchItemFailures`
sem risco de re-processar records que já tiveram sucesso.

---

## 5. Idempotência — Idempotency

**Situação atual:** O consumer processa a mesma mensagem múltiplas vezes se houver retry do SQS.

**Melhoria:** Usar `@aws-lambda-powertools/idempotency` com DynamoDB para garantir que cada
`messageId` seja processado exatamente uma vez.

```typescript
import { makeIdempotent } from '@aws-lambda-powertools/idempotency';
import { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';

const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: 'IdempotencyTable',
});

export const handler = makeIdempotent(
  async (event: SQSEvent, context: Context) => {
    // lógica de processamento
  },
  { persistenceStore, config: new IdempotencyConfig({ eventKeyJmesPath: 'Records[0].messageId' }) }
);
```

**Impacto:** Elimina duplicatas causadas por re-entregas do SQS, especialmente no fluxo de
re-enfileiramento do consumer-dlq.

---

## 6. Configuração Segura — Parameters

**Situação atual:** `MAX_ATTEMPTS` e `DELAY_BASE` lidos via `process.env` sem validação ou
gerenciamento centralizado.

**Melhoria:** Usar `@aws-lambda-powertools/parameters` para buscar parâmetros do SSM Parameter
Store ou Secrets Manager com cache automático.

```typescript
import { SSMProvider } from '@aws-lambda-powertools/parameters/ssm';

const provider = new SSMProvider();

// Com cache de 5 minutos por padrão
const maxAttempts = await provider.get('/sqs-poc/max-attempts', { transform: 'json' });
```

**Impacto:** Alteração de configurações sem re-deploy da Lambda, rotação de credenciais segura.

---

## 7. Melhorias de Código

- **`utils.ts`:** O import de `Backoff` está presente mas não é utilizado. Remover ou usar `Backoff`
  diretamente em `getDelaySeconds` para evitar código duplicado (a classe Backoff e a função
  `getDelaySeconds` calculam o mesmo exponential backoff com APIs diferentes).
- **`consumer.ts`:** O contador `let counter = 0` é um estado global que simula Lambda warm container.
  Em produção, este padrão não deve ser usado para lógica de negócio. Usar idempotency ou um
  external state store.
- **`consumer-dlq.ts`:** `SQSClient` e `queueUrl` são inicializados no escopo de módulo; extrair para
  factory functions facilita testes e possibilita uso de DI (Dependency Injection).
- **Aumentar `batchSize`:** Atualmente `batchSize: 1`. Com o Batch Processor, aumentar para 10
  melhora throughput e reduz custo de invocações Lambda.
