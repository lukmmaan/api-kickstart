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
  urlWithoutProtocol: /^(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z]{2,63}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)$/,
  domain: /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/,
  hostname: /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/,
  subdomain: /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/,
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  kebabCase: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  pascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  snakeCase: /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/,
  constantCase: /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/,
  username: /^[a-zA-Z0-9_-]{3,20}$/,

  alphanumeric: /^[a-zA-Z0-9]+$/,
  alpha: /^[a-zA-Z]+$/,
  alphaSpaces: /^[a-zA-Z\s]+$/,
  numeric: /^[0-9]+$/,
  integer: /^-?\d+$/,
  positiveInteger: /^[1-9]\d*$/,
  negativeInteger: /^-[1-9]\d*$/,
  decimal: /^-?\d+\.\d+$/,
  float: /^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/,
  whitespace: /^\s+$/,
  noWhitespace: /^\S+$/,

  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  uuidV1: /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  uuidV3: /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  uuidV5: /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  uuidAny: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  nanoid: /^[A-Za-z0-9_-]{21}$/,
  objectId: /^[0-9a-f]{24}$/i,

  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  ipv6: /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/,
  ipv4Cidr: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:3[0-2]|[12]?[0-9])$/,
  ipv6Cidr: /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(?:12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,
  macAddress: /^(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$|^(?:[0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$/,
  port: /^(?:6553[0-5]|655[0-2][0-9]|65[0-4][0-9]{2}|6[0-4][0-9]{3}|[1-5][0-9]{4}|[1-9][0-9]{0,3}|0)$/,

  hexColor: /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
  rgbColor: /^rgb\(\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*\)$/,
  rgbaColor: /^rgba\(\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\s*,\s*(?:0|1|0?\.\d+)\s*\)$/,
  hslColor: /^hsl\(\s*(?:360|3[0-5][0-9]|[12]?[0-9]{1,2})\s*,\s*(?:100|[1-9]?[0-9])%\s*,\s*(?:100|[1-9]?[0-9])%\s*\)$/,

  jwt: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
  base64: /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
  base64url: /^[A-Za-z0-9_-]+$/,
  md5: /^[a-f0-9]{32}$/i,
  sha1: /^[a-f0-9]{40}$/i,
  sha256: /^[a-f0-9]{64}$/i,
  sha512: /^[a-f0-9]{128}$/i,
  bearerToken: /^Bearer\s[A-Za-z0-9\-._~+/]+=*$/,
  bcryptHash: /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/,
  hexadecimal: /^(?:0x)?[0-9a-fA-F]+$/,
  base32: /^[A-Z2-7]+=*$/,
  base58: /^[1-9A-HJ-NP-Za-km-z]+$/,

  isoDate: /^\d{4}-\d{2}-\d{2}$/,
  isoDateTime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/,
  isoDateTimeMs: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(?:Z|[+-]\d{2}:\d{2})?$/,
  isoTime: /^\d{2}:\d{2}:\d{2}$/,
  isoWeek: /^\d{4}-W(?:0[1-9]|[1-4][0-9]|5[0-3])$/,
  usDate: /^(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12][0-9]|3[01])\/\d{4}$/,
  euDate: /^(?:0[1-9]|[12][0-9]|3[01])\/(?:0[1-9]|1[0-2])\/\d{4}$/,
  dottedDate: /^(?:0[1-9]|[12][0-9]|3[01])\.(?:0[1-9]|1[0-2])\.\d{4}$/,
  time24h: /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/,
  time12h: /^(?:0?[1-9]|1[0-2]):[0-5][0-9]\s?[APap][Mm]$/,
  unixTimestampSeconds: /^\d{10}$/,
  unixTimestampMillis: /^\d{13}$/,
  yearMonth: /^\d{4}-(?:0[1-9]|1[0-2])$/,
  monthDay: /^(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])$/,
  cronExpression: /^(?:\*|[0-9,\-*/]+)\s+(?:\*|[0-9,\-*/]+)\s+(?:\*|[0-9,\-*/]+)\s+(?:\*|[0-9,\-*/]+)\s+(?:\*|[0-9,\-*/]+)$/,
  isoDuration: /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/,

  phone: /^\+?[1-9]\d{7,14}$/,
  usPhone: /^(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/,
  usPhoneExt: /^(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?:\s?(?:x|ext\.?)\s?\d{1,6})?$/,
  ukPhone: /^(?:\+44\s?|0)(?:\d\s?){9,10}$/,
  usZip: /^\d{5}$/,
  usZipPlus4: /^\d{5}-\d{4}$/,
  canadianPostalCode: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i,
  ukPostalCode: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
  latitude: /^[-+]?(?:90(?:\.0+)?|[1-8]?\d(?:\.\d+)?)$/,
  longitude: /^[-+]?(?:180(?:\.0+)?|(?:1[0-7]\d|\d{1,2})(?:\.\d+)?)$/,
  geoCoordinate: /^[-+]?(?:90(?:\.0+)?|[1-8]?\d(?:\.\d+)?),\s*[-+]?(?:180(?:\.0+)?|(?:1[0-7]\d|\d{1,2})(?:\.\d+)?)$/,

  creditCardVisa: /^4\d{12}(?:\d{3})?$/,
  creditCardMastercard: /^(?:5[1-5]\d{2}|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)\d{12}$/,
  creditCardAmex: /^3[47]\d{13}$/,
  creditCardDiscover: /^6(?:011|5\d{2})\d{12}$/,
  creditCardGeneric: /^\d{13,19}$/,
  creditCardExpiry: /^(?:0[1-9]|1[0-2])\/\d{2}$/,
  cvv: /^\d{3,4}$/,
  iban: /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/,
  usSSN: /^(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}$/,
  usEIN: /^\d{2}-\d{7}$/,
  currencyUSD: /^\$?\d+(?:,\d{3})*(?:\.\d{2})?$/,
  isbn10: /^(?:\d[- ]?){9}[\dX]$/,
  isbn13: /^97[89][- ]?(?:\d[- ]?){9}\d$/,

  semver: /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
  npmPackageName: /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/,
  npmScopedPackageName: /^@[a-z0-9~-][a-z0-9._~-]*\/[a-z0-9~-][a-z0-9._~-]*$/,
  dockerImageTag: /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127})?$/,
  gitShortHash: /^[0-9a-f]{7,10}$/i,
  gitLongHash: /^[0-9a-f]{40}$/i,
  environmentVariableName: /^[A-Z][A-Z0-9_]*$/,
  httpHeaderName: /^[A-Za-z0-9][A-Za-z0-9-]*$/,
  mimeType: /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]*$/,

  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/,
  htmlTag: /^<([a-z][a-z0-9]*)\b[^>]*>(?:.*?<\/\1>)?$/i,
  filePathUnix: /^(?:\/[^/\0]+)+\/?$/,
  filePathWindows: /^[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*$/,
  fileExtension: /^\.[a-zA-Z0-9]+$/,
  base64Image: /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/]+=*$/,
  jsonPointer: /^(?:\/(?:[^~/]|~0|~1)*)*$/,
  cssClassName: /^-?[_a-zA-Z][_a-zA-Z0-9-]*$/,
  hashtag: /^#[A-Za-z0-9_]+$/,
  twitterHandle: /^@?[A-Za-z0-9_]{1,15}$/,
}
