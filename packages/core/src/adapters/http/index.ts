import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { DispatchHandler, FrameworkAdapter, RequestLike } from '../../index.js'
import { readBody } from './body.js'
import { parseCookies } from './cookies.js'

export interface HttpAdapterOptions {
  server?: Server
}

export function http(options: HttpAdapterOptions = {}): FrameworkAdapter {
  let dispatchHandler: DispatchHandler | null = null

  const requestListener = async (req: IncomingMessage, res: ServerResponse) => {
    if (!dispatchHandler) {
      res.statusCode = 503
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: { code: 'NOT_READY', message: 'api-kickstart handler not registered' } }))
      return
    }

    const url = new URL(req.url ?? '/', 'http://localhost')
    const rawQuery: Record<string, unknown> = {}
    for (const [key, value] of url.searchParams.entries()) {
      rawQuery[key] = value
    }

    let rawBody: unknown
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      rawBody = await readBody(req)
    }

    const requestLike: RequestLike = {
      method: req.method ?? 'GET',
      path: url.pathname,
      headers: req.headers as Record<string, string | string[] | undefined>,
      cookies: parseCookies(req.headers.cookie),
      rawQuery,
      rawBody,
    }

    const result = await dispatchHandler(requestLike, { req, res })
    for (const [key, value] of Object.entries(result.headers ?? {})) {
      res.setHeader(key, value)
    }
    res.statusCode = result.status
    if (Buffer.isBuffer(result.body)) {
      res.end(result.body)
    } else {
      res.setHeader('content-type', 'application/json')
      res.end(result.body === undefined ? '' : JSON.stringify(result.body))
    }
  }

  const server = options.server ?? createServer()
  server.on('request', requestListener)

  return {
    name: 'http',

    onRequest(handler) {
      dispatchHandler = handler
    },

    listen(port, cb) {
      server.listen(port, cb)
      return server
    },

    handler() {
      return requestListener
    },

    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    },
  }
}
