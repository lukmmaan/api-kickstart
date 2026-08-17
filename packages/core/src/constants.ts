export const TTL_UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86400 } as const

export const TTL_UNIT_MILLISECONDS = { s: 1000, m: 60000, h: 3600000, d: 86400000 } as const

export const SYMMETRIC_JWT_ALGORITHMS = ['HS256', 'HS384', 'HS512'] as const
export const ASYMMETRIC_JWT_ALGORITHMS = ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'] as const
export type JwtAlgorithm = (typeof SYMMETRIC_JWT_ALGORITHMS)[number] | (typeof ASYMMETRIC_JWT_ALGORITHMS)[number]

export const DEFAULT_JWT_ALGORITHM: JwtAlgorithm = 'HS256'
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
export const SCALAR_CDN_URL = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference'
export const OPENAPI_RESPONSE_DESCRIPTIONS: Record<string, string> = {
  '200': 'Success',
  '400': 'Validation error',
  '401': 'Unauthorized',
  '403': 'Forbidden',
  '404': 'Not found',
}

export const BUILTIN_PATTERNS: Record<string, RegExp> = {
  email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  url: /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z]{2,63}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  username: /^[a-zA-Z0-9_-]{3,20}$/,
  hexColor: /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  ipv6: /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/,
  isoDate: /^\d{4}-\d{2}-\d{2}$/,
  isoDateTime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/,
  semver: /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
  jwt: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
  base64: /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
  phone: /^\+?[1-9]\d{7,14}$/,
}
