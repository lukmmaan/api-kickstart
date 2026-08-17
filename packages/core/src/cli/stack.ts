export interface StackPackage {
  name: string
  range: string
}

export interface StackChoice {
  id: string
  label: string
  packages: StackPackage[]
}

export interface StackCategory {
  id: string
  label: string
  question: string
  /** Allow picking more than one choice in this category (e.g. more than one broker). */
  multiple?: boolean
  choices: StackChoice[]
}

function pkg(name: string, range: string): StackPackage {
  return { name, range }
}

export const STACK_CATEGORIES: StackCategory[] = [
  {
    id: 'framework',
    label: 'Framework',
    question: 'Which HTTP framework do you want to use?',
    choices: [
      { id: 'express', label: 'Express', packages: [pkg('express', '^4.19.0 || ^5.0.0')] },
      { id: 'fastify', label: 'Fastify', packages: [pkg('fastify', '^4.28.0 || ^5.0.0')] },
      { id: 'hono', label: 'Hono', packages: [pkg('hono', '^4.6.0'), pkg('@hono/node-server', '^1.13.0')] },
      { id: 'koa', label: 'Koa', packages: [pkg('koa', '^2.15.0'), pkg('koa-bodyparser', '^4.4.1')] },
      {
        id: 'nest',
        label: 'NestJS',
        packages: [
          pkg('@nestjs/core', '^10.4.0'),
          pkg('@nestjs/common', '^10.4.0'),
          pkg('@nestjs/platform-express', '^10.4.0'),
          pkg('reflect-metadata', '^0.2.2'),
          pkg('rxjs', '^7.8.1'),
        ],
      },
      { id: 'http', label: 'Plain node:http (no framework package needed)', packages: [] },
    ],
  },
  {
    id: 'database',
    label: 'Database',
    question: 'Which database/ORM adapter do you want?',
    choices: [
      { id: 'pg', label: 'PostgreSQL (pg)', packages: [pkg('pg', '^8.11.0')] },
      { id: 'drizzle', label: 'Drizzle ORM', packages: [pkg('drizzle-orm', '^0.33.0')] },
      { id: 'mongoose', label: 'Mongoose', packages: [pkg('mongoose', '^8.6.0')] },
      { id: 'mongodb', label: 'MongoDB driver', packages: [pkg('mongodb', '^6.8.0')] },
      {
        id: 'knex',
        label: 'Knex (bring your own driver, e.g. pg/mysql2/better-sqlite3)',
        packages: [pkg('knex', '^3.1.0')],
      },
      { id: 'typeorm', label: 'TypeORM', packages: [pkg('typeorm', '^0.3.20'), pkg('reflect-metadata', '^0.2.2')] },
      { id: 'sequelize', label: 'Sequelize', packages: [pkg('sequelize', '^6.37.0')] },
      { id: 'none', label: "Skip — I'll bring my own / add it later", packages: [] },
    ],
  },
  {
    id: 'broker',
    label: 'Message broker',
    question: 'Which message broker(s) do you want? (pick any number, or none)',
    multiple: true,
    choices: [
      { id: 'rabbitmq', label: 'RabbitMQ', packages: [pkg('amqplib', '^0.10.4')] },
      { id: 'kafka', label: 'Kafka', packages: [pkg('kafkajs', '^2.2.4')] },
      {
        id: 'redis',
        label: 'Redis (streams, plus redis-backed rate-limit/cache/session/lock/i18n stores)',
        packages: [pkg('ioredis', '^5.4.1')],
      },
      { id: 'bullmq', label: 'BullMQ', packages: [pkg('bullmq', '^5.12.0')] },
      { id: 'sqs', label: 'Amazon SQS', packages: [pkg('@aws-sdk/client-sqs', '^3.635.0')] },
      { id: 'nats', label: 'NATS', packages: [pkg('nats', '^2.28.2')] },
      { id: 'mqtt', label: 'MQTT', packages: [pkg('mqtt', '^5.10.1')] },
      { id: 'pubsub', label: 'Google Cloud Pub/Sub', packages: [pkg('@google-cloud/pubsub', '^4.9.0')] },
    ],
  },
  {
    id: 'validation',
    label: 'Validation',
    question: 'Which validation library do you want?',
    choices: [
      { id: 'zod', label: 'Zod', packages: [pkg('zod', '^3.23.0'), pkg('zod-to-json-schema', '^3.23.5')] },
      { id: 'joi', label: 'Joi', packages: [pkg('joi', '^17.13.3'), pkg('joi-to-json', '^5.0.5')] },
      { id: 'yup', label: 'Yup', packages: [pkg('yup', '^1.4.0'), pkg('@sodaru/yup-to-json-schema', '^2.0.1')] },
      {
        id: 'valibot',
        label: 'Valibot',
        packages: [pkg('valibot', '^1.4.0'), pkg('@valibot/to-json-schema', '^1.4.0')],
      },
      { id: 'typebox', label: 'TypeBox', packages: [pkg('@sinclair/typebox', '^0.33.0')] },
      { id: 'none', label: "Skip — I'll bring my own / add it later", packages: [] },
    ],
  },
  {
    id: 'storage',
    label: 'Object storage',
    question: 'Do you need S3-compatible object storage (AWS S3, MinIO, Cloudflare R2)?',
    choices: [
      {
        id: 's3',
        label: 'Yes',
        packages: [pkg('@aws-sdk/client-s3', '^3.635.0'), pkg('@aws-sdk/s3-request-presigner', '^3.635.0')],
      },
      { id: 'none', label: 'No', packages: [] },
    ],
  },
  {
    id: 'logging',
    label: 'Logging',
    question: 'Structured logging via pino, instead of the built-in console logger?',
    choices: [
      { id: 'pino', label: 'Yes, pino', packages: [pkg('pino', '^9.4.0')] },
      { id: 'none', label: 'No, keep the built-in console logger', packages: [] },
    ],
  },
]

export function findCategory(id: string): StackCategory | undefined {
  return STACK_CATEGORIES.find((category) => category.id === id)
}

export function resolvePackages(category: StackCategory, choiceIds: string[]): StackPackage[] {
  const packages: StackPackage[] = []
  const seen = new Set<string>()
  for (const choiceId of choiceIds) {
    const choice = category.choices.find((c) => c.id === choiceId)
    if (!choice) continue
    for (const p of choice.packages) {
      if (seen.has(p.name)) continue
      seen.add(p.name)
      packages.push(p)
    }
  }
  return packages
}

export function dedupePackages(packages: StackPackage[]): StackPackage[] {
  const seen = new Set<string>()
  const result: StackPackage[] = []
  for (const p of packages) {
    if (seen.has(p.name)) continue
    seen.add(p.name)
    result.push(p)
  }
  return result
}
