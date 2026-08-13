export interface CorsOptions {
  origin: (string | RegExp)[] | '*'
  credentials?: boolean
  methods?: string[]
  allowedHeaders?: string[]
  exposedHeaders?: string[]
  maxAge?: number
}

export type CorsConfig = 'dev' | 'strict' | 'off' | CorsOptions

function matchOrigin(origin: string, allowed: (string | RegExp)[] | '*'): boolean {
  if (allowed === '*') return true
  return allowed.some((entry) => (entry instanceof RegExp ? entry.test(origin) : entry === origin))
}

export function resolveCorsOptions(config: CorsConfig, nodeEnv: string | undefined): CorsOptions | null {
  if (config === 'off') return null

  if (config === 'dev') {
    if (nodeEnv === 'production') {
      throw new Error('cors: "dev" cannot be used when NODE_ENV=production')
    }
    return {
      origin: '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['content-type', 'authorization'],
    }
  }

  if (config === 'strict') {
    return { origin: [], credentials: false, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }
  }

  if (config.origin === '*' && config.credentials) {
    throw new Error('cors: wildcard origin with credentials:true is not allowed')
  }

  return config
}

export function buildCorsHeaders(options: CorsOptions, origin: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {}

  if (options.origin === '*' && !options.credentials) {
    headers['access-control-allow-origin'] = '*'
  } else if (origin && matchOrigin(origin, options.origin)) {
    headers['access-control-allow-origin'] = origin
    headers.vary = 'origin'
    if (options.credentials) headers['access-control-allow-credentials'] = 'true'
  }

  if (options.methods) headers['access-control-allow-methods'] = options.methods.join(', ')
  if (options.allowedHeaders) headers['access-control-allow-headers'] = options.allowedHeaders.join(', ')
  if (options.exposedHeaders) headers['access-control-expose-headers'] = options.exposedHeaders.join(', ')
  if (options.maxAge) headers['access-control-max-age'] = String(options.maxAge)

  return headers
}
