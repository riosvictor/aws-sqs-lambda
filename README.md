# Serverless with ElasticMQ

## Dependencies
- Docker
- Node
- Serverless

## Development

### Configurando o ambiente
* Para iniciar o serviço de filas: `podman-compose up -d`
* Para iniciar a aplicação: `npm start`
* Para ver as filas:
  - Pode utilizar o [Localstack Desktop](https://docs.localstack.cloud/user-guide/tools/localstack-desktop/)
  - Ou o [Local Stack Web Application](https://docs.localstack.cloud/user-guide/web-application/) 
* Para colocar mensagem na fila [ver o arquivo de requisições](./api.http) 

### Configurando a fila e as variáveis de ambiente
* criando uma fila no terminal
  - podman ps (para recuperar o ID do container)
  - podman exec -it <container-id> /bin/bash (para acessar o container)
  - awslocal sqs create-queue --queue-name test-queue (para criar a fila como nome 'test-queue')

* criando uma fila via interface
  - acesse a interface que desejar
  - Selecione o serviço de SQS
  - Selecione a opção de criação de fila

* para saber o endereço ARN da fila
  - podman ps (para recuperar o ID do container)
  - podman exec -it <container-id> /bin/bash (para acessar o container)
  - awslocal sqs get-queue-attributes --queue-url http://localhost:4566/000000000000/minha-fila --attribute-names QueueArn

* Configure o arquivo .env

### Configurando o Localstack

```bash
# criando as filas
# Essa fila é criada automaticamente: awslocal sqs create-queue --queue-name input-queue 
# Essa fila é criada automaticamente: awslocal sqs create-queue --queue-name input-queue-dlq 
awslocal sqs create-queue --queue-name input-queue-dlq-dlq 
```

```bash
# configurando as dead letter queues
awslocal sqs set-queue-attributes \
--queue-url http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/input-queue \
--attributes '{
    "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:000000000000:input-queue-dlq\",\"maxReceiveCount\":\"3\"}",
    "DelaySeconds":"90"
}'

awslocal sqs set-queue-attributes \
--queue-url http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/input-queue-dlq \
--attributes '{
    "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:000000000000:input-queue-dlq-dlq\"}",
    "DelaySeconds":"60"
}'
```

awslocal sqs send-message --queue-url http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/input-queue --message-body "Hello World 1" --delay-seconds 60