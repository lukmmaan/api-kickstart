import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import type { DispatchHandler, FrameworkAdapter, RequestLike } from 'api-kickstart'

export interface FastifyAdapterOptions {
  app?: FastifyInstance
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!header) return cookies
  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=')
    if (separatorIndex === -1) continue
    const key = part.slice(0, separatorIndex).trim()
    const value = part.slice(separatorIndex + 1).trim()
    if (!key) continue
    cookies[key] = decodeURIComponent(value)
  }
  return cookies
}

export function fastify(options: FastifyAdapterOptions = {}): FrameworkAdapter {
  const app = options.app ?? Fastify()
  let dispatchHandler: DispatchHandler | null = null

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
