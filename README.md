# Serverless with ElasticMQ

## Dependencies
- Docker
- Node
- Serverless

## Development

* Para iniciar o serviço de filas: `podman-compose -f ./elasticMQ/docker-compose.yml up -d`
* Para iniciar a aplicação: `npm run start`
* Para ver as filas: `http://localhost:9325/`
* Para colocar mensagem na fila: `curl --request POST \
  --url http://localhost:3000/produce-message \
  --data '{
    "email": "paulo.rios@grupoboticario.com.br"
}'`
