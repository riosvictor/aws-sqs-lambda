# POC: SNS + SQS com Resiliência (LocalStack + Serverless)

## Visão Geral

Esta POC implementa arquitetura assíncrona com fan-out em SNS e dois consumidores SQS independentes:

- `queue-logging`: consumidor simples focado em observabilidade.
- `queue-resilient`: consumidor com idempotência, retry de falha transiente, desvio de falha permanente e DLQ final.

## Arquitetura

```text
HTTP POST /producer
        |
        v
producer.ts -> SNS Topic (checkout-events)
                  |                      |
                  v                      v
          SQS queue-logging        SQS queue-resilient
                  |                      |
                  v                      v
         consumer-log.ts          consumer-resilient.ts
                                         |
                          (poison pill -> send explicit)
                                         v
                               queue-resilient-final-dlq
```

## Padrões Cobertos

- Pub/Sub assíncrono com SNS.
- Consumidores desacoplados.
- Idempotência com `@aws-lambda-powertools/idempotency` e DynamoDB TTL.
- Retry de falhas transientes com `ReportBatchItemFailures`.
- Desvio de falhas permanentes para destino de erro final.
- Processamento parcial de lote para evitar retry de itens já processados.

## Pré-requisitos

- Docker
- Node.js >= 18
- npm >= 9
- Serverless Framework v3 (`npm i -g serverless@3`)

## Configuração

```bash
npm install
cp .env.example .env
docker-compose up -d
```

O provisionamento local de SNS, SQS e DynamoDB é feito automaticamente pelo script [localstack/init/ready.d/01-init-resources.sh](localstack/init/ready.d/01-init-resources.sh), montado no container pelo [docker-compose.yml](docker-compose.yml).

Validar LocalStack:

```bash
curl http://localhost:4566/_localstack/health
```

## Variáveis de Ambiente

| Variável | Exemplo |
|---|---|
| `AWS_ACCOUNT_ID` | `000000000000` |
| `QUEUE_HOST_URL` | `http://localhost:4566` |
| `SNS_TOPIC_NAME` | `checkout-events` |
| `QUEUE_LOG_NAME` | `queue-logging` |
| `QUEUE_RESILIENT_NAME` | `queue-resilient` |
| `QUEUE_RESILIENT_FINAL_DLQ_NAME` | `queue-resilient-final-dlq` |
| `IDEMPOTENCY_TABLE_NAME` | `idempotency-checkout` |

## Execução

```bash
npm start
```

O Serverless Offline expõe o endpoint HTTP em `http://localhost:3000`.

Em Node 22, o projeto usa um wrapper local para o plugin `serverless-offline` em [plugins/serverless-offline.cjs](plugins/serverless-offline.cjs), contornando a incompatibilidade ESM/CJS no carregamento do plugin pelo Serverless Framework v3.

## Testes

```bash
npm test
npm run typecheck
```

## Validação Manual

1. Publicar evento no producer usando [api.http](./api.http).
2. Acompanhar logs:
   - `consumer-log` deve apenas registrar o payload.
   - `consumer-resilient` deve distinguir duplicidade, erro transiente e erro permanente.
3. Inspecionar filas no LocalStack (`awslocal sqs list-queues`).

## Notas de Comportamento da Fila Resiliente

- Mensagens duplicadas: ignoradas por idempotência (`ConditionalCheckFailedException`).
- Falha transiente: retorna `itemIdentifier` para retry automático.
- Falha permanente (ex.: payload inválido): enviada para `queue-resilient-final-dlq`.
- No ambiente local com `serverless-offline-sqs`, `batchItemFailures` não é respeitado pelo plugin. Por isso a fila resiliente usa `batchSize: 1` e o handler lança exceção em modo offline quando há falha transiente, para permitir retry e redrive pela SQS local.