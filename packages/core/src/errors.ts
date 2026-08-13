export class AppError extends Error {
  code: string
  status: number
  details?: unknown

  constructor(code: string, status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export class BadRequest extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super('BAD_REQUEST', 400, message, details)
    this.name = 'BadRequest'
  }
}

export class Unauthorized extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super('UNAUTHORIZED', 401, message, details)
    this.name = 'Unauthorized'
  }
}

export class Forbidden extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super('FORBIDDEN', 403, message, details)
    this.name = 'Forbidden'
  }
}

export class NotFound extends AppError {
  constructor(message = 'Not found', details?: unknown) {
    super('NOT_FOUND', 404, message, details)
    this.name = 'NotFound'
  }
}

export class Conflict extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super('CONFLICT', 409, message, details)
    this.name = 'Conflict'
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super('VALIDATION_ERROR', 422, 'Request validation failed', details)
    this.name = 'ValidationError'
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super('INTERNAL_ERROR', 500, message)
    this.name = 'InternalError'
  }
}

export interface FormattedError {
  status: number
  body: {
    error: {
      code: string
      message: string
      details?: unknown
      requestId: string
      stack?: string
    }
  }
}

export function formatError(err: unknown, requestId: string, includeStack: boolean): FormattedError {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
          requestId,
          stack: includeStack ? err.stack : undefined,
        },
      },
    }
  }
  const stack = err instanceof Error ? err.stack : undefined
  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId,
        stack: includeStack ? stack : undefined,
      },
    },
  }
}
