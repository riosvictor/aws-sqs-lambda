# TODO — Oportunidades de Melhoria com AWS Lambda Powertools

Este arquivo lista melhorias recomendadas para elevar esta POC a um padrão de produção,
utilizando a biblioteca [@aws-lambda-powertools for TypeScript](https://docs.powertools.aws.dev/lambda/typescript/latest/).

---

## 1. Observabilidade — Logger

**Situação atual:** `console.log` e `console.error` sem estruturação nem correlação com o
evento S3.

**Melhoria:** Substituir por `@aws-lambda-powertools/logger` para logs JSON com `requestId`,
`bucketName`, `objectKey` e conteúdo do arquivo automaticamente incluídos.

```typescript
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 's3-trigger' });

// Substitui os console.log e console.error
logger.info('Objeto S3 processado', { bucketName, objectKey, contentSize: fileContent.length });
logger.error('Erro ao ler objeto S3', { error, bucketName, objectKey });
```

---

## 2. Observabilidade — Tracer (X-Ray)

**Situação atual:** Sem rastreamento das chamadas S3 (`GetObjectCommand`).

**Melhoria:** Usar `@aws-lambda-powertools/tracer` para criar segmentos por operação S3,
identificando latência de download do objeto.

```typescript
import { Tracer } from '@aws-lambda-powertools/tracer';

const tracer = new Tracer({ serviceName: 's3-trigger' });
const client = tracer.captureAWSv3Client(new S3Client({ ... }));
```

**Impacto:** Mapa de serviços no X-Ray mostrando a latência do `GetObject` para cada evento.

---

## 3. Validação de Esquema — Parser

**Situação atual:** `JSON.parse(fileContent)` sem validação. Um arquivo com JSON inválido ou
schema incorreto resulta em erro genérico capturado pelo `catch`.

**Melhoria:** Usar `@aws-lambda-powertools/parser` com Zod para validar o conteúdo do
arquivo após o parse.

```typescript
import { z } from 'zod';

const FileSchema = z.object({
  email: z.string().email(),
  // outros campos esperados
});

const fileContentJSON = FileSchema.parse(JSON.parse(fileContent));
// fileContentJSON é tipado e validado
```

**Impacto:** Erros de schema são distinguidos de erros de infraestrutura, facilitando
depuração e alertas.

---

## 4. Métricas — Metrics

**Situação atual:** Sem métricas publicadas no CloudWatch para monitorar o processamento.

**Melhoria:** Usar `@aws-lambda-powertools/metrics` para medir o throughput e tamanho dos
arquivos processados.

```typescript
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

const metrics = new Metrics({ namespace: 'S3Poc', serviceName: 's3-trigger' });

// No sucesso:
metrics.addMetric('FilesProcessed', MetricUnit.Count, 1);
metrics.addMetric('FileSizeBytes', MetricUnit.Bytes, fileContent.length);
metrics.publishStoredMetrics();

// No erro:
metrics.addMetric('ProcessingErrors', MetricUnit.Count, 1);
metrics.publishStoredMetrics();
```

---

## 5. Parâmetros — Parameters

**Situação atual:** `AWS_S3_HOST` e credenciais S3 (`S3RVER`) estão hardcoded no `.env`.
Em produção, o endpoint e credenciais deveriam vir do SSM.

**Melhoria:** Usar `@aws-lambda-powertools/parameters` para buscar o endpoint S3 e as
credenciais no SSM Parameter Store com cache automático.

```typescript
import { SSMProvider } from '@aws-lambda-powertools/parameters/ssm';

const ssm = new SSMProvider();
const s3Host = await ssm.get('/myapp/s3/endpoint');
```

---

## 6. Melhorias de Código

- **`streamToString` com SDK v3:** O AWS SDK v3 retorna o `Body` como `SdkStreamMixin`,
  que já tem um método `transformToString()` nativo, eliminando a necessidade de
  `streamToString` manual:
  ```typescript
  const fileContent = await response.Body?.transformToString('utf-8') ?? '';
  ```

- **Tipagem de `error` no catch:** O bloco `catch (error)` acessa `error.message` sem
  verificar o tipo. Substituir por:
  ```typescript
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
  ```

- **`S3Client` no escopo de módulo:** Já está correto (instanciado fora do handler),
  aproveitando o container warm. Apenas garantir que o `endpoint` seja resolvido com
  `Parameters` em produção.

- **Processamento de múltiplos records:** `event.Records[0]` processa apenas o primeiro
  objeto. Em produção, iterar sobre `event.Records` e considerar `Batch Processing`
  para reportar falhas granulares.
