import { OPENAPI_RESPONSE_DESCRIPTIONS, OPENAPI_VERSION } from './constants.js'
import type { RouteConfig, Validator } from './types.js'

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

interface JsonSchemaObject {
  type?: string
  properties?: Record<string, unknown>
  required?: string[]
}

function extractParamNames(path: string): string[] {
  return path
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => segment.slice(1))
}

function toJsonSchema(validator: Validator | undefined, schema: unknown): unknown {
  if (!schema || !validator?.toJsonSchema) return undefined
  try {
    return validator.toJsonSchema(schema)
  } catch {
    return undefined
  }
}

function queryParameters(validator: Validator | undefined, route: RouteConfig): Record<string, unknown>[] {
  const jsonSchema = toJsonSchema(validator, route.query) as JsonSchemaObject | undefined
  if (!jsonSchema?.properties) return []
  const required = new Set(jsonSchema.required ?? [])
  return Object.entries(jsonSchema.properties).map(([name, propertySchema]) => ({
    name,
    in: 'query',
    required: required.has(name),
    schema: propertySchema,
  }))
}

function requestBody(validator: Validator | undefined, route: RouteConfig): Record<string, unknown> | undefined {
  const schema = toJsonSchema(validator, route.body)
  if (!schema) return undefined
  return { content: { 'application/json': { schema } } }
}

function responses(validator: Validator | undefined, route: RouteConfig): Record<string, unknown> {
  const successSchema = toJsonSchema(validator, route.response)
  return Object.fromEntries(
    Object.entries(OPENAPI_RESPONSE_DESCRIPTIONS).map(([status, description]) => [
      status,
      status === '200' && successSchema
        ? { description, content: { 'application/json': { schema: successSchema } } }
        : { description },
    ]),
  )
}

export function buildOpenApiSpec(routes: RouteConfig[], options: OpenApiOptions, validator?: Validator): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {}

  for (const route of routes) {
    const pathKey = route.path.replace(/:([^/]+)/g, '{$1}')
    const pathParameters = extractParamNames(route.path).map((name) => ({
      name,
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }))

    paths[pathKey] ??= {}
    paths[pathKey][route.method.toLowerCase()] = {
      summary: route.summary,
      tags: route.tags,
      security: route.auth ? [{ bearerAuth: [] }] : [],
      parameters: [...pathParameters, ...queryParameters(validator, route)],
      requestBody: requestBody(validator, route),
      responses: responses(validator, route),
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
