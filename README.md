# Serverless with ElasticMQ

## Dependencies
- Docker
- Node
- Serverless

## Development

### Configurando o ambiente
* Para iniciar o serviço do localstack: `podman-compose up -d`
* Para iniciar a aplicação: `npm start`
* Para ver a interface:
  - Pode utilizar o [Localstack Desktop](https://docs.localstack.cloud/user-guide/tools/localstack-desktop/)
  - Ou o [Local Stack Web Application](https://docs.localstack.cloud/user-guide/web-application/) 

### Configurando a fila e as variáveis de ambiente
* criando uma tabela no terminal
  - podman ps (para recuperar o ID do container)
  - podman exec -it <container-id> /bin/bash (para acessar o container)
  - awslocal dynamodb create-table ...

* criando uma tabela via interface
  - acesse a interface que desejar
  - Selecione o serviço de DynamoDB
  - Selecione a opção de criação de tabela


* Configure o arquivo .env

### Configurando o Localstack

```bash
  awslocal dynamodb create-table \
  --table-name sdksTable \
  --key-schema AttributeName=key,KeyType=HASH \
  AttributeName=payload,KeyType=RANGE \
  --attribute-definitions AttributeName=key,AttributeType=S \
  AttributeName=payload,AttributeType=S \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```