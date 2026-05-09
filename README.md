# POC: SNS Fan-out para SQS com 2 Consumers (Serverless Framework + LocalStack)

## Visão Geral

Esta POC demonstra o padrão de **fan-out** usando SNS → SQS. Uma mensagem publicada em um tópico SNS é entregue simultaneamente a duas filas SQS independentes, cada uma consumida por uma Lambda diferente. Roda localmente com LocalStack e Serverless Framework.

## Arquitetura e Fluxo

```
HTTP POST /producer
        │
        ▼
   producer.ts ──── PublishCommand ────► SNS: minha-fila (tópico)
                                                │
                               ┌────────────────┴────────────────┐
                               ▼                                 ▼
                     SQS: minha-fila                   SQS: minha-fila-2
                               │                                 │
                               ▼                                 ▼
                         consumer.ts                       consumer2.ts
                      loga body.Message              loga body.Message
```

**Envelope SNS:** O SNS entrega mensagens ao SQS com um envelope JSON. O consumer lê `JSON.parse(record.body).Message` para obter a mensagem original.

## Pré-requisitos

- Docker (para o LocalStack)
- Node.js >= 18
- npm >= 9
- Serverless Framework v3: `npm install -g serverless@3`

## Variáveis de Ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

| Variável               | Valor padrão            | Descrição                                        |
|------------------------|-------------------------|--------------------------------------------------|
| `AWS_ACCOUNT_ID`       | `000000000000`          | ID de conta fictício do LocalStack               |
| `AWS_ACCESS_KEY_ID`    | `test`                  | Credencial fictícia do LocalStack                |
| `AWS_SECRET_ACCESS_KEY`| `test`                  | Credencial fictícia do LocalStack                |
| `AWS_SESSION_TOKEN`    | `test`                  | Token fictício do LocalStack                     |
| `QUEUE_HOST_URL`       | `http://localhost:4566` | Endpoint do LocalStack SQS                       |
| `QUEUE_NAME`           | `minha-fila`            | Nome da fila SQS 1 (subscriber do tópico)        |
| `QUEUE_2_NAME`         | `minha-fila-2`          | Nome da fila SQS 2 (subscriber do tópico)        |
| `SNS_ENDPOINT`         | `http://localhost:4566` | Endpoint do LocalStack SNS                       |
| `LOCAL_HOST_IP`        | `0.0.0.0`               | IP para o plugin serverless-offline-sns escutar  |
| `TOPIC_NAME`           | `minha-fila`            | Nome do tópico SNS                               |

## Amarrações de Nomes

Ao alterar as variáveis abaixo, todos os pontos referenciados são afetados automaticamente:

| Variável       | Referências                                                                                                  |
|----------------|--------------------------------------------------------------------------------------------------------------|
| `TOPIC_NAME`   | `serverless.yml` → `custom.topicArn` → `provider.environment.TOPIC_ARN` → `producer.ts` (PublishCommand)   |
| `QUEUE_NAME`   | `functions.yml` → `consumer.events[0].sqs.arn`<br>`serverless.yml` → `custom.queueUrl` e `serverless-offline-sqs` |
| `QUEUE_2_NAME` | `functions.yml` → `consumer2.events[0].sqs.arn`                                                             |

## Passo a Passo de Execução

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

### 3. Subir o LocalStack

```bash
docker-compose up -d
```

Verifique: `curl http://localhost:4566/health`

### 4. Criar o tópico SNS e configurar subscriptions

As filas SQS são criadas automaticamente pelo plugin `serverless-offline-sqs`. O tópico e as subscriptions precisam ser criados manualmente:

```bash
# Criar o tópico SNS
awslocal sns create-topic --name minha-fila

# Subscrever minha-fila (SQS) no tópico
awslocal sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:000000000000:minha-fila \
  --protocol sqs \
  --notification-endpoint "arn:aws:sqs:us-east-1:000000000000:minha-fila"

# Subscrever minha-fila-2 (SQS) no tópico
awslocal sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:000000000000:minha-fila \
  --protocol sqs \
  --notification-endpoint "arn:aws:sqs:us-east-1:000000000000:minha-fila-2"
```

### 5. Iniciar a aplicação

```bash
npm start
```

O Serverless Offline sobe na porta `3000`.

### 6. Inspecionar tópico e filas (opcional)

```bash
# Listar tópicos SNS
awslocal sns list-topics

# Ver subscriptions do tópico
awslocal sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:us-east-1:000000000000:minha-fila

# Listar filas SQS
awslocal sqs list-queues
```

## Testes

### Testes unitários (sem infraestrutura)

```bash
npm test
```

Os testes cobrem:
- `producer.ts` — publicação no SNS, TopicArn correto, serialização do body, tratamento de erros
- `consumer.ts` — processamento do envelope SNS (campo `Message`), múltiplos payloads
- `consumer2.ts` — mesmo padrão, fila separada
- `utils.ts` — conversão de ARN para URL, substituição de endpoint offline

### Verificação de tipos TypeScript

```bash
npm run typecheck
```

## Testando Manualmente (api.http)

Com a aplicação rodando (`npm start`) e o LocalStack ativo, use o arquivo [api.http](./api.http):

```http
### Verificar saúde do LocalStack
GET http://localhost:4566/health

### Publicar mensagem no tópico SNS (fan-out para as 2 filas)
POST http://localhost:3000/producer
Content-Type: application/json

{
  "email": "paulo.rios@example.com"
}
```

Nos logs você verá ambos os consumers receberem a mensagem:
```
[CONSUMER]: {"email":"paulo.rios@example.com"}
[CONSUMER 2]: {"email":"paulo.rios@example.com"}
```

## Visualizando Tópicos e Filas

- [LocalStack Desktop](https://docs.localstack.cloud/user-guide/tools/localstack-desktop/)
- [LocalStack Web Application](https://docs.localstack.cloud/user-guide/web-application/)
