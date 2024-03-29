# Serverless with ElasticMQ

## Dependencies
- Docker
- Node
- Serverless

## Development

### Configurando o ambiente
* Para iniciar o serviço de filas: `podman-compose up -d`
* Para iniciar a aplicação: `npm run start`
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

* COnfigure o arquivo .env
