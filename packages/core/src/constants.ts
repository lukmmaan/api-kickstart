export const TTL_UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86400 } as const

export const TTL_UNIT_MILLISECONDS = { s: 1000, m: 60000, h: 3600000, d: 86400000 } as const

export const DEFAULT_JWT_ALGORITHM = 'HS256' as const
export const DEFAULT_JWT_ACCESS_TTL = '15m'
export const DEFAULT_JWT_REFRESH_TTL = '30d'
export const DEFAULT_JWT_TOKEN_SOURCES: string[] = ['header:authorization']

export const DEFAULT_SESSION_COOKIE_NAME = 'sid'
export const DEFAULT_SESSION_TTL = '7d'

export const DEFAULT_API_KEY_SOURCE = 'header:x-api-key'

export const DEV_CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
export const STRICT_CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
export const DEV_CORS_ALLOWED_HEADERS = ['content-type', 'authorization']

export const DEFAULT_RESOURCE_ACTIONS = ['list', 'get', 'create', 'update', 'delete'] as const

export const OPENAPI_VERSION = '3.0.3'
export const OPENAPI_RESPONSE_DESCRIPTIONS: Record<string, string> = {
  '200': 'Success',
  '400': 'Validation error',
  '401': 'Unauthorized',
  '403': 'Forbidden',
  '404': 'Not found',
}
