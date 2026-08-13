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
      responses: {
        '200': { description: 'Success' },
        '400': { description: 'Validation error' },
        '401': { description: 'Unauthorized' },
        '403': { description: 'Forbidden' },
        '404': { description: 'Not found' },
      },
    }
  }

  return {
    openapi: '3.0.3',
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
