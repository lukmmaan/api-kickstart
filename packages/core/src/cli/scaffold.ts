export interface ScaffoldFile {
  path: string
  contents: string
}

export interface ScaffoldChoice {
  frameworkId: string
  databaseId: string
  validatorId: string
  /** Free-text resource name as typed by the user, e.g. "posts". */
  resource: string
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
  return `${parts.filter((part): part is string => Boolean(part)).join('\n')}\n`
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
  schemaDecl: (constName: string) => string
}

const VALIDATOR_TEMPLATES: Record<string, ValidatorTemplate> = {
  zod: {
    importLine: `import { zod } from '@api-kickstart/api-kickstart/zod'`,
    factoryExpr: 'zod()',
    schemaImportLine: `import { z } from 'zod'`,
    schemaDecl: (constName) => `const ${constName} = z.object({ title: z.string().min(1) })`,
  },
  joi: {
    importLine: `import { joi } from '@api-kickstart/api-kickstart/joi'`,
    factoryExpr: 'joi()',
    schemaImportLine: `import Joi from 'joi'`,
    schemaDecl: (constName) => `const ${constName} = Joi.object({ title: Joi.string().min(1).required() })`,
  },
  yup: {
    importLine: `import { yup } from '@api-kickstart/api-kickstart/yup'`,
    factoryExpr: 'yup()',
    schemaImportLine: `import * as yup from 'yup'`,
    schemaDecl: (constName) => `const ${constName} = yup.object({ title: yup.string().min(1).required() })`,
  },
  valibot: {
    importLine: `import { valibot } from '@api-kickstart/api-kickstart/valibot'`,
    factoryExpr: 'valibot()',
    schemaImportLine: `import * as v from 'valibot'`,
    schemaDecl: (constName) => `const ${constName} = v.object({ title: v.pipe(v.string(), v.minLength(1)) })`,
  },
  typebox: {
    importLine: `import { typebox } from '@api-kickstart/api-kickstart/typebox'`,
    factoryExpr: 'typebox()',
    schemaImportLine: `import { Type } from '@sinclair/typebox'`,
    schemaDecl: (constName) => `const ${constName} = Type.Object({ title: Type.String({ minLength: 1 }) })`,
  },
}

function validatorTemplate(id: string): ValidatorTemplate | null {
  return VALIDATOR_TEMPLATES[id] ?? null
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

function dbModelBody(id: string, names: ResourceNames, dbImportPath: string): string {
  const { plural, Pascal, PascalPlural } = names

  switch (id) {
    case 'pg':
      return lines([
        `import type { Pool } from 'pg'`,
        `import { db } from '${dbImportPath}'`,
        ``,
        `export interface ${Pascal} {`,
        `  id: string`,
        `  title: string`,
        `  createdAt: string`,
        `}`,
        ``,
        `const pool = () => db.client as Pool`,
        ``,
        `export async function list${PascalPlural}(): Promise<${Pascal}[]> {`,
        `  const { rows } = await pool().query(`,
        `    'SELECT id, title, created_at AS "createdAt" FROM ${plural} ORDER BY created_at DESC',`,
        `  )`,
        `  return rows`,
        `}`,
        ``,
        `export async function create${Pascal}(title: string): Promise<${Pascal}> {`,
        `  const { rows } = await pool().query(`,
        `    'INSERT INTO ${plural} (title) VALUES ($1) RETURNING id, title, created_at AS "createdAt"',`,
        `    [title],`,
        `  )`,
        `  return rows[0]`,
        `}`,
      ])
    case 'knex':
      return lines([
        `import type { Knex } from 'knex'`,
        `import { db } from '${dbImportPath}'`,
        ``,
        `export interface ${Pascal} {`,
        `  id: number`,
        `  title: string`,
        `  createdAt: string`,
        `}`,
        ``,
        `const table = () => (db.client as Knex)('${plural}')`,
        ``,
        `export async function list${PascalPlural}(): Promise<${Pascal}[]> {`,
        `  return table().select('id', 'title', 'created_at as createdAt').orderBy('created_at', 'desc')`,
        `}`,
        ``,
        `export async function create${Pascal}(title: string): Promise<${Pascal}> {`,
        `  const [row] = await table().insert({ title }).returning(['id', 'title', 'created_at as createdAt'])`,
        `  return row`,
        `}`,
      ])
    case 'mongodb':
      return lines([
        `import type { Db } from 'mongodb'`,
        `import { db } from '${dbImportPath}'`,
        ``,
        `export interface ${Pascal} {`,
        `  _id: unknown`,
        `  title: string`,
        `  createdAt: Date`,
        `}`,
        ``,
        `const collection = () => (db.client as Db).collection('${plural}')`,
        ``,
        `export async function list${PascalPlural}(): Promise<${Pascal}[]> {`,
        `  const docs = await collection().find().sort({ createdAt: -1 }).toArray()`,
        `  return docs as unknown as ${Pascal}[]`,
        `}`,
        ``,
        `export async function create${Pascal}(title: string): Promise<${Pascal}> {`,
        `  const doc = { title, createdAt: new Date() }`,
        `  const { insertedId } = await collection().insertOne(doc)`,
        `  return { _id: insertedId, ...doc }`,
        `}`,
      ])
    case 'mongoose':
      return lines([
        `import { Schema, type Connection } from 'mongoose'`,
        `import { db } from '${dbImportPath}'`,
        ``,
        `const ${names.singular}Schema = new Schema({`,
        `  title: { type: String, required: true },`,
        `  createdAt: { type: Date, default: Date.now },`,
        `})`,
        ``,
        `const ${Pascal}Model = (db.client as Connection).model('${Pascal}', ${names.singular}Schema)`,
        ``,
        `export async function list${PascalPlural}() {`,
        `  return ${Pascal}Model.find().sort({ createdAt: -1 })`,
        `}`,
        ``,
        `export async function create${Pascal}(title: string) {`,
        `  return ${Pascal}Model.create({ title })`,
        `}`,
      ])
    case 'typeorm':
      return lines([
        `import type { DataSource } from 'typeorm'`,
        `import { db } from '${dbImportPath}'`,
        ``,
        `export interface ${Pascal} {`,
        `  id: number`,
        `  title: string`,
        `  createdAt: string`,
        `}`,
        ``,
        `const dataSource = () => db.client as DataSource`,
        ``,
        `export async function list${PascalPlural}(): Promise<${Pascal}[]> {`,
        `  return dataSource().query('SELECT id, title, created_at AS "createdAt" FROM ${plural} ORDER BY created_at DESC')`,
        `}`,
        ``,
        `export async function create${Pascal}(title: string): Promise<${Pascal}> {`,
        `  const rows = await dataSource().query(`,
        `    'INSERT INTO ${plural} (title) VALUES ($1) RETURNING id, title, created_at AS "createdAt"',`,
        `    [title],`,
        `  )`,
        `  return rows[0]`,
        `}`,
      ])
    case 'sequelize':
      return lines([
        `import { QueryTypes, type Sequelize } from 'sequelize'`,
        `import { db } from '${dbImportPath}'`,
        ``,
        `export interface ${Pascal} {`,
        `  id: number`,
        `  title: string`,
        `  createdAt: string`,
        `}`,
        ``,
        `const client = () => db.client as Sequelize`,
        ``,
        `export async function list${PascalPlural}(): Promise<${Pascal}[]> {`,
        `  return client().query<${Pascal}>(`,
        `    'SELECT id, title, created_at AS "createdAt" FROM ${plural} ORDER BY created_at DESC',`,
        `    { type: QueryTypes.SELECT },`,
        `  )`,
        `}`,
        ``,
        `export async function create${Pascal}(title: string): Promise<${Pascal}> {`,
        `  const rows = await client().query<${Pascal}>(`,
        `    'INSERT INTO ${plural} (title) VALUES (:title) RETURNING id, title, created_at AS "createdAt"',`,
        `    { replacements: { title }, type: QueryTypes.SELECT },`,
        `  )`,
        `  return rows[0]`,
        `}`,
      ])
    case 'drizzle':
      return lines([
        `import { desc } from 'drizzle-orm'`,
        `import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'`,
        `import type { NodePgDatabase } from 'drizzle-orm/node-postgres'`,
        `import { db } from '${dbImportPath}'`,
        ``,
        `export const ${plural}Table = pgTable('${plural}', {`,
        `  id: serial('id').primaryKey(),`,
        `  title: text('title').notNull(),`,
        `  createdAt: timestamp('created_at').defaultNow(),`,
        `})`,
        ``,
        `const client = () => db.client as NodePgDatabase`,
        ``,
        `export async function list${PascalPlural}() {`,
        `  return client().select().from(${plural}Table).orderBy(desc(${plural}Table.createdAt))`,
        `}`,
        ``,
        `export async function create${Pascal}(title: string) {`,
        `  const [row] = await client().insert(${plural}Table).values({ title }).returning()`,
        `  return row`,
        `}`,
      ])
    default:
      return lines([
        `export interface ${Pascal} {`,
        `  id: string`,
        `  title: string`,
        `  createdAt: string`,
        `}`,
        ``,
        `let seq = 0`,
        `const store = new Map<string, ${Pascal}>()`,
        ``,
        `export async function list${PascalPlural}(): Promise<${Pascal}[]> {`,
        `  return [...store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))`,
        `}`,
        ``,
        `export async function create${Pascal}(title: string): Promise<${Pascal}> {`,
        `  seq += 1`,
        `  const record: ${Pascal} = { id: String(seq), title, createdAt: new Date().toISOString() }`,
        `  store.set(record.id, record)`,
        `  return record`,
        `}`,
      ])
  }
}

function serviceBody(names: ResourceNames, modelImportPath: string): string {
  const { Pascal, PascalPlural } = names
  return lines([
    `import { create${Pascal}, list${PascalPlural} } from '${modelImportPath}'`,
    ``,
    `export async function getAll${PascalPlural}() {`,
    `  return list${PascalPlural}()`,
    `}`,
    ``,
    `export async function add${Pascal}(title: string) {`,
    `  if (!title || !title.trim()) {`,
    `    throw new Error('title is required')`,
    `  }`,
    `  return create${Pascal}(title.trim())`,
    `}`,
  ])
}

function controllerBody(names: ResourceNames, serviceImportPath: string): string {
  const { Pascal, PascalPlural } = names
  return lines([
    `import type { Context } from '@api-kickstart/api-kickstart'`,
    `import { add${Pascal}, getAll${PascalPlural} } from '${serviceImportPath}'`,
    ``,
    `export async function list${PascalPlural}Handler(_ctx: Context) {`,
    `  return getAll${PascalPlural}()`,
    `}`,
    ``,
    `export async function create${Pascal}Handler(ctx: Context) {`,
    `  const body = ctx.body as { title: string }`,
    `  return add${Pascal}(body.title)`,
    `}`,
  ])
}

function routesBody(
  names: ResourceNames,
  validatorId: string,
  appImportPath: string,
  controllerImportPath: string,
): string {
  const { plural, Pascal, PascalPlural } = names
  const validator = validatorTemplate(validatorId)
  const schemaConst = `create${Pascal}Schema`

  return lines([
    validator && validator.schemaImportLine,
    `import { app } from '${appImportPath}'`,
    `import { create${Pascal}Handler, list${PascalPlural}Handler } from '${controllerImportPath}'`,
    ``,
    validator && validator.schemaDecl(schemaConst),
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
    `  auth: false,`,
    validator && `  body: ${schemaConst},`,
    `  handler: create${Pascal}Handler,`,
    `})`,
  ])
}

function appFile(choice: ScaffoldChoice): string {
  const framework = frameworkTemplate(choice.frameworkId)
  const validator = validatorTemplate(choice.validatorId)
  const hasDb = choice.databaseId !== 'none' && databaseConfigFile(choice.databaseId) !== null

  return lines([
    `import { createApp } from '@api-kickstart/api-kickstart'`,
    framework.importLine,
    validator && validator.importLine,
    hasDb && `import { db } from './config/database.js'`,
    ``,
    `export const app = createApp({`,
    `  framework: ${framework.factoryExpr},`,
    validator && `  validator: ${validator.factoryExpr},`,
    hasDb && `  db,`,
    `})`,
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

function indexFile(routesBarrelPath: string): string {
  return lines([
    `import { env } from './config/env.js'`,
    `import { app } from './app.js'`,
    `import '${routesBarrelPath}'`,
    ``,
    `app.listen(env.port, () => {`,
    `  console.log(\`Server listening on http://localhost:\${env.port}\`)`,
    `})`,
  ])
}

function generateLayered(choice: ScaffoldChoice): ScaffoldFile[] {
  const names = resourceNames(choice.resource)
  const files: ScaffoldFile[] = []

  files.push({ path: 'src/config/env.ts', contents: envFile() })

  const dbConfig = databaseConfigFile(choice.databaseId)
  if (dbConfig) {
    files.push({ path: 'src/config/database.ts', contents: dbConfig })
  }

  files.push({
    path: `src/models/${names.plural}.model.ts`,
    contents: dbModelBody(choice.databaseId, names, '../config/database.js'),
  })
  files.push({
    path: `src/services/${names.plural}.service.ts`,
    contents: serviceBody(names, `../models/${names.plural}.model.js`),
  })
  files.push({
    path: `src/controllers/${names.plural}.controller.ts`,
    contents: controllerBody(names, `../services/${names.plural}.service.js`),
  })
  files.push({
    path: `src/routes/${names.plural}.routes.ts`,
    contents: routesBody(names, choice.validatorId, '../app.js', `../controllers/${names.plural}.controller.js`),
  })
  files.push({ path: 'src/routes/index.ts', contents: lines([`import './${names.plural}.routes.js'`]) })
  files.push({ path: 'src/app.ts', contents: appFile(choice) })
  files.push({ path: 'src/index.ts', contents: indexFile('./routes/index.js') })

  return files
}

function generateModular(choice: ScaffoldChoice): ScaffoldFile[] {
  const names = resourceNames(choice.resource)
  const moduleDir = `src/modules/${names.plural}`
  const files: ScaffoldFile[] = []

  files.push({ path: 'src/config/env.ts', contents: envFile() })

  const dbConfig = databaseConfigFile(choice.databaseId)
  if (dbConfig) {
    files.push({ path: 'src/config/database.ts', contents: dbConfig })
  }

  files.push({
    path: `${moduleDir}/${names.plural}.model.ts`,
    contents: dbModelBody(choice.databaseId, names, '../../config/database.js'),
  })
  files.push({
    path: `${moduleDir}/${names.plural}.service.ts`,
    contents: serviceBody(names, `./${names.plural}.model.js`),
  })
  files.push({
    path: `${moduleDir}/${names.plural}.controller.ts`,
    contents: controllerBody(names, `./${names.plural}.service.js`),
  })
  files.push({
    path: `${moduleDir}/${names.plural}.routes.ts`,
    contents: routesBody(names, choice.validatorId, '../../app.js', `./${names.plural}.controller.js`),
  })
  files.push({
    path: 'src/modules/index.ts',
    contents: lines([`import './${names.plural}/${names.plural}.routes.js'`]),
  })
  files.push({ path: 'src/app.ts', contents: appFile(choice) })
  files.push({ path: 'src/index.ts', contents: indexFile('./modules/index.js') })

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
