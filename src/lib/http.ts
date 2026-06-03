import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { apiErrorResponseSchema } from '@brouklins/class-manager-shared';

import { AppError } from './errors';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'DELETE,GET,OPTIONS,PATCH,POST',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-max-age': '3600'
};

export const json = (
  statusCode: number,
  body: unknown
): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: {
    'content-type': 'application/json',
    ...corsHeaders
  },
  body: JSON.stringify(body)
});

export const noContent = (): APIGatewayProxyStructuredResultV2 => ({
  statusCode: 204,
  headers: corsHeaders
});

export const preflight = (): APIGatewayProxyStructuredResultV2 => ({
  statusCode: 204,
  headers: corsHeaders
});

export const parseJsonBody = <T>(event: APIGatewayProxyEventV2): T | undefined => {
  if (!event.body) {
    return undefined;
  }

  return JSON.parse(event.body) as T;
};

export const pathSegments = (rawPath: string): string[] =>
  rawPath
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));

export const handleError = (error: unknown): APIGatewayProxyStructuredResultV2 => {
  if (error instanceof AppError) {
    return json(
      error.statusCode,
      apiErrorResponseSchema.parse({
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      })
    );
  }

  console.error('Unhandled error', error);

  return json(
    500,
    apiErrorResponseSchema.parse({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected server error.',
        details: []
      }
    })
  );
};
