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
* criando um bucket no terminal
  - podman ps (para recuperar o ID do container)
  - podman exec -it <container-id> /bin/bash (para acessar o container)
  - awslocal s3api create-bucket --bucket ...

* criando uma tabela via interface
  - acesse a interface que desejar
  - Selecione o serviço de S3
  - Selecione a opção de criação de bucket


* Configure o arquivo .env

### Configurando o Localstack


```bash
  # listar buckets por perfil
  aws s3api list-buckets --profile s3 --endpoint-url http://localhost:4569
```

```bash
  # criar um bucket
  aws s3api create-bucket --profile s3 --endpoint-url http://localhost:4569 --bucket local-bucket
```

```bash
  # copiar um arquivo para o bucket
  aws s3 cp ./files/example.json s3://local-bucket/ --profile s3 --endpoint-url http://localhost:4569
```

```bash
  # para listar os arquivos do bucket
  aws s3 ls s3://local-bucket --profile s3 --endpoint-url http://localhost:4569
```