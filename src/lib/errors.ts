export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: unknown[];

  constructor(statusCode: number, code: string, message: string, details: unknown[] = []) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;

export const validationError = (message: string, details: unknown[] = []) =>
  new AppError(400, 'VALIDATION_ERROR', message, details);

export const unauthorizedError = (message = 'Unauthorized') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbiddenError = (message = 'Forbidden') => new AppError(403, 'FORBIDDEN', message);

export const accessExpiredError = (message: string, details: unknown[] = []) =>
  new AppError(403, 'ACCESS_EXPIRED', message, details);

export const notFoundError = (message: string) => new AppError(404, 'NOT_FOUND', message);

export const conflictError = (message: string) => new AppError(409, 'CONFLICT', message);
