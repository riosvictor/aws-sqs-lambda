# POC: SQS Básico com Producer/Consumer (Serverless Framework + LocalStack)

## Visão Geral

Esta POC demonstra o padrão básico de Producer/Consumer usando AWS SQS, rodando localmente com LocalStack e Serverless Framework. Um endpoint HTTP recebe mensagens e as publica em uma fila SQS; uma Lambda consome essa fila e processa cada mensagem.

## Arquitetura e Fluxo

```
HTTP POST /producer
        │
        ▼
   producer.ts ──── SendMessage ────► SQS: minha-fila
                                            │
                                            ▼
                                      consumer.ts
                                       └── loga messageBody
```

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

| Variável               | Valor padrão                    | Descrição                              |
|------------------------|---------------------------------|----------------------------------------|
| `AWS_ACCOUNT_ID`       | `000000000000`                  | ID de conta fictício do LocalStack     |
| `AWS_ACCESS_KEY_ID`    | `test`                          | Credencial fictícia do LocalStack      |
| `AWS_SECRET_ACCESS_KEY`| `test`                          | Credencial fictícia do LocalStack      |
| `AWS_SESSION_TOKEN`    | `test`                          | Token fictício do LocalStack           |
| `QUEUE_HOST_URL`       | `http://localhost:4566`         | Endpoint do LocalStack SQS             |
| `QUEUE_NAME`           | `minha-fila`                    | Nome da fila SQS                       |

## Amarrações de Nomes de Fila

O valor de `QUEUE_NAME` é referenciado nos seguintes locais — alterar aqui requer atualização em todos:

| Variável     | Referências                                                                                     |
|--------------|-------------------------------------------------------------------------------------------------|
| `QUEUE_NAME` | `functions.yml` → `consumer.events[0].sqs.arn`<br>`serverless.yml` → `custom.queueUrl` (via `QUEUE_HOST_URL/AWS_ACCOUNT_ID/QUEUE_NAME`)<br>`serverless.yml` → `custom.serverless-offline-sqs.autoCreate` (cria a fila automaticamente) |

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

Verifique: `curl http://localhost:4566/_localstack/health`

### 4. Iniciar a aplicação

```bash
npm start
```

O plugin `serverless-offline-sqs` cria a fila automaticamente (`autoCreate: true`). O Serverless Offline sobe na porta `3000`.

### 5. Inspecionar a fila (opcional)

```bash
# Listar filas
awslocal sqs list-queues

# Ver mensagens na fila
awslocal sqs receive-message \
  --queue-url http://localhost:4566/000000000000/minha-fila
```

## Testes

### Testes unitários (sem infraestrutura)

```bash
npm test
```

Os testes cobrem:
- `producer.ts` — envio para SQS, tratamento de erros, serialização do body
- `consumer.ts` — processamento de 1 e múltiplos records, body complexo
- `utils.ts` — conversão de ARN para URL, substituição por endpoint offline

### Verificação de tipos TypeScript

```bash
npm run typecheck
```

## Testando Manualmente (api.http)

Com a aplicação rodando (`npm start`) e o LocalStack ativo, use o arquivo [api.http](./api.http) com a extensão **REST Client** do VS Code:

```http
### Verificar saúde do LocalStack
GET http://localhost:4566/_localstack/health

### Publicar mensagem (inicia o fluxo)
POST http://localhost:3000/producer
Content-Type: application/json

{
  "email": "paulo.rios@example.com"
}
```

Nos logs do terminal você verá o consumer processar a mensagem:
```
[CONSUMER]: { email: 'paulo.rios@example.com' }
```

## Visualizando as Filas

- [LocalStack Desktop](https://docs.localstack.cloud/user-guide/tools/localstack-desktop/)
- [LocalStack Web Application](https://docs.localstack.cloud/user-guide/web-application/)
