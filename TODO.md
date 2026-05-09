# TODO — Oportunidades de Melhoria com AWS Lambda Powertools

Este arquivo lista melhorias recomendadas para elevar esta POC a um padrão de produção,
utilizando a biblioteca [@aws-lambda-powertools for TypeScript](https://docs.powertools.aws.dev/lambda/typescript/latest/).

---

## 1. Observabilidade — Logger

**Situação atual:** `console.log` sem estruturação, correlação ou contexto de negócio.

**Melhoria:** Substituir por `@aws-lambda-powertools/logger` para logs JSON com `requestId`,
`topicArn`, `messageId` e contexto da mensagem SNS automaticamente incluídos.

```typescript
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'sns-consumer' });

// Substitui: console.log('[CONSUMER]:', messageBody.Message)
logger.info('Mensagem SNS processada', {
  message: messageBody.Message,
  messageId: record.messageId,
  topicArn: messageBody.TopicArn,
});
```

---

## 2. Observabilidade — Tracer (X-Ray)

**Situação atual:** Sem rastreamento distribuído entre producer SNS e consumers SQS.

**Melhoria:** Usar `@aws-lambda-powertools/tracer` para criar segmentos de trace por Lambda,
correlacionando a publicação SNS com o processamento em cada consumer.

```typescript
import { Tracer } from '@aws-lambda-powertools/tracer';

const tracer = new Tracer({ serviceName: 'sns-producer' });
const client = tracer.captureAWSv3Client(new SNSClient({ ... }));
```

**Impacto:** Mapa de serviços end-to-end no X-Ray mostrando a cadeia SNS → SQS → Lambda.

---

## 3. Validação de Esquema — Parser (Envelope SNS)

**Situação atual:** `JSON.parse(record.body).Message` sem validação do envelope SNS nem do
payload interno. Um erro de serialização causa falha genérica em runtime.

**Melhoria:** Usar `@aws-lambda-powertools/parser` com o envelope SNS pré-definido para
fazer parse e validar automaticamente a estrutura.

```typescript
import { SqsEnvelope } from '@aws-lambda-powertools/parser/envelopes/sqs';
import { SnsNotificationSchema } from '@aws-lambda-powertools/parser/schemas/sns';
import { z } from 'zod';

const PayloadSchema = z.object({
  email: z.string().email(),
});

export const handler = async (event: SQSEvent) => {
  const messages = SqsEnvelope.parse(event, SnsNotificationSchema);
  for (const msg of messages) {
    const payload = PayloadSchema.parse(JSON.parse(msg.Message));
    // lógica de processamento
  }
};
```

**Impacto:** Erros de schema claros e rastreáveis antes de qualquer processamento de negócio.

---

## 4. Processamento em Lote — Batch Processing

**Situação atual:** `for...of` ingênuo sem reporte granular. Uma falha em qualquer record
re-entrega toda a batch ao consumer.

**Melhoria:** Usar `@aws-lambda-powertools/batch` com `functionResponseType: ReportBatchItemFailures`
para processar múltiplos records e reportar apenas os que falharam.

```typescript
import { BatchProcessor, EventType, processPartialResponse } from '@aws-lambda-powertools/batch';

const processor = new BatchProcessor(EventType.SQS);

async function recordHandler(record: SQSRecord): Promise<void> {
  const body = JSON.parse(record.body);
  // lógica de processamento da mensagem SNS
}

export const handler = async (event: SQSEvent, context: Context) =>
  processPartialResponse(event, recordHandler, processor, { context });
```

**Impacto:** Aumentar `batchSize` para 10+ em `functions.yml`, melhorando throughput e custo.

---

## 5. Métricas — Metrics

**Situação atual:** Sem métricas de negócio publicadas no CloudWatch.

**Melhoria:** Usar `@aws-lambda-powertools/metrics` para medir o fan-out por consumer.

```typescript
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

const metrics = new Metrics({ namespace: 'SNSPoc', serviceName: 'consumer' });
metrics.addMetric('SNSMessagesProcessed', MetricUnit.Count, event.Records.length);
metrics.publishStoredMetrics();
```

**Sugestões de métricas por consumer:**
- `SNSMessagesProcessed` — mensagens do tópico processadas com sucesso
- `ConsumerFanoutLatency` — latência desde a publicação SNS até o processamento

---

## 6. Melhorias de Código

- **`consumer.ts` e `consumer2.ts`:** Os dois handlers são praticamente idênticos (apenas o label do
  `console.log` difere). Extrair a lógica de processamento para uma função compartilhada em `utils.ts`
  elimina duplicação e facilita manutenção.
- **`utils.ts`:** As funções `generateSQSQueueUrlFromArn` e `getOfflineSqsQueueUrl` não são usadas
  neste branch pelo código de produção. Remover ou mover para módulo de infraestrutura.
- **`producer.ts`:** `SNSClient` instanciado dentro do handler. Mover para escopo de módulo
  aproveita o container warm e reduz latência de cold start.
- **Aumentar `batchSize`:** Atualmente `batchSize` implícito como 1. Com Batch Processing,
  aumentar para 10 em `functions.yml` para ambos os consumers.
