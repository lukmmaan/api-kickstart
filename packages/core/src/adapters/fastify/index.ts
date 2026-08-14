import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import type { DispatchHandler, FrameworkAdapter, RequestLike } from '../../index.js'
import { parseCookies } from './cookies.js'

export interface FastifyAdapterOptions {
  app?: FastifyInstance
}

export function fastify(options: FastifyAdapterOptions = {}): FrameworkAdapter {
  const app = options.app ?? Fastify()
  let dispatchHandler: DispatchHandler | null = null

  app.addContentTypeParser(/^multipart\/form-data/, { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body)
  })

  app.all('*', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!dispatchHandler) {
      reply.status(503).send({ error: { code: 'NOT_READY', message: 'api-kickstart handler not registered' } })
      return
    }

    const requestLike: RequestLike = {
      method: req.method,
      path: req.url.split('?')[0] ?? req.url,
      headers: req.headers as Record<string, string | string[] | undefined>,
      cookies: parseCookies(req.headers.cookie),
      rawQuery: req.query as Record<string, unknown>,
      rawBody: req.body,
    }

    const result = await dispatchHandler(requestLike, { req, res: reply })
    for (const [key, value] of Object.entries(result.headers ?? {})) {
      reply.header(key, value)
    }
    reply.status(result.status).send(result.body)
  })

  return {
    name: 'fastify',

    onRequest(handler) {
      dispatchHandler = handler
    },

    listen(port, cb) {
      app.listen({ port, host: '0.0.0.0' }, (err) => {
        if (err) throw err
        cb?.()
      })
      return app
    },

    handler() {
      return app
    },

    async close() {
      await app.close()
    },
  }
}
