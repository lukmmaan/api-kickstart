export interface ScaffoldFile {
  path: string
  contents: string
}

export type ScaffoldFieldType = 'string' | 'number' | 'boolean'

export interface ScaffoldField {
  name: string
  type: ScaffoldFieldType
}

export interface ScaffoldResource {
  /** Free-text resource name as typed by the user, e.g. "posts". */
  input: string
  fields: ScaffoldField[]
}

export type AuthChoice = 'jwt' | 'apiKey' | 'both' | 'none'
export type ScaffoldLang = 'ts' | 'js'
export type OpsEndpoint = 'health' | 'metrics' | 'openapi'
export type SecurityMiddlewareId =
  | 'requestId'
  | 'logger'
  | 'helmet'
  | 'compression'
  | 'rateLimit'
  | 'bodyLimit'
  | 'timeout'
  | 'idempotency'
  | 'csrf'

export interface ScaffoldChoice {
  frameworkId: string
  databaseId: string
  validatorId: string
  resources: ScaffoldResource[]
  authId: AuthChoice
  authorization: boolean
  i18n: boolean
  language: ScaffoldLang
  opsEndpoints: OpsEndpoint[]
  productionEssentials: boolean
  securityMiddleware: SecurityMiddlewareId[]
}

export interface ProjectTheme {
  id: string
  label: string
  description: string
  generate(choice: ScaffoldChoice): ScaffoldFile[]
}

interface ResourceNames {
  plural: string
  singular: string
  Pascal: string
  PascalPlural: string
}

function slugify(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
  return slug || 'items'
}

function singularize(word: string): string {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.endsWith('ses')) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

function pascalCase(word: string): string {
  return word
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')
}

/** Splits a comma-separated "users, posts, comments" answer into a clean list of resource names. */
export function parseResourceList(input: string): string[] {
  return [...new Set(input.split(',').map((part) => part.trim()).filter(Boolean))]
}

const FIELD_TYPES: ScaffoldFieldType[] = ['string', 'number', 'boolean']

function sanitizeFieldName(input: string): string {
  const cleaned = input.trim().replace(/[^a-zA-Z0-9_]/g, '')
  if (!cleaned) return ''
  return /^[0-9]/.test(cleaned) ? `f${cleaned}` : cleaned
}

/** Parses a "name:type, name2:type2" answer into field definitions. Bare "name" (no ":type") defaults to string. */
export function parseFields(input: string): ScaffoldField[] {
  const fields: ScaffoldField[] = []
  const seen = new Set<string>()

  for (const part of input.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const [rawName, rawType] = trimmed.split(':').map((s) => s.trim())
    const name = sanitizeFieldName(rawName ?? '')
    if (!name || seen.has(name)) continue
    const type = FIELD_TYPES.includes(rawType as ScaffoldFieldType) ? (rawType as ScaffoldFieldType) : 'string'
    seen.add(name)
    fields.push({ name, type })
  }

  return fields.length > 0 ? fields : [{ name: 'name', type: 'string' }]
}

export function resourceNames(input: string): ResourceNames {
  const plural = slugify(input)
  const singular = singularize(plural)
  return {
    plural,
    singular,
    Pascal: pascalCase(singular),
    PascalPlural: pascalCase(plural),
  }
}

function lines(parts: Array<string | false | null | undefined>): string {
  return `${parts.filter((part): part is string => part !== false && part != null).join('\n')}\n`
}

function tsType(type: ScaffoldFieldType): string {
  return type
}

function fieldsTypeLiteral(fields: ScaffoldField[]): string {
  return `{ ${fields.map((f) => `${f.name}: ${tsType(f.type)}`).join('; ')} }`
}

/** ": Type" in TS, "" in JS — for return-type and variable-type annotations. */
function ann(lang: ScaffoldLang, type: string): string {
  return lang === 'ts' ? `: ${type}` : ''
}

/** "expr as Type" in TS, plain "expr" in JS. */
function cast(lang: ScaffoldLang, expr: string, type: string): string {
  return lang === 'ts' ? `${expr} as ${type}` : expr
}

/** "name: Type" in TS, "name" in JS — for a single typed parameter. */
function param(lang: ScaffoldLang, name: string, type: string): string {
  return lang === 'ts' ? `${name}: ${type}` : name
}

/** Database adapters whose model body hand-declares its own return-shape interface (candidates for a types/ file). */
const DB_ADAPTERS_WITH_INTERFACE = new Set(['pg', 'knex', 'typeorm', 'sequelize', 'mongodb', 'none'])

function resourceTypesFile(databaseId: string, names: ResourceNames, fields: ScaffoldField[]): string {
  const interfaceFields = fields.map((f) => `  ${f.name}: ${tsType(f.type)}`)
  const idLine = databaseId === 'mongodb' ? `  _id: unknown` : databaseId === 'knex' || databaseId === 'typeorm' || databaseId === 'sequelize' ? `  id: number` : `  id: string`
  const createdAtLine = databaseId === 'mongodb' ? `  createdAt: Date` : `  createdAt: string`

  return lines([
    `export interface ${names.Pascal} {`,
    idLine,
    ...interfaceFields,
    createdAtLine,
    `}`,
  ])
}

interface FrameworkTemplate {
  importLine: string
  factoryExpr: string
}

const FRAMEWORK_TEMPLATES: Record<string, FrameworkTemplate> = {
  express: { importLine: `import { express } from '@api-kickstart/api-kickstart/express'`, factoryExpr: 'express()' },
  fastify: { importLine: `import { fastify } from '@api-kickstart/api-kickstart/fastify'`, factoryExpr: 'fastify()' },
  hono: { importLine: `import { hono } from '@api-kickstart/api-kickstart/hono'`, factoryExpr: 'hono()' },
  koa: { importLine: `import { koa } from '@api-kickstart/api-kickstart/koa'`, factoryExpr: 'koa()' },
  nest: { importLine: `import { nest } from '@api-kickstart/api-kickstart/nest'`, factoryExpr: 'nest()' },
  http: { importLine: `import { http } from '@api-kickstart/api-kickstart/http'`, factoryExpr: 'http()' },
}

function frameworkTemplate(id: string): FrameworkTemplate {
  return FRAMEWORK_TEMPLATES[id] ?? FRAMEWORK_TEMPLATES.http
}

interface ValidatorTemplate {
  importLine: string
  factoryExpr: string
  schemaImportLine: string
  fieldExpr: (type: ScaffoldFieldType) => string
  objectExpr: (fieldsSrc: string) => string
}

const VALIDATOR_TEMPLATES: Record<string, ValidatorTemplate> = {
  zod: {
    importLine: `import { zod } from '@api-kickstart/api-kickstart/zod'`,
    factoryExpr: 'zod()',
    schemaImportLine: `import { z } from 'zod'`,
    fieldExpr: (type) => ({ string: 'z.string()', number: 'z.number()', boolean: 'z.boolean()' })[type],
    objectExpr: (fieldsSrc) => `z.object({ ${fieldsSrc} })`,
  },
  joi: {
    importLine: `import { joi } from '@api-kickstart/api-kickstart/joi'`,
    factoryExpr: 'joi()',
    schemaImportLine: `import Joi from 'joi'`,
    fieldExpr: (type) =>
      ({ string: 'Joi.string().required()', number: 'Joi.number().required()', boolean: 'Joi.boolean().required()' })[
        type
      ],
    objectExpr: (fieldsSrc) => `Joi.object({ ${fieldsSrc} })`,
  },
  yup: {
    importLine: `import { yup } from '@api-kickstart/api-kickstart/yup'`,
    factoryExpr: 'yup()',
    schemaImportLine: `import * as yup from 'yup'`,
    fieldExpr: (type) =>
      ({
        string: 'yup.string().required()',
        number: 'yup.number().required()',
        boolean: 'yup.boolean().required()',
      })[type],
    objectExpr: (fieldsSrc) => `yup.object({ ${fieldsSrc} })`,
  },
  valibot: {
    importLine: `import { valibot } from '@api-kickstart/api-kickstart/valibot'`,
    factoryExpr: 'valibot()',
    schemaImportLine: `import * as v from 'valibot'`,
    fieldExpr: (type) => ({ string: 'v.string()', number: 'v.number()', boolean: 'v.boolean()' })[type],
    objectExpr: (fieldsSrc) => `v.object({ ${fieldsSrc} })`,
  },
  typebox: {
    importLine: `import { typebox } from '@api-kickstart/api-kickstart/typebox'`,
    factoryExpr: 'typebox()',
    schemaImportLine: `import { Type } from '@sinclair/typebox'`,
    fieldExpr: (type) =>
      ({ string: 'Type.String()', number: 'Type.Number()', boolean: 'Type.Boolean()' })[type],
    objectExpr: (fieldsSrc) => `Type.Object({ ${fieldsSrc} })`,
  },
}

function validatorTemplate(id: string): ValidatorTemplate | null {
  return VALIDATOR_TEMPLATES[id] ?? null
}

function validatorSchemaExpr(validator: ValidatorTemplate, fields: ScaffoldField[]): string {
  const fieldsSrc = fields.map((f) => `${f.name}: ${validator.fieldExpr(f.type)}`).join(', ')
  return validator.objectExpr(fieldsSrc)
}

function databaseConfigFile(id: string): string | null {
  switch (id) {
    case 'pg':
      return lines([
        `import { Pool } from 'pg'`,
        `import { pg } from '@api-kickstart/api-kickstart/pg'`,
        ``,
        `const pool = new Pool({ connectionString: process.env.DATABASE_URL })`,
        ``,
        `export const db = pg(pool)`,
      ])
    case 'knex':
      return lines([
        `// Knex needs its own driver installed too — pick one for your database:`,
        `//   npm install pg              (Postgres)`,
        `//   npm install mysql2          (MySQL)`,
        `//   npm install better-sqlite3  (SQLite)`,
        `import knexClient from 'knex'`,
        `import { knex as knexAdapter } from '@api-kickstart/api-kickstart/knex'`,
        ``,
        `const client = knexClient({`,
        `  client: 'pg',`,
        `  connection: process.env.DATABASE_URL,`,
        `})`,
        ``,
        `export const db = knexAdapter(client)`,
      ])
    case 'mongodb':
      return lines([
        `import { MongoClient } from 'mongodb'`,
        `import { mongodb } from '@api-kickstart/api-kickstart/mongodb'`,
        ``,
        `const client = new MongoClient(process.env.MONGODB_URI ?? 'mongodb://localhost:27017')`,
        `await client.connect()`,
        ``,
        `export const db = mongodb(client, { dbName: process.env.MONGODB_DB ?? 'app' })`,
      ])
    case 'mongoose':
      return lines([
        `import mongooseLib from 'mongoose'`,
        `import { mongoose as mongooseAdapter } from '@api-kickstart/api-kickstart/mongoose'`,
        ``,
        `const connection = mongooseLib.createConnection(`,
        `  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/app',`,
        `)`,
        ``,
        `export const db = mongooseAdapter(connection)`,
      ])
    case 'typeorm':
      return lines([
        `// TypeORM needs a driver for your database too, e.g.:`,
        `//   npm install pg   (Postgres)`,
        `import { DataSource } from 'typeorm'`,
        `import { typeorm } from '@api-kickstart/api-kickstart/typeorm'`,
        ``,
        `const dataSource = new DataSource({`,
        `  type: 'postgres',`,
        `  url: process.env.DATABASE_URL,`,
        `  entities: [],`,
        `  synchronize: false,`,
        `})`,
        `await dataSource.initialize()`,
        ``,
        `export const db = typeorm(dataSource)`,
      ])
    case 'sequelize':
      return lines([
        `// Sequelize needs a dialect driver too, e.g.:`,
        `//   npm install pg pg-hstore   (Postgres)`,
        `import { Sequelize } from 'sequelize'`,
        `import { sequelize as sequelizeAdapter } from '@api-kickstart/api-kickstart/sequelize'`,
        ``,
        `const client = new Sequelize(process.env.DATABASE_URL ?? 'postgres://localhost:5432/app')`,
        ``,
        `export const db = sequelizeAdapter(client)`,
      ])
    case 'drizzle':
      return lines([
        `// This scaffold wires drizzle-orm's node-postgres driver by default — swap the`,
        `// import (drizzle-orm/mysql2, drizzle-orm/better-sqlite3, ...) if you're not on`,
        `// Postgres. Either way, install the underlying driver too, e.g.:`,
        `//   npm install pg`,
        `import { Pool } from 'pg'`,
        `import { drizzle as drizzleClient } from 'drizzle-orm/node-postgres'`,
        `import { drizzle as drizzleAdapter } from '@api-kickstart/api-kickstart/drizzle'`,
        ``,
        `const pool = new Pool({ connectionString: process.env.DATABASE_URL })`,
        `const client = drizzleClient(pool)`,
        ``,
        `export const db = drizzleAdapter(client)`,
      ])
    default:
      return null
  }
}

function authConfigFile(authId: AuthChoice): string | null {
  switch (authId) {
    case 'jwt':
      return lines([
        `import { hashPassword, jwt, verifyPassword } from '@api-kickstart/api-kickstart/auth'`,
        ``,
        `// Replace this in-memory list with a real user lookup (database, etc.) — it's here so`,
        `// the scaffold runs immediately with no setup. Try logging in with admin / admin123.`,
        `const users = [{ id: '1', username: 'admin', role: 'admin', passwordHash: await hashPassword('admin123') }]`,
        ``,
        `export const auth = jwt({`,
        `  secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',`,
        `  resolveUser: async (payload) => {`,
        `    const user = users.find((u) => u.id === String(payload.sub))`,
        `    return user ? { id: user.id, role: user.role, username: user.username } : null`,
        `  },`,
        `  verifyCredentials: async ({ username, password }) => {`,
        `    const user = users.find((u) => u.username === username)`,
        `    if (!user) return null`,
        `    const valid = await verifyPassword(password, user.passwordHash)`,
        `    return valid ? { id: user.id, role: user.role, username: user.username } : null`,
        `  },`,
        `})`,
      ])
    case 'apiKey':
      return lines([
        `import { apiKey } from '@api-kickstart/api-kickstart/auth'`,
        ``,
        `// Replace with a real key store (hashed keys in a database, etc.) — this is here so`,
        `// the scaffold runs immediately with no setup. Try: x-api-key: dev-api-key-change-me`,
        `const validApiKeys = new Map([['dev-api-key-change-me', { id: 'service-1', role: 'service' }]])`,
        ``,
        `export const auth = apiKey({`,
        `  resolve: async (key) => validApiKeys.get(key) ?? null,`,
        `})`,
      ])
    case 'both':
      return lines([
        `import { apiKey, hashPassword, jwt, verifyPassword } from '@api-kickstart/api-kickstart/auth'`,
        ``,
        `// Replace these in-memory lookups with real ones (database, etc.) — they're here so`,
        `// the scaffold runs immediately with no setup.`,
        `const users = [{ id: '1', username: 'admin', role: 'admin', passwordHash: await hashPassword('admin123') }]`,
        `const validApiKeys = new Map([['dev-api-key-change-me', { id: 'service-1', role: 'service' }]])`,
        ``,
        `const jwtAuth = jwt({`,
        `  secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',`,
        `  resolveUser: async (payload) => {`,
        `    const user = users.find((u) => u.id === String(payload.sub))`,
        `    return user ? { id: user.id, role: user.role, username: user.username } : null`,
        `  },`,
        `  verifyCredentials: async ({ username, password }) => {`,
        `    const user = users.find((u) => u.username === username)`,
        `    if (!user) return null`,
        `    const valid = await verifyPassword(password, user.passwordHash)`,
        `    return valid ? { id: user.id, role: user.role, username: user.username } : null`,
        `  },`,
        `})`,
        ``,
        `const apiKeyAuth = apiKey({`,
        `  resolve: async (key) => validApiKeys.get(key) ?? null,`,
        `})`,
        ``,
        `export const auth = [jwtAuth, apiKeyAuth]`,
      ])
    default:
      return null
  }
}

function rolesConfigFile(lang: ScaffoldLang): string {
  return lines([
    lang === 'ts' && `import type { RoleHierarchy } from '@api-kickstart/api-kickstart'`,
    lang === 'ts' && ``,
    `// admin inherits editor's access, editor inherits viewer's — adjust to match your app's roles.`,
    `export const roleHierarchy${ann(lang, 'RoleHierarchy')} = {`,
    `  admin: ['editor'],`,
    `  editor: ['viewer'],`,
    `}`,
  ])
}

function i18nConfigFile(): string {
  return lines([
    `import { createI18n } from '@api-kickstart/api-kickstart/i18n'`,
    ``,
    `export const i18n = createI18n({`,
    `  locales: ['en', 'id'],`,
    `  defaultLocale: 'en',`,
    `  dictionaries: {`,
    `    en: { welcome: 'Welcome, {name}!' },`,
    `    id: { welcome: 'Selamat datang, {name}!' },`,
    `  },`,
    `})`,
    ``,
    `// Usage: i18n.t('welcome', { name: 'World' }) — resolves against the request's detected locale.`,
  ])
}

function lockConfigFile(databaseId: string, lang: ScaffoldLang): string {
  const isTs = lang === 'ts'
  switch (databaseId) {
    case 'pg':
      return lines([
        isTs && `import type { Pool } from 'pg'`,
        `import { pgLock } from '@api-kickstart/api-kickstart/pg'`,
        `import { db } from './database.js'`,
        ``,
        `export const lock = pgLock(${cast(lang, 'db.client', 'Pool')})`,
      ])
    case 'knex':
      return lines([
        isTs && `import type { Knex } from 'knex'`,
        `import { knexLock } from '@api-kickstart/api-kickstart/knex'`,
        `import { db } from './database.js'`,
        ``,
        `export const lock = knexLock(${cast(lang, 'db.client', 'Knex')})`,
      ])
    case 'mongodb':
      return lines([
        isTs && `import type { Db } from 'mongodb'`,
        `import { mongodbLock } from '@api-kickstart/api-kickstart/mongodb'`,
        `import { db } from './database.js'`,
        ``,
        `export const lock = mongodbLock(${cast(lang, 'db.client', 'Db')})`,
      ])
    default:
      return lines([
        `import { memoryLock } from '@api-kickstart/api-kickstart/memory'`,
        ``,
        `// Single-process lock — good for local dev or a single-instance deployment.`,
        `// Swap for pgLock/knexLock/mongodbLock/redisLock if you run more than one instance.`,
        `export const lock = memoryLock()`,
      ])
  }
}

interface SecurityMiddlewareTemplate {
  importName: string
  factoryExpr: string
}

const SECURITY_MIDDLEWARE_TEMPLATES: Record<SecurityMiddlewareId, SecurityMiddlewareTemplate> = {
  requestId: { importName: 'requestId', factoryExpr: 'requestId()' },
  logger: { importName: 'logger', factoryExpr: 'logger()' },
  helmet: { importName: 'helmet', factoryExpr: 'helmet()' },
  compression: { importName: 'compression', factoryExpr: 'compression()' },
  rateLimit: { importName: 'rateLimit', factoryExpr: `rateLimit({ window: '1m', max: 100 })` },
  bodyLimit: { importName: 'bodyLimit', factoryExpr: `bodyLimit({ maxBytes: 1_000_000 })` },
  timeout: { importName: 'timeout', factoryExpr: `timeout({ duration: '30s' })` },
  idempotency: { importName: 'idempotency', factoryExpr: 'idempotency()' },
  csrf: { importName: 'csrf', factoryExpr: 'csrf()' },
}

function drizzleColumnExpr(field: ScaffoldField): string {
  switch (field.type) {
    case 'number':
      return `integer('${field.name}').notNull()`
    case 'boolean':
      return `boolean('${field.name}').notNull()`
    default:
      return `text('${field.name}').notNull()`
  }
}

function dbModelBody(
  id: string,
  names: ResourceNames,
  dbImportPath: string,
  fields: ScaffoldField[],
  lang: ScaffoldLang,
  typesImportPath: string,
): string {
  const { plural, Pascal, PascalPlural } = names
  const fieldNames = fields.map((f) => f.name)
  const dataType = fieldsTypeLiteral(fields)
  const isTs = lang === 'ts'
  const hasTypesFile = isTs && DB_ADAPTERS_WITH_INTERFACE.has(id)
  const typeImportLine = hasTypesFile && `import type { ${Pascal} } from '${typesImportPath}'`

  switch (id) {
    case 'pg':
    case 'typeorm': {
      const placeholders = fieldNames.map((_, i) => `$${i + 1}`).join(', ')
      const columns = fieldNames.join(', ')
      const returning = `id, ${columns}, created_at AS "createdAt"`
      const values = fieldNames.map((n) => `data.${n}`).join(', ')
      const isPg = id === 'pg'
      const clientTypeLine = isPg ? `import type { Pool } from 'pg'` : `import type { DataSource } from 'typeorm'`
      const clientCast = isPg ? cast(lang, 'db.client', 'Pool') : cast(lang, 'db.client', 'DataSource')
      const runnerName = isPg ? 'pool' : 'dataSource'
      const listStmt = isPg
        ? `const { rows } = await pool().query(\n    'SELECT id, ${columns}, created_at AS "createdAt" FROM ${plural} ORDER BY created_at DESC',\n  )\n  return rows`
        : `return dataSource().query('SELECT id, ${columns}, created_at AS "createdAt" FROM ${plural} ORDER BY created_at DESC')`
      const createStmt = isPg
        ? `const { rows } = await pool().query(\n    'INSERT INTO ${plural} (${columns}) VALUES (${placeholders}) RETURNING ${returning}',\n    [${values}],\n  )\n  return rows[0]`
        : `const rows = await dataSource().query(\n    'INSERT INTO ${plural} (${columns}) VALUES (${placeholders}) RETURNING ${returning}',\n    [${values}],\n  )\n  return rows[0]`

      return lines([
        isTs && clientTypeLine,
        typeImportLine,
        `import { db } from '${dbImportPath}'`,
        ``,
        `const ${runnerName} = () => ${clientCast}`,
        ``,
        `export async function list${PascalPlural}()${ann(lang, `Promise<${Pascal}[]>`)} {`,
        `  ${listStmt}`,
        `}`,
        ``,
        `export async function create${Pascal}(${param(lang, 'data', dataType)})${ann(lang, `Promise<${Pascal}>`)} {`,
        `  ${createStmt}`,
        `}`,
      ])
    }
    case 'knex': {
      const selectCols = ['id', ...fieldNames, 'created_at as createdAt'].map((c) => `'${c}'`).join(', ')
      const returnCols = `['id', ${fieldNames.map((n) => `'${n}'`).join(', ')}, 'created_at as createdAt']`
      return lines([
        isTs && `import type { Knex } from 'knex'`,
        typeImportLine,
        `import { db } from '${dbImportPath}'`,
        ``,
        `const table = () => (${cast(lang, 'db.client', 'Knex')})('${plural}')`,
        ``,
        `export async function list${PascalPlural}()${ann(lang, `Promise<${Pascal}[]>`)} {`,
        `  return table().select(${selectCols}).orderBy('created_at', 'desc')`,
        `}`,
        ``,
        `export async function create${Pascal}(${param(lang, 'data', dataType)})${ann(lang, `Promise<${Pascal}>`)} {`,
        `  const [row] = await table().insert(data).returning(${returnCols})`,
        `  return row`,
        `}`,
      ])
    }
    case 'mongodb':
      return lines([
        isTs && `import type { Db } from 'mongodb'`,
        typeImportLine,
        `import { db } from '${dbImportPath}'`,
        ``,
        `const collection = () => (${cast(lang, 'db.client', 'Db')}).collection('${plural}')`,
        ``,
        `export async function list${PascalPlural}()${ann(lang, `Promise<${Pascal}[]>`)} {`,
        `  const docs = await collection().find().sort({ createdAt: -1 }).toArray()`,
        `  return ${isTs ? `docs as unknown as ${Pascal}[]` : 'docs'}`,
        `}`,
        ``,
        `export async function create${Pascal}(${param(lang, 'data', dataType)})${ann(lang, `Promise<${Pascal}>`)} {`,
        `  const doc = { ...data, createdAt: new Date() }`,
        `  const { insertedId } = await collection().insertOne(doc)`,
        `  return { _id: insertedId, ...doc }`,
        `}`,
      ])
    case 'mongoose': {
      const mongooseTypeOf: Record<ScaffoldFieldType, string> = { string: 'String', number: 'Number', boolean: 'Boolean' }
      const schemaFields = fields.map((f) => `  ${f.name}: { type: ${mongooseTypeOf[f.type]}, required: true },`)
      return lines([
        isTs ? `import { Schema, type Connection } from 'mongoose'` : `import { Schema } from 'mongoose'`,
        `import { db } from '${dbImportPath}'`,
        ``,
        `const ${names.singular}Schema = new Schema({`,
        ...schemaFields,
        `  createdAt: { type: Date, default: Date.now },`,
        `})`,
        ``,
        `const ${Pascal}Model = (${cast(lang, 'db.client', 'Connection')}).model('${Pascal}', ${names.singular}Schema)`,
        ``,
        `export async function list${PascalPlural}() {`,
        `  return ${Pascal}Model.find().sort({ createdAt: -1 })`,
        `}`,
        ``,
        `export async function create${Pascal}(${param(lang, 'data', dataType)}) {`,
        `  return ${Pascal}Model.create(data)`,
        `}`,
      ])
    }
    case 'sequelize': {
      const columns = fieldNames.join(', ')
      const namedPlaceholders = fieldNames.map((n) => `:${n}`).join(', ')
      const returning = `id, ${columns}, created_at AS "createdAt"`
      const genericArg = isTs ? `<${Pascal}>` : ''
      return lines([
        isTs ? `import { QueryTypes, type Sequelize } from 'sequelize'` : `import { QueryTypes } from 'sequelize'`,
        typeImportLine,
        `import { db } from '${dbImportPath}'`,
        ``,
        `const client = () => ${cast(lang, 'db.client', 'Sequelize')}`,
        ``,
        `export async function list${PascalPlural}()${ann(lang, `Promise<${Pascal}[]>`)} {`,
        `  return client().query${genericArg}(`,
        `    'SELECT id, ${columns}, created_at AS "createdAt" FROM ${plural} ORDER BY created_at DESC',`,
        `    { type: QueryTypes.SELECT },`,
        `  )`,
        `}`,
        ``,
        `export async function create${Pascal}(${param(lang, 'data', dataType)})${ann(lang, `Promise<${Pascal}>`)} {`,
        `  const rows = await client().query${genericArg}(`,
        `    'INSERT INTO ${plural} (${columns}) VALUES (${namedPlaceholders}) RETURNING ${returning}',`,
        `    { replacements: data, type: QueryTypes.SELECT },`,
        `  )`,
        `  return rows[0]`,
        `}`,
      ])
    }
    case 'drizzle': {
      const usesInteger = fields.some((f) => f.type === 'number')
      const usesBoolean = fields.some((f) => f.type === 'boolean')
      const usesText = fields.some((f) => f.type === 'string') || fields.length === 0
      const coreImports = ['pgTable', 'serial', 'timestamp']
      if (usesText) coreImports.push('text')
      if (usesInteger) coreImports.push('integer')
      if (usesBoolean) coreImports.push('boolean')
      const tableFields = fields.map((f) => `  ${f.name}: ${drizzleColumnExpr(f)},`)
      return lines([
        `import { desc } from 'drizzle-orm'`,
        `import { ${coreImports.join(', ')} } from 'drizzle-orm/pg-core'`,
        isTs && `import type { NodePgDatabase } from 'drizzle-orm/node-postgres'`,
        `import { db } from '${dbImportPath}'`,
        ``,
        `export const ${plural}Table = pgTable('${plural}', {`,
        `  id: serial('id').primaryKey(),`,
        ...tableFields,
        `  createdAt: timestamp('created_at').defaultNow(),`,
        `})`,
        ``,
        `const client = () => ${cast(lang, 'db.client', 'NodePgDatabase')}`,
        ``,
        `export async function list${PascalPlural}() {`,
        `  return client().select().from(${plural}Table).orderBy(desc(${plural}Table.createdAt))`,
        `}`,
        ``,
        `export async function create${Pascal}(${param(lang, 'data', dataType)}) {`,
        `  const [row] = await client().insert(${plural}Table).values(data).returning()`,
        `  return row`,
        `}`,
      ])
    }
    default:
      return lines([
        typeImportLine,
        ``,
        `let seq = 0`,
        `const store = new Map${isTs ? `<string, ${Pascal}>` : ''}()`,
        ``,
        `export async function list${PascalPlural}()${ann(lang, `Promise<${Pascal}[]>`)} {`,
        `  return [...store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))`,
        `}`,
        ``,
        `export async function create${Pascal}(${param(lang, 'data', dataType)})${ann(lang, `Promise<${Pascal}>`)} {`,
        `  seq += 1`,
        `  const record${ann(lang, Pascal)} = { id: String(seq), ...data, createdAt: new Date().toISOString() }`,
        `  store.set(record.id, record)`,
        `  return record`,
        `}`,
      ])
  }
}

function serviceBody(names: ResourceNames, modelImportPath: string, fields: ScaffoldField[], lang: ScaffoldLang): string {
  const { Pascal, PascalPlural } = names
  const dataType = fieldsTypeLiteral(fields)
  return lines([
    `import { create${Pascal}, list${PascalPlural} } from '${modelImportPath}'`,
    ``,
    `export async function getAll${PascalPlural}() {`,
    `  return list${PascalPlural}()`,
    `}`,
    ``,
    `export async function add${Pascal}(${param(lang, 'data', dataType)}) {`,
    `  return create${Pascal}(data)`,
    `}`,
  ])
}

function controllerBody(
  names: ResourceNames,
  serviceImportPath: string,
  fields: ScaffoldField[],
  lang: ScaffoldLang,
): string {
  const { Pascal, PascalPlural } = names
  const dataType = fieldsTypeLiteral(fields)
  const isTs = lang === 'ts'
  return lines([
    isTs && `import type { Context } from '@api-kickstart/api-kickstart'`,
    `import { add${Pascal}, getAll${PascalPlural} } from '${serviceImportPath}'`,
    ``,
    `export async function list${PascalPlural}Handler(${param(lang, '_ctx', 'Context')}) {`,
    `  return getAll${PascalPlural}()`,
    `}`,
    ``,
    `export async function create${Pascal}Handler(${param(lang, 'ctx', 'Context')}) {`,
    `  const body = ${isTs ? `ctx.body as ${dataType}` : 'ctx.body'}`,
    `  return add${Pascal}(body)`,
    `}`,
  ])
}

function routesBody(
  names: ResourceNames,
  validatorId: string,
  appImportPath: string,
  controllerImportPath: string,
  fields: ScaffoldField[],
  authorization: boolean,
): string {
  const { plural, Pascal, PascalPlural } = names
  const validator = validatorTemplate(validatorId)
  const schemaConst = `create${Pascal}Schema`

  return lines([
    validator && validator.schemaImportLine,
    `import { app } from '${appImportPath}'`,
    `import { create${Pascal}Handler, list${PascalPlural}Handler } from '${controllerImportPath}'`,
    ``,
    validator && `const ${schemaConst} = ${validatorSchemaExpr(validator, fields)}`,
    validator && ``,
    `app.route({`,
    `  method: 'GET',`,
    `  path: '/${plural}',`,
    `  auth: false,`,
    `  handler: list${PascalPlural}Handler,`,
    `})`,
    ``,
    `app.route({`,
    `  method: 'POST',`,
    `  path: '/${plural}',`,
    authorization ? `  auth: true,` : `  auth: false,`,
    authorization && `  roles: ['admin', 'editor'],`,
    validator && `  body: ${schemaConst},`,
    `  handler: create${Pascal}Handler,`,
    `})`,
  ])
}

function requestTimerMiddlewareFile(lang: ScaffoldLang): string {
  return lines([
    lang === 'ts' && `import type { Middleware } from '@api-kickstart/api-kickstart'`,
    lang === 'ts' && ``,
    `export const requestTimer${ann(lang, 'Middleware')} = async (ctx, next) => {`,
    `  const start = Date.now()`,
    `  await next()`,
    `  ctx.logger.info({ requestId: ctx.requestId, method: ctx.method, path: ctx.path, ms: Date.now() - start })`,
    `}`,
  ])
}

const SECURITY_MIDDLEWARE_ORDER: SecurityMiddlewareId[] = [
  'requestId',
  'logger',
  'helmet',
  'compression',
  'rateLimit',
  'bodyLimit',
  'timeout',
  'idempotency',
  'csrf',
]

const OPS_ENDPOINT_ORDER: OpsEndpoint[] = ['health', 'metrics', 'openapi']

function opsEndpointStmt(id: OpsEndpoint): string {
  switch (id) {
    case 'health':
      return `app.health()`
    case 'metrics':
      return `app.metrics()`
    default:
      return lines([
        `app.openapi({`,
        `  info: { title: 'API', version: '1.0.0' },`,
        `  json: '/openapi.json',`,
        `  serve: '/docs',`,
        `})`,
      ]).trimEnd()
  }
}

function appFile(choice: ScaffoldChoice): string {
  const framework = frameworkTemplate(choice.frameworkId)
  const validator = validatorTemplate(choice.validatorId)
  const hasDb = choice.databaseId !== 'none' && databaseConfigFile(choice.databaseId) !== null
  const hasAuth = choice.authId !== 'none'
  const includesJwt = choice.authId === 'jwt' || choice.authId === 'both'
  const security = SECURITY_MIDDLEWARE_ORDER.filter((id) => choice.securityMiddleware.includes(id))
  const middlewareList = [
    'requestTimer',
    ...security.map((id) => SECURITY_MIDDLEWARE_TEMPLATES[id].factoryExpr),
    ...(choice.i18n ? ['i18n.middleware'] : []),
  ].join(', ')
  const ops = OPS_ENDPOINT_ORDER.filter((id) => choice.opsEndpoints.includes(id))

  return lines([
    `import { createApp } from '@api-kickstart/api-kickstart'`,
    framework.importLine,
    validator && validator.importLine,
    hasDb && `import { db } from './config/database.js'`,
    `import { requestTimer } from './middleware/requestTimer.middleware.js'`,
    security.length > 0 &&
      `import { ${security.map((id) => SECURITY_MIDDLEWARE_TEMPLATES[id].importName).join(', ')} } from '@api-kickstart/api-kickstart/middleware'`,
    hasAuth && `import { auth } from './config/auth.js'`,
    choice.authorization && `import { roleHierarchy } from './config/roles.js'`,
    choice.i18n && `import { i18n } from './config/i18n.js'`,
    choice.productionEssentials && `import { lock } from './config/lock.js'`,
    ``,
    `export const app = createApp({`,
    `  framework: ${framework.factoryExpr},`,
    validator && `  validator: ${validator.factoryExpr},`,
    hasDb && `  db,`,
    hasAuth && `  auth,`,
    choice.authorization && `  roleHierarchy,`,
    `  middleware: [${middlewareList}],`,
    `})`,
    ops.length > 0 && ``,
    ...ops.map((id) => opsEndpointStmt(id)),
    includesJwt && ``,
    includesJwt &&
      `app.useAuthRoutes({ login: '/auth/login', refresh: '/auth/refresh', logout: '/auth/logout', me: '/auth/me' })`,
    choice.productionEssentials && ``,
    choice.productionEssentials && `app.schedule('example-job', { interval: '5m', lock }, async () => {`,
    choice.productionEssentials && `  console.log('running example-job')`,
    choice.productionEssentials && `})`,
  ])
}

function envFile(): string {
  return lines([
    `export const env = {`,
    `  port: Number(process.env.PORT ?? 3000),`,
    `  nodeEnv: process.env.NODE_ENV ?? 'development',`,
    `}`,
  ])
}

function indexFile(routesBarrelPath: string, productionEssentials: boolean): string {
  return lines([
    `import { env } from './config/env.js'`,
    `import { app } from './app.js'`,
    productionEssentials && `import { gracefulShutdown } from '@api-kickstart/api-kickstart'`,
    `import '${routesBarrelPath}'`,
    ``,
    `app.listen(env.port, () => {`,
    `  console.log(\`Server listening on http://localhost:\${env.port}\`)`,
    `})`,
    productionEssentials && ``,
    productionEssentials && `gracefulShutdown(app)`,
  ])
}

interface ResolvedResource {
  names: ResourceNames
  fields: ScaffoldField[]
}

function uniqueResources(resources: ScaffoldResource[]): ResolvedResource[] {
  const byPlural = new Map<string, ResolvedResource>()
  const list = resources.length > 0 ? resources : [{ input: 'users', fields: parseFields('') }]
  for (const resource of list) {
    const names = resourceNames(resource.input)
    if (!byPlural.has(names.plural)) {
      byPlural.set(names.plural, { names, fields: resource.fields })
    }
  }
  return [...byPlural.values()]
}

function generateLayered(choice: ScaffoldChoice): ScaffoldFile[] {
  const files: ScaffoldFile[] = []
  const resources = uniqueResources(choice.resources)
  const lang = choice.language
  const ext = lang === 'ts' ? 'ts' : 'js'

  files.push({ path: `src/config/env.${ext}`, contents: envFile() })

  const dbConfig = databaseConfigFile(choice.databaseId)
  if (dbConfig) {
    files.push({ path: `src/config/database.${ext}`, contents: dbConfig })
  }

  const authConfig = authConfigFile(choice.authId)
  if (authConfig) {
    files.push({ path: `src/config/auth.${ext}`, contents: authConfig })
  }
  if (choice.authorization) {
    files.push({ path: `src/config/roles.${ext}`, contents: rolesConfigFile(lang) })
  }
  if (choice.i18n) {
    files.push({ path: `src/config/i18n.${ext}`, contents: i18nConfigFile() })
  }
  if (choice.productionEssentials) {
    files.push({ path: `src/config/lock.${ext}`, contents: lockConfigFile(choice.databaseId, lang) })
  }

  files.push({
    path: `src/middleware/requestTimer.middleware.${ext}`,
    contents: requestTimerMiddlewareFile(lang),
  })

  for (const { names, fields } of resources) {
    if (lang === 'ts' && DB_ADAPTERS_WITH_INTERFACE.has(choice.databaseId)) {
      files.push({
        path: `src/types/${names.plural}.types.ts`,
        contents: resourceTypesFile(choice.databaseId, names, fields),
      })
    }
    files.push({
      path: `src/models/${names.plural}.model.${ext}`,
      contents: dbModelBody(choice.databaseId, names, '../config/database.js', fields, lang, `../types/${names.plural}.types.js`),
    })
    files.push({
      path: `src/services/${names.plural}.service.${ext}`,
      contents: serviceBody(names, `../models/${names.plural}.model.js`, fields, lang),
    })
    files.push({
      path: `src/controllers/${names.plural}.controller.${ext}`,
      contents: controllerBody(names, `../services/${names.plural}.service.js`, fields, lang),
    })
    files.push({
      path: `src/routes/${names.plural}.routes.${ext}`,
      contents: routesBody(
        names,
        choice.validatorId,
        '../app.js',
        `../controllers/${names.plural}.controller.js`,
        fields,
        choice.authorization,
      ),
    })
  }

  files.push({
    path: `src/routes/index.${ext}`,
    contents: lines(resources.map(({ names }) => `import './${names.plural}.routes.js'`)),
  })
  files.push({ path: `src/app.${ext}`, contents: appFile(choice) })
  files.push({
    path: `src/index.${ext}`,
    contents: indexFile('./routes/index.js', choice.productionEssentials),
  })

  return files
}

function generateModular(choice: ScaffoldChoice): ScaffoldFile[] {
  const files: ScaffoldFile[] = []
  const resources = uniqueResources(choice.resources)
  const lang = choice.language
  const ext = lang === 'ts' ? 'ts' : 'js'

  files.push({ path: `src/config/env.${ext}`, contents: envFile() })

  const dbConfig = databaseConfigFile(choice.databaseId)
  if (dbConfig) {
    files.push({ path: `src/config/database.${ext}`, contents: dbConfig })
  }

  const authConfig = authConfigFile(choice.authId)
  if (authConfig) {
    files.push({ path: `src/config/auth.${ext}`, contents: authConfig })
  }
  if (choice.authorization) {
    files.push({ path: `src/config/roles.${ext}`, contents: rolesConfigFile(lang) })
  }
  if (choice.i18n) {
    files.push({ path: `src/config/i18n.${ext}`, contents: i18nConfigFile() })
  }
  if (choice.productionEssentials) {
    files.push({ path: `src/config/lock.${ext}`, contents: lockConfigFile(choice.databaseId, lang) })
  }

  files.push({
    path: `src/middleware/requestTimer.middleware.${ext}`,
    contents: requestTimerMiddlewareFile(lang),
  })

  for (const { names, fields } of resources) {
    const moduleDir = `src/modules/${names.plural}`
    if (lang === 'ts' && DB_ADAPTERS_WITH_INTERFACE.has(choice.databaseId)) {
      files.push({
        path: `${moduleDir}/${names.plural}.types.ts`,
        contents: resourceTypesFile(choice.databaseId, names, fields),
      })
    }
    files.push({
      path: `${moduleDir}/${names.plural}.model.${ext}`,
      contents: dbModelBody(choice.databaseId, names, '../../config/database.js', fields, lang, `./${names.plural}.types.js`),
    })
    files.push({
      path: `${moduleDir}/${names.plural}.service.${ext}`,
      contents: serviceBody(names, `./${names.plural}.model.js`, fields, lang),
    })
    files.push({
      path: `${moduleDir}/${names.plural}.controller.${ext}`,
      contents: controllerBody(names, `./${names.plural}.service.js`, fields, lang),
    })
    files.push({
      path: `${moduleDir}/${names.plural}.routes.${ext}`,
      contents: routesBody(
        names,
        choice.validatorId,
        '../../app.js',
        `./${names.plural}.controller.js`,
        fields,
        choice.authorization,
      ),
    })
  }

  files.push({
    path: `src/modules/index.${ext}`,
    contents: lines(resources.map(({ names }) => `import './${names.plural}/${names.plural}.routes.js'`)),
  })
  files.push({ path: `src/app.${ext}`, contents: appFile(choice) })
  files.push({
    path: `src/index.${ext}`,
    contents: indexFile('./modules/index.js', choice.productionEssentials),
  })

  return files
}

export const PROJECT_THEMES: ProjectTheme[] = [
  {
    id: 'layered',
    label: 'Layered (config/, models/, services/, controllers/, routes/ — grouped by type)',
    description: 'Classic layered structure: one folder per concern, one file per resource inside each.',
    generate: generateLayered,
  },
  {
    id: 'modular',
    label: 'Modular by feature (modules/<resource>/ — model, service, controller, routes together)',
    description: 'Feature-first structure: everything for one resource lives in its own folder.',
    generate: generateModular,
  },
]

export function findTheme(id: string): ProjectTheme | undefined {
  return PROJECT_THEMES.find((theme) => theme.id === id)
}
