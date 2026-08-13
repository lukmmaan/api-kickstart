import { OPENAPI_RESPONSE_DESCRIPTIONS, OPENAPI_VERSION } from './constants.js'
import type { RouteConfig } from './types.js'

export interface OpenApiInfo {
  title: string
  version: string
  description?: string
}

export interface OpenApiOptions {
  info: OpenApiInfo
  servers?: { url: string }[]
  serve?: string
  json?: string
}

function extractParamNames(path: string): string[] {
  return path
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => segment.slice(1))
}

export function buildOpenApiSpec(routes: RouteConfig[], options: OpenApiOptions): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {}

  for (const route of routes) {
    const pathKey = route.path.replace(/:([^/]+)/g, '{$1}')
    paths[pathKey] ??= {}
    paths[pathKey][route.method.toLowerCase()] = {
      summary: route.summary,
      tags: route.tags,
      security: route.auth ? [{ bearerAuth: [] }] : [],
      parameters: extractParamNames(route.path).map((name) => ({
        name,
        in: 'path',
        required: true,
        schema: { type: 'string' },
      })),
      responses: Object.fromEntries(
        Object.entries(OPENAPI_RESPONSE_DESCRIPTIONS).map(([status, description]) => [status, { description }]),
      ),
    }
  }

  return {
    openapi: OPENAPI_VERSION,
    info: options.info,
    servers: options.servers ?? [],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    paths,
  }
}
