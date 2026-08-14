import { Hono, type Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { serve, type ServerType } from '@hono/node-server'
import type { DispatchHandler, FrameworkAdapter, RequestLike } from '../../index.js'
import { parseCookies } from './cookies.js'

export interface HonoAdapterOptions {
  app?: Hono
}

async function readRawBody(c: Context, headers: Record<string, string | string[] | undefined>): Promise<unknown> {
  if (c.req.method === 'GET' || c.req.method === 'HEAD') return undefined
  const contentType = headers['content-type']
  const contentTypeValue = Array.isArray(contentType) ? contentType[0] : contentType
  if (contentTypeValue?.includes('multipart/form-data')) {
    const arrayBuffer = await c.req.arrayBuffer().catch(() => undefined)
    return arrayBuffer ? Buffer.from(arrayBuffer) : undefined
  }
  if (contentTypeValue?.includes('application/json')) {
    return c.req.json().catch(() => undefined)
  }
  return c.req.text().catch(() => undefined)
}

export function hono(options: HonoAdapterOptions = {}): FrameworkAdapter {
  const app = options.app ?? new Hono()
  let dispatchHandler: DispatchHandler | null = null
  let server: ServerType | null = null

  app.all('*', async (c) => {
    if (!dispatchHandler) {
      return c.json({ error: { code: 'NOT_READY', message: 'api-kickstart handler not registered' } }, 503)
    }

    const url = new URL(c.req.url)
    const rawQuery: Record<string, unknown> = {}
    for (const [key, value] of url.searchParams.entries()) {
      rawQuery[key] = value
    }

    const headers: Record<string, string | string[] | undefined> = {}
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value
    })

    const requestLike: RequestLike = {
      method: c.req.method,
      path: url.pathname,
      headers,
      cookies: parseCookies(headers.cookie as string | undefined),
      rawQuery,
      rawBody: await readRawBody(c, headers),
    }

    const result = await dispatchHandler(requestLike, { req: c.req.raw, res: null })
    for (const [key, value] of Object.entries(result.headers ?? {})) {
      c.header(key, value)
    }
    const status = result.status as ContentfulStatusCode
    if (Buffer.isBuffer(result.body)) {
      return c.body(new Uint8Array(result.body), status)
    }
    return c.json(result.body as object, status)
  })

  return {
    name: 'hono',

    onRequest(handler) {
      dispatchHandler = handler
    },

    listen(port, cb) {
      server = serve({ fetch: app.fetch, port }, () => cb?.())
      return server
    },

    handler() {
      return app.fetch
    },

    async close() {
      await new Promise<void>((resolve) => {
        if (!server) {
          resolve()
          return
        }
        server.close(() => resolve())
      })
    },
  }
}
