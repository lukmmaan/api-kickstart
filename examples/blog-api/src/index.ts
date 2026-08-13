import { z } from 'zod'
import { createApp } from 'api-kickstart'
import { jwt } from 'api-kickstart/auth'
import { express } from '@kickstart/express'
import { zod } from '@kickstart/zod'
import { createInMemoryDb } from './db.js'
import { findUserByCredentials, findUserById } from './users.js'

const jwtSecret = process.env.JWT_SECRET ?? 'blog-api-demo-secret-do-not-use-in-production'

const auth = jwt({
  secret: jwtSecret,
  resolveUser: async (payload) => {
    const user = findUserById(String(payload.sub))
    return user ? { id: user.id, role: user.role, username: user.username } : null
  },
  verifyCredentials: async ({ username, password }) => {
    const user = await findUserByCredentials(username, password)
    return user ? { id: user.id, role: user.role, username: user.username } : null
  },
})

const createPostSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
})

const updatePostSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  published: z.boolean().optional(),
})

const app = createApp({
  framework: express(),
  db: createInMemoryDb(),
  validator: zod(),
  auth,
  cors: 'dev',
  scopeAudit: 'warn',
  scope: {
    posts: {
      admin: () => ({}),
      author: (user) => ({ authorId: user.id }),
      reader: () => ({ published: true }),
    },
  },
})

app.useAuthRoutes({
  login: '/auth/login',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  me: '/auth/me',
})

app.resource('/posts', {
  model: 'posts',
  scope: 'posts',
  schema: { create: createPostSchema, update: updatePostSchema },
  roles: {
    create: ['admin', 'author'],
    update: ['admin', 'author'],
    delete: ['admin', 'author'],
  },
  hooks: {
    beforeCreate: (ctx, data) => ({ ...(data as object), authorId: ctx.user?.id, published: false }),
  },
})

app.health()
app.metrics()
app.openapi({
  info: { title: 'Blog API', version: '1.0.0', description: 'api-kickstart reference example' },
  json: '/openapi.json',
  serve: '/docs',
})

const port = Number(process.env.PORT ?? 3000)
app.listen(port, () => {
  console.log(`blog-api listening on http://localhost:${port}`)
  console.log('try: curl -X POST http://localhost:3000/auth/login -H "content-type: application/json" -d \'{"username":"alice","password":"alice123"}\'')
})
