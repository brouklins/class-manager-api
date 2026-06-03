# class-manager-api

API serverless do MVP `class-manager`.

## Stack

- AWS Lambda
- API Gateway HTTP API
- DynamoDB
- TypeScript
- Zod

## Desenvolvimento local

Este repositório consome o pacote compartilhado via dependência local:

```txt
../class-manager-shared
```

## Scripts

- `pnpm build`
- `pnpm test`
- `pnpm typecheck`
- `pnpm package`

## Deploy

O workflow em `.github/workflows/api.yml`:

1. valida build/testes
2. empacota a Lambda
3. busca o nome da função no SSM Parameter Store
4. executa `aws lambda update-function-code`

