import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { getAuthContext } from './lib/auth';
import { accessService } from './services/access-service';
import { dashboardService } from './services/dashboard-service';
import { profileService } from './services/profile-service';
import { studentService } from './services/student-service';
import { lessonsService } from './services/lessons-service';
import { handleError, json, noContent, parseJsonBody, preflight } from './lib/http';
import { notFoundError, validationError } from './lib/errors';
import { env } from './lib/env';

const isPath = (event: APIGatewayProxyEventV2, method: string, pattern: RegExp) =>
  event.requestContext.http.method === method && pattern.test(event.rawPath);

const getMatch = (rawPath: string, pattern: RegExp): RegExpMatchArray => {
  const match = rawPath.match(pattern);

  if (!match) {
    throw notFoundError('Route not found.');
  }

  return match;
};

const requireDateRange = (event: APIGatewayProxyEventV2) => {
  const from = event.queryStringParameters?.from;
  const to = event.queryStringParameters?.to;

  if (!from || !to) {
    throw validationError('Query params "from" and "to" are required.');
  }

  return { from, to };
};

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const { rawPath } = event;
    const method = event.requestContext.http.method;

    if (method === 'OPTIONS') {
      return preflight();
    }

    if (method === 'GET' && rawPath === '/v1/health') {
      return json(200, {
        status: 'ok',
        environment: env.appEnv
      });
    }

    const auth = getAuthContext(event);

    if (method === 'GET' && rawPath === '/v1/me/profile') {
      return json(200, await profileService.getProfile(auth));
    }

    if (method === 'PATCH' && rawPath === '/v1/me/profile') {
      return json(200, await profileService.updateProfile(auth, parseJsonBody(event) ?? {}));
    }

    await accessService.requireActiveAccess(auth);

    if (method === 'GET' && rawPath === '/v1/students') {
      const status = event.queryStringParameters?.status ?? 'active';
      const search = event.queryStringParameters?.search;
      return json(200, {
        items: await studentService.listStudents(auth, status, search)
      });
    }

    if (method === 'POST' && rawPath === '/v1/students') {
      return json(201, await studentService.createStudent(auth, parseJsonBody(event) ?? {}));
    }

    if (isPath(event, 'GET', /^\/v1\/students\/[^/]+$/)) {
      const studentId = getMatch(rawPath, /^\/v1\/students\/([^/]+)$/)[1]!;
      return json(200, await studentService.getStudent(auth, studentId));
    }

    if (isPath(event, 'PATCH', /^\/v1\/students\/[^/]+$/)) {
      const studentId = getMatch(rawPath, /^\/v1\/students\/([^/]+)$/)[1]!;
      return json(200, await studentService.updateStudent(auth, studentId, parseJsonBody(event) ?? {}));
    }

    if (isPath(event, 'DELETE', /^\/v1\/students\/[^/]+$/)) {
      const studentId = getMatch(rawPath, /^\/v1\/students\/([^/]+)$/)[1]!;
      await studentService.deleteStudent(auth, studentId);
      return noContent();
    }

    if (method === 'GET' && rawPath === '/v1/lessons') {
      const { from, to } = requireDateRange(event);
      return json(200, {
        items: await lessonsService.listLessons(auth, from, to)
      });
    }

    if (method === 'POST' && rawPath === '/v1/lessons') {
      return json(201, await lessonsService.createLesson(auth, parseJsonBody(event) ?? {}));
    }

    if (isPath(event, 'GET', /^\/v1\/lessons\/[^/]+$/)) {
      const lessonId = getMatch(rawPath, /^\/v1\/lessons\/([^/]+)$/)[1]!;
      return json(200, await lessonsService.getLesson(auth, lessonId));
    }

    if (isPath(event, 'PATCH', /^\/v1\/lessons\/[^/]+$/)) {
      const lessonId = getMatch(rawPath, /^\/v1\/lessons\/([^/]+)$/)[1]!;
      return json(200, await lessonsService.updateLesson(auth, lessonId, parseJsonBody(event) ?? {}));
    }

    if (isPath(event, 'DELETE', /^\/v1\/lessons\/[^/]+$/)) {
      const lessonId = getMatch(rawPath, /^\/v1\/lessons\/([^/]+)$/)[1]!;
      await lessonsService.cancelLesson(auth, lessonId);
      return noContent();
    }

    if (isPath(event, 'POST', /^\/v1\/lessons\/[^/]+\/students\/[^/]+$/)) {
      const match = getMatch(rawPath, /^\/v1\/lessons\/([^/]+)\/students\/([^/]+)$/);
      const lessonId = match[1]!;
      const studentId = match[2]!;
      return json(200, await lessonsService.addStudent(auth, lessonId, studentId));
    }

    if (isPath(event, 'DELETE', /^\/v1\/lessons\/[^/]+\/students\/[^/]+$/)) {
      const match = getMatch(rawPath, /^\/v1\/lessons\/([^/]+)\/students\/([^/]+)$/);
      const lessonId = match[1]!;
      const studentId = match[2]!;
      await lessonsService.removeStudent(auth, lessonId, studentId);
      return noContent();
    }

    if (method === 'GET' && rawPath === '/v1/dashboard/summary') {
      return json(
        200,
        await dashboardService.getSummary(
          auth,
          event.queryStringParameters?.from,
          event.queryStringParameters?.to
        )
      );
    }

    throw notFoundError('Route not found.');
  } catch (error) {
    return handleError(error);
  }
};
