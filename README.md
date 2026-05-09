# POC: DynamoDB com Serverless Framework + LocalStack

## Visão Geral

Esta POC demonstra operações básicas em tabelas DynamoDB (listar e inserir itens) usando AWS SDK v3 e Serverless Framework, rodando localmente com LocalStack.

## Arquitetura e Fluxo

```
GET  /tables?tableName=X  ──► tables.get()      ──► DynamoDB ListTablesCommand ──► retorna lista de tabelas
POST /tables?tableName=X  ──► tables.postItem() ──► DynamoDB PutItemCommand    ──► insere item na tabela
```

**Conversão de tipos:** O `postItem` converte cada campo do body JSON para o formato `AttributeValue` do DynamoDB: `{ chave: "valor" }` → `{ chave: { S: "valor" } }`.

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

| Variável               | Valor padrão            | Descrição                                  |
|------------------------|-------------------------|--------------------------------------------|
| `AWS_ACCOUNT_ID`       | `000000000000`          | ID de conta fictício do LocalStack         |
| `AWS_ACCESS_KEY_ID`    | `test`                  | Credencial fictícia do LocalStack          |
| `AWS_SECRET_ACCESS_KEY`| `test`                  | Credencial fictícia do LocalStack          |
| `AWS_SESSION_TOKEN`    | `test`                  | Token fictício do LocalStack               |
| `DB_HOST_URL`          | `http://localhost:4566` | Endpoint do LocalStack DynamoDB            |

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

### 4. Criar tabela DynamoDB no LocalStack

```bash
awslocal dynamodb create-table \
  --table-name sdksTable \
  --attribute-definitions AttributeName=key,AttributeType=S \
  --key-schema AttributeName=key,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

Verifique a criação:

```bash
awslocal dynamodb list-tables
```

### 5. Iniciar a aplicação

```bash
npm start
```

O Serverless Offline sobe na porta `3000`.

## Testes

### Testes unitários (sem infraestrutura)

```bash
npm test
```

Os testes cobrem:
- `tables.get` — status 200, passagem de `ExclusiveStartTableName`, propagação de erros
- `tables.postItem` — conversão de campos para `{S: value}`, uso do `TableName` correto, propagação de erros
- `utils.ts` — funções documentadas como código morto neste branch

### Verificação de tipos TypeScript

```bash
npm run typecheck
```

## Testando Manualmente (api.http)

Com a aplicação rodando (`npm start`) e o LocalStack ativo, use o arquivo [api.http](./api.http):

```http
### Verificar saúde do LocalStack
GET http://localhost:4566/health

### Listar tabelas (a partir de 'sdk')
GET http://localhost:3000/tables?tableName=sdk
Content-Type: application/json

### Inserir item na tabela sdksTable
POST http://localhost:3000/tables?tableName=sdksTable
Content-Type: application/json

{
    "key": "test2",
    "payload": "{}"
}
```

**Resposta esperada do GET:**
```json
["sdksTable"]
```

**Resposta esperada do POST:**
```json
{"message": "Item added successfully"}
```

## Inspecionar dados no LocalStack

```bash
# Listar tabelas
awslocal dynamodb list-tables

# Ver todos os itens de uma tabela
awslocal dynamodb scan --table-name sdksTable

# Buscar item específico
awslocal dynamodb get-item \
  --table-name sdksTable \
  --key '{"key": {"S": "test2"}}'
```

## Observação sobre utils.ts

O arquivo `src/utils.ts` contém funções SQS que são **código morto** neste branch — nenhuma é usada por `tables.ts`. Ver [TODO.md](./TODO.md).
