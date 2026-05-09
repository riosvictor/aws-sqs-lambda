# POC: S3 Trigger com Serverless Framework + serverless-s3-local

## Visão Geral

Esta POC demonstra o processamento de objetos S3 via trigger Lambda. Ao fazer upload de um arquivo JSON no bucket, a Lambda é acionada automaticamente, lê o conteúdo via `GetObjectCommand` e o exibe nos logs. Roda localmente com `serverless-s3-local` (porta 4569).

## Arquitetura e Fluxo

```
Upload de arquivo JSON
        │
        ▼ s3:ObjectCreated:Put
   S3: local-bucket (porta 4569)
        │
        ▼ evento S3Event
   handler.execute()
        │
        ├─► S3Client.GetObjectCommand (lê Body como Stream)
        │
        ├─► streamToString(Body) → string UTF-8
        │
        └─► JSON.parse(content) → loga conteúdo estruturado
```

**Credenciais locais:** O `serverless-s3-local` usa credenciais `S3RVER` (valor fixo, não real). Definidas em `.env`.

## Pré-requisitos

- Node.js >= 18
- npm >= 9
- Serverless Framework v3: `npm install -g serverless@3`

> **Nota:** Esta POC usa `serverless-s3-local` (porta 4569), **não** o LocalStack. Não é necessário Docker.

## Variáveis de Ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

| Variável               | Valor padrão              | Descrição                                            |
|------------------------|---------------------------|------------------------------------------------------|
| `AWS_ACCOUNT_ID`       | `000000000000`            | ID fictício                                          |
| `AWS_ACCESS_KEY_ID`    | `S3RVER`                  | Credencial exigida pelo serverless-s3-local          |
| `AWS_SECRET_ACCESS_KEY`| `S3RVER`                  | Credencial exigida pelo serverless-s3-local          |
| `AWS_SESSION_TOKEN`    | `S3RVER`                  | Token exigido pelo serverless-s3-local               |
| `AWS_S3_HOST`          | `http://localhost:4569`   | Endpoint do serverless-s3-local                      |
| `BUCKET_NAME`          | `local-bucket`            | Nome do bucket (mapeado em `serverless.yml`)         |

## Amarrações de Nomes

| Variável      | Referências                                                                             |
|---------------|-----------------------------------------------------------------------------------------|
| `BUCKET_NAME` | `serverless.yml` → `functions.s3TriggerFunction.events[0].s3.bucket` + `custom.s3.directory` (diretório `./buckets`) |
| `AWS_S3_HOST` | `src/handler.ts` → `S3Client({ endpoint })`                                            |

## Passo a Passo de Execução

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

### 3. Iniciar a aplicação

O `serverless-s3-local` sobe automaticamente junto com o Serverless Offline:

```bash
npm start
```

Você verá no output:
```
S3 local server listening on http://0.0.0.0:4569
```

O bucket `local-bucket` é criado automaticamente a partir do diretório `./buckets/local-bucket/`.

### 4. Fazer upload de um arquivo para acionar o trigger

**Opção A — AWS CLI com endpoint local:**

```bash
AWS_ACCESS_KEY_ID=S3RVER \
AWS_SECRET_ACCESS_KEY=S3RVER \
aws --endpoint-url http://localhost:4569 \
    s3 cp ./buckets/local-bucket/example.json s3://local-bucket/example.json
```

**Opção B — awslocal (se instalado):**

```bash
awslocal --endpoint-url http://localhost:4569 \
    s3 cp ./buckets/local-bucket/example.json s3://local-bucket/example.json
```

Nos logs do Serverless Offline você verá:
```
New object created in bucket local-bucket with key example.json
Conteúdo do arquivo: { ... }
```

## Estrutura do Bucket Local

O diretório `./buckets/local-bucket/` contém os arquivos pré-existentes no bucket ao iniciar:

```
buckets/
  local-bucket/
    example.json           ← arquivo de exemplo para testes
    *.S3rver_object        ← metadados internos do serverless-s3-local (não editar)
```

## Testes

### Testes unitários (sem infraestrutura)

```bash
npm test
```

Os testes cobrem:
- `handler.execute` — status 200, Bucket/Key corretos no comando, conteúdo no body, status 500 em erro de S3, status 500 em JSON inválido
- `utils.streamToString` — chunks múltiplos, conteúdo JSON, erro de stream, stream vazio

### Verificação de tipos TypeScript

```bash
npm run typecheck
```

## Testando com o arquivo de exemplo

O arquivo `./buckets/local-bucket/example.json` já existe no bucket ao iniciar. Com a aplicação rodando, use o [api.http](./api.http) ou faça o upload diretamente:

```bash
# Verificar que o bucket está acessível
AWS_ACCESS_KEY_ID=S3RVER AWS_SECRET_ACCESS_KEY=S3RVER \
  aws --endpoint-url http://localhost:4569 s3 ls s3://local-bucket/
```
