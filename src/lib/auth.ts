import type { APIGatewayProxyEventV2 } from 'aws-lambda';

import { unauthorizedError } from './errors';

export type AuthContext = {
  teacherId: string;
  email?: string;
  displayName?: string;
};

export const getAuthContext = (event: APIGatewayProxyEventV2): AuthContext => {
  const claims = (event.requestContext as APIGatewayProxyEventV2['requestContext'] & {
    authorizer?: {
      jwt?: {
        claims?: Record<string, string | undefined>;
      };
    };
  }).authorizer?.jwt?.claims;

  if (!claims?.sub) {
    throw unauthorizedError();
  }

  const email = typeof claims.email === 'string' ? claims.email : undefined;
  const displayName =
    typeof claims.name === 'string'
      ? claims.name
      : typeof claims.given_name === 'string'
        ? claims.given_name
        : undefined;

  return {
    teacherId: claims.sub,
    ...(email ? { email } : {}),
    ...(displayName ? { displayName } : {})
  };
};
