# TODO — Oportunidades de Melhoria com AWS Lambda Powertools

Este arquivo lista melhorias recomendadas para elevar esta POC a um padrão de produção,
utilizando a biblioteca [@aws-lambda-powertools for TypeScript](https://docs.powertools.aws.dev/lambda/typescript/latest/).

---

## 1. Observabilidade — Logger

**Situação atual:** `console.log(response.TableNames)` sem estruturação nem contexto.

**Melhoria:** Substituir por `@aws-lambda-powertools/logger` para logs JSON com `requestId`,
`tableName`, `itemCount` e contexto da requisição automaticamente incluídos.

```typescript
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'dynamodb-tables' });

// Substitui: console.log(response.TableNames)
logger.info('Tabelas listadas', {
  tableCount: response.TableNames?.length,
  exclusiveStartTableName: tableName,
});
```

---

## 2. Observabilidade — Tracer (X-Ray)

**Situação atual:** Sem rastreamento das chamadas DynamoDB.

**Melhoria:** Usar `@aws-lambda-powertools/tracer` para criar segmentos por operação DynamoDB,
identificando latência de leitura vs. escrita.

```typescript
import { Tracer } from '@aws-lambda-powertools/tracer';

const tracer = new Tracer({ serviceName: 'dynamodb-tables' });
const client = tracer.captureAWSv3Client(new DynamoDBClient({ ... }));
```

**Impacto:** Mapa de serviços no X-Ray mostrando latência das operações `ListTables` e `PutItem`.

---

## 3. Validação de Esquema — Parser

**Situação atual:** `JSON.parse(event.body as string)` sem validação. Um payload inválido
(campos não-string, body ausente) causa erro genérico em runtime.

**Melhoria:** Usar `@aws-lambda-powertools/parser` com Zod para validar o body antes do
processamento.

```typescript
import { z } from 'zod';

const ItemSchema = z.record(z.string(), z.string());

export const postItem = async (event: APIGatewayEvent): Promise<ProxyResult> => {
  const body = ItemSchema.parse(JSON.parse(event.body ?? '{}'));
  // a partir daqui body é tipado e validado
};
```

**Impacto:** Erros de schema retornam 400 com mensagem descritiva em vez de 500 genérico.

---

## 4. Idempotência — Idempotency

**Situação atual:** Múltiplas invocações com o mesmo payload inserem/sobrescrevem o item
silenciosamente. Não há proteção contra retentativas duplicadas.

**Melhoria:** Usar `@aws-lambda-powertools/idempotency` para deduplizar chamadas ao
`postItem` com base no `body` do evento.

```typescript
import { makeHandlerIdempotent } from '@aws-lambda-powertools/idempotency';
import { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';

const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: 'idempotency-store',
});

export const postItem = makeHandlerIdempotent(
  async (event: APIGatewayEvent) => { /* ... */ },
  { persistenceStore }
);
```

---

## 5. Parâmetros — Parameters

**Situação atual:** `DB_HOST_URL` e credenciais AWS estão em variáveis de ambiente injetadas
pelo `.env`. Em produção, segredos deveriam vir do SSM Parameter Store ou Secrets Manager.

**Melhoria:** Usar `@aws-lambda-powertools/parameters` para buscar o endpoint e credenciais
no SSM, com cache automático entre invocações.

```typescript
import { SSMProvider } from '@aws-lambda-powertools/parameters/ssm';

const ssm = new SSMProvider();
const dbHostUrl = await ssm.get('/myapp/dynamodb/endpoint', { decrypt: true });
```

---

## 6. Melhorias de Código

- **Remover `src/utils.ts`:** Contém funções SQS (`generateSQSQueueUrlFromArn`,
  `getOfflineSqsQueueUrl`, `getDelaySeconds`) que não são utilizadas neste branch.
  São código morto herdado de outros branches.

- **Tratamento de erros no `postItem`:** Atualmente não há try/catch. Um erro do DynamoDB
  retorna 502 pelo API Gateway em vez de 500 controlado. Adicionar tratamento explícito:
  ```typescript
  try {
    await client.send(command);
    return { statusCode: 200, body: JSON.stringify({ message: 'Item added successfully' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal server error' }) };
  }
  ```

- **Conversão de tipos genérica:** O `postItem` usa `as any` no `reduce`. Tipar corretamente
  com `Record<string, { S: string }>` para eliminar o `any`.

- **Paginação completa no `get`:** `ListTablesCommand` retorna no máximo 100 tabelas.
  Implementar paginação com `LastEvaluatedTableName` para ambientes com muitas tabelas.
