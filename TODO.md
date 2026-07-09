# TODO — Status da POC SNS + SQS Resiliente

## Entregue

- [x] Producer HTTP publicando evento `PedidoCriado` em SNS.
- [x] Fan-out SNS para duas filas SQS independentes.
- [x] `consumer-log` com processamento simples e métricas básicas.
- [x] `consumer-resilient` com:
  - [x] idempotência com DynamoDB TTL
  - [x] classificação de falha transiente/permanente
  - [x] retry via `ReportBatchItemFailures`
  - [x] desvio explícito de poison pill para fila de erro final
- [x] Configuração de DLQ final para fila resiliente.
- [x] Testes unitários cobrindo happy-path, duplicidade, transiente e permanente.

## Próximos Passos (Hardening)

- [ ] Adicionar Powertools Tracer para rastreamento distribuído.
- [ ] Incluir alarmes CloudWatch para crescimento de DLQ final.
- [ ] Definir dashboards com taxa de retry e taxa de duplicidade.
- [ ] Restringir IAM por princípio de menor privilégio.
- [ ] Rodar carga para validar tuning de `batchSize` e `maximumBatchingWindow`.
