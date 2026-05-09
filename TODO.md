# TODO — Oportunidades de Melhoria com AWS Lambda Powertools

Este arquivo lista melhorias recomendadas para elevar esta POC a um padrão de produção,
utilizando a biblioteca [@aws-lambda-powertools for TypeScript](https://docs.powertools.aws.dev/lambda/typescript/latest/).

---

## 1. Observabilidade — Logger

**Situação atual:** `console.log` sem estruturação ou correlação de IDs.

**Melhoria:** Substituir por `@aws-lambda-powertools/logger` para logs JSON estruturados com
`requestId`, `messageid` e contexto de negócio automaticamente incluídos.

```typescript
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'sqs-consumer' });

// Substitui: console.log('[CONSUMER]:', messageBody)
logger.info('Mensagem processada', { messageBody, messageId: record.messageId });
```

**Impacto:** Facilita filtragem e correlação de logs no CloudWatch Logs Insights.

---

## 2. Observabilidade — Tracer (X-Ray)

**Situação atual:** Sem rastreamento distribuído.

**Melhoria:** Adicionar `@aws-lambda-powertools/tracer` para rastrear cada chamada ao SQS e
criar segmentos de trace no AWS X-Ray.

```typescript
import { Tracer } from '@aws-lambda-powertools/tracer';

const tracer = new Tracer({ serviceName: 'sqs-producer' });
const client = tracer.captureAWSv3Client(new SQSClient({ ... }));
```

**Impacto:** Visibilidade end-to-end da latência de produção e consumo de mensagens.

---

## 3. Processamento em Lote — Batch Processing

**Situação atual:** Processamento ingênuo com `for...of` sem reporte granular de falhas.
Uma exceção em qualquer record faz todos serem re-entregues pelo SQS.

**Melhoria:** Usar `@aws-lambda-powertools/batch` com `functionResponseType: ReportBatchItemFailures`
para processar múltiplos records e reportar apenas as falhas individuais.

```typescript
import { BatchProcessor, EventType, processPartialResponse } from '@aws-lambda-powertools/batch';
import type { SQSRecord } from 'aws-lambda';

const processor = new BatchProcessor(EventType.SQS);

async function recordHandler(record: SQSRecord): Promise<void> {
  const body = JSON.parse(record.body);
  // lógica de processamento
}

export const handler = async (event: SQSEvent, context: Context) =>
  processPartialResponse(event, recordHandler, processor, { context });
```

**Impacto:** Aumentar `batchSize` de 1 para 10+ sem risco de re-processar records com sucesso.

---

## 4. Validação de Esquema — Event Validation

**Situação atual:** O body da mensagem é aceito sem nenhuma validação de estrutura. Um payload
malformado causa erro em runtime sem mensagem descritiva.

**Melhoria:** Usar `@aws-lambda-powertools/parser` ou Zod para validar o esquema do payload
no consumer antes de processar.

```typescript
import { z } from 'zod';

const PayloadSchema = z.object({
  email: z.string().email(),
});

// No consumer
const payload = PayloadSchema.parse(JSON.parse(record.body));
```

**Impacto:** Erros de schema claros e rastreáveis, evita processamento de dados inválidos.

---

## 5. Métricas — Metrics

**Situação atual:** Sem métricas de negócio publicadas no CloudWatch.

**Melhoria:** Usar `@aws-lambda-powertools/metrics` para registrar métricas por invocação.

```typescript
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

const metrics = new Metrics({ namespace: 'SQSPoc', serviceName: 'consumer' });

metrics.addMetric('MessagesProcessed', MetricUnit.Count, event.Records.length);
metrics.publishStoredMetrics();
```

**Sugestões de métricas:**
- `MessagesProcessed` — quantidade de records processados com sucesso
- `ProcessingErrors` — falhas de processamento individuais

---

## 6. Melhorias de Código

- **`utils.ts`:** A função `getOfflineSqsQueueUrl` depende de `process.env.SQS_OFFLINE_ENDPOINT`
  mas não está documentada e não tem fallback. Considerar remover ou tornar o endpoint parâmetro
  explícito.
- **`producer.ts`:** O `SQSClient` é instanciado dentro do handler a cada invocação. Mover para
  o escopo de módulo aproveita o container warm do Lambda e reduz latência de cold start.
- **Aumentar `batchSize`:** Atualmente `batchSize: 1` em `functions.yml`. Com Batch Processing,
  aumentar para 10 melhora throughput e reduz custo de invocações.
