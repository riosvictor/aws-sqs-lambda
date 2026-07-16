# POC: SQS + DLQ com Retry Exponencial + Lambda Scheduled Jobs (Serverless Framework + LocalStack)

## Visão Geral

Esta POC demonstra:

1. **Arquitetura de retry com backoff exponencial** usando AWS SQS e Dead Letter Queue (DLQ)
2. **Lambda com duplo schedule** (mensal e semanal) usando EventBridge Scheduler com lógica de prevenção de colisão

Ambos os cenários rodam localmente com LocalStack e Serverless Framework.

## Arquitetura e Fluxo

```
HTTP POST /producer
        │
        ▼
   producer.ts ──── SendMessage ────► SQS: input-queue
                                            │
                                    (maxReceiveCount=3)
                                            │ falha 3x
                                            ▼
                                   SQS: input-queue-dlq
                                            │
                                            ▼
                                   consumer-dlq.ts
                                    ├─ attempt <= MAX_ATTEMPTS
                                    │   └── re-enfileira em input-queue
                                    │       com DelaySeconds (backoff exp.)
                                    │       e incrementa atributo `attempts`
                                    └─ attempt > MAX_ATTEMPTS
                                        └── lança MaxAttemptsError
                                            (mensagem vai para DLQ final)
```

**Comportamento do consumer.ts (simulação de falha):** O consumer possui um contador em memória que simula falhas nas primeiras 3 invocações (comportamento de Lambda warm container). Na 4ª chamada, a mensagem é processada com sucesso.

## Pré-requisitos

- Docker (para o LocalStack)
- Node.js >= 18
- npm >= 9
- Serverless Framework v3: `npm install -g serverless@3`
- `awslocal` CLI (opcional, para inspecionar filas): `pip install awscli-local`

## Variáveis de Ambiente

Copie `.env.example` para `.env` e ajuste conforme necessário:

```bash
cp .env.example .env
```

| Variável               | Valor padrão                     | Descrição                                          |
|------------------------|----------------------------------|----------------------------------------------------|
| `AWS_ACCOUNT_ID`       | `000000000000`                   | ID de conta fictício do LocalStack                 |
| `AWS_ACCESS_KEY_ID`    | `test`                           | Credencial fictícia do LocalStack                  |
| `AWS_SECRET_ACCESS_KEY`| `test`                           | Credencial fictícia do LocalStack                  |
| `AWS_SESSION_TOKEN`    | `test`                           | Token fictício do LocalStack                       |
| `QUEUE_HOST_URL`       | `http://localhost:4566`          | Endpoint do LocalStack SQS                         |
| `QUEUE_NAME`           | `input-queue`                    | Nome da fila principal                             |
| `QUEUE_NAME_DLQ`       | `input-queue-dlq`                | Nome da fila de dead letter                        |
| `MAX_ATTEMPTS`         | `3`                              | Número máximo de reprocessamentos via DLQ          |
| `DELAY_BASE`           | `100`                            | Base em ms para cálculo do backoff exponencial     |

## Amarrações de Nomes de Filas

O nome das filas é referenciado nos seguintes locais — ao alterar `QUEUE_NAME` ou `QUEUE_NAME_DLQ` no `.env`, todos os pontos abaixo são afetados automaticamente:

| Variável        | Referências                                                                                                     |
|-----------------|-----------------------------------------------------------------------------------------------------------------|
| `QUEUE_NAME`    | `serverless.yml` → `functions.consumer.events[0].sqs.arn`<br>`serverless.yml` → `custom.queueUrl`<br>`serverless.yml` → `provider.environment.QUEUE_URL` (via `custom.queueUrl`)<br>`consumer-dlq.ts` → `process.env.QUEUE_URL` (re-enfileira nesta fila) |
| `QUEUE_NAME_DLQ`| `serverless.yml` → `functions.consumer-dlq.events[0].sqs.arn`                                                  |

## Passo a Passo de Execução

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
# O arquivo .env.example já contém valores prontos para uso local
```

### 3. Subir o LocalStack

```bash
docker-compose up -d
```

Verifique o health: `curl http://localhost:4566/health`

### 4. Configurar as filas no LocalStack

As filas `input-queue` e `input-queue-dlq` são criadas automaticamente pelo plugin `serverless-offline-sqs` na inicialização. Configure as redrive policies manualmente:

```bash
# Criar a DLQ final (para mensagens que excederam MAX_ATTEMPTS)
awslocal sqs create-queue --queue-name input-queue-dlq-dlq

# Configurar redrive: input-queue → input-queue-dlq após 3 falhas
awslocal sqs set-queue-attributes \
  --queue-url http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/input-queue \
  --attributes '{
    "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:000000000000:input-queue-dlq\",\"maxReceiveCount\":\"3\"}"
  }'

# Configurar redrive: input-queue-dlq → input-queue-dlq-dlq (DLQ final)
awslocal sqs set-queue-attributes \
  --queue-url http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/input-queue-dlq \
  --attributes '{
    "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:000000000000:input-queue-dlq-dlq\"}"
  }'
```

### 5. Iniciar a aplicação

```bash
npm start
```

O Serverless Offline sobe na porta `3000`.

### 6. Inspecionar filas (opcional)

```bash
# Listar filas disponíveis
awslocal sqs list-queues

# Ver atributos de uma fila
awslocal sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/input-queue \
  --attribute-names All
```

## Testes

### Testes unitários (sem infraestrutura)

```bash
npm test
```

Os testes cobrem:
- `backoff.class.ts` — cálculo do delay exponencial e respeito ao limite
- `utils.ts` — conversão de ARN, delay exponencial, URL offline
- `max-attempts.exception.ts` — estrutura e mensagem do erro customizado
- `consumer.ts` — comportamento sequencial de falha e sucesso
- `consumer-dlq.ts` — re-enfileiramento, incremento de tentativas, MaxAttemptsError
- `producer.ts` — envio para SQS, tratamento de erros, serialização do body

### Verificação de tipos TypeScript

```bash
npm run typecheck
```

## Testando Manualmente (api.http)

Com a aplicação rodando (`npm start`) e o LocalStack ativo:

```http
### Verificar saúde do LocalStack
GET http://localhost:4566/health

### Publicar mensagem na fila (inicia o fluxo completo)
POST http://localhost:3000/producer
Content-Type: application/json

{
  "email": "paulo.rios@example.com",
  "order": 1
}
```

Use o arquivo [api.http](./api.http) com a extensão **REST Client** do VS Code.

**Observação:** O `consumer.ts` usa um contador em memória (warm container simulation). Para observar o fluxo completo de retry, envie uma mensagem e acompanhe os logs do terminal onde o `npm start` está rodando. Você verá:

1. Consumer falha (3x) → mensagem vai para `input-queue-dlq`
2. Consumer DLQ re-enfileira com backoff exponencial em `input-queue`
3. Consumer processa com sucesso na 4ª tentativa

## Visualizando as Filas

- [LocalStack Desktop](https://docs.localstack.cloud/user-guide/tools/localstack-desktop/)
- [LocalStack Web Application](https://docs.localstack.cloud/user-guide/web-application/)

---

## 📅 Lambda com Duplo Schedule (Mensal/Semanal)

### Visão Geral

Lambda TypeScript disparada por **dois schedules** no EventBridge Scheduler:
- **Mensal**: Último dia do mês às 18h (timezone São Paulo)
- **Semanal**: Toda sexta-feira às 18h (timezone São Paulo)

**Regra de Colisão**: Se o disparo semanal cair no último dia do mês, a execução semanal é **automaticamente pulada** para evitar duplicação.

### Arquitetura

```
EventBridge Scheduler (monthly)
  cron: 0 18 L * ? *
  payload: {jobType: "monthly"}
              │
              ├──► Lambda Handler (scheduled-handler.ts)
              │       ├─ Verifica timezone São Paulo
              │       ├─ Checa se é último dia do mês
              │       └─ Roteia para job correto
              │
EventBridge Scheduler (weekly)
  cron: 0 18 ? * FRI *
  payload: {jobType: "weekly"}
```

### Estrutura de Arquivos

```
src/
├── scheduled-handler.ts        # Handler principal com roteamento
├── date-utils.ts               # Helper para verificar último dia do mês
├── jobs/
│   ├── monthly-job.ts          # Job mensal (stub)
│   └── weekly-job.ts           # Job semanal (stub)
└── __tests__/
    ├── scheduled-handler.test.ts
    └── date-utils.test.ts
```

### Testando Localmente

#### Método 1: NPM Scripts (Recomendado) ⚡

```bash
npm run invoke:monthly   # Testa job mensal
npm run invoke:weekly    # Testa job semanal
```

#### Método 2: Serverless Framework

```bash
# Com dados inline
npx serverless invoke local -f scheduled-jobs --data '{"jobType":"monthly"}'
npx serverless invoke local -f scheduled-jobs --data '{"jobType":"weekly"}'

# Com arquivo de payload
npx serverless invoke local -f scheduled-jobs --path test-payloads/monthly.json
npx serverless invoke local -f scheduled-jobs --path test-payloads/weekly.json
```

#### Método 3: Script de Teste Completo

```bash
npx ts-node src/test-manual.ts
```

### Logs (AWS Powertools Logger)

Exemplo de log quando o job semanal é pulado:

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

### Documentação Completa

Consulte [SCHEDULER_README.md](./SCHEDULER_README.md) para:
- Detalhes da arquitetura
- Configuração dos schedules
- Ajuste de horários e dias
- Validação e troubleshooting
- Próximos passos para implementação da lógica de negócio

---