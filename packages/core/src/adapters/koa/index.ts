import Koa, { type Context } from 'koa'
import bodyParser from 'koa-bodyparser'
import type { Server } from 'node:http'
import type { DispatchHandler, FrameworkAdapter, RequestLike } from '../../index.js'
import { parseCookies } from './cookies.js'
import { captureMultipartBody } from './multipart.js'

export interface KoaAdapterOptions {
  app?: Koa
}

export function koa(options: KoaAdapterOptions = {}): FrameworkAdapter {
  const app = options.app ?? new Koa()
  let dispatchHandler: DispatchHandler | null = null
  let server: Server | null = null

  app.use(captureMultipartBody)
  app.use(bodyParser())

  app.use(async (ctx: Context) => {
    if (!dispatchHandler) {
      ctx.status = 503
      ctx.body = { error: { code: 'NOT_READY', message: 'api-kickstart handler not registered' } }
      return
    }

    const requestLike: RequestLike = {
      method: ctx.method,
      path: ctx.path,
      headers: ctx.headers as Record<string, string | string[] | undefined>,
      cookies: parseCookies(ctx.headers.cookie),
      rawQuery: ctx.query as Record<string, unknown>,
      rawBody: ctx.request.body,
    }

    const result = await dispatchHandler(requestLike, { req: ctx.req, res: ctx.res })
    for (const [key, value] of Object.entries(result.headers ?? {})) {
      ctx.set(key, value)
    }
    ctx.status = result.status
    ctx.body = result.body
  })

  return {
    name: 'koa',

    onRequest(handler) {
      dispatchHandler = handler
    },

    listen(port, cb) {
      server = app.listen(port, cb)
      return server
    },

    handler() {
      return app.callback()
    },

    async close() {
      await new Promise<void>((resolve, reject) => {
        if (!server) {
          resolve()
          return
        }
        server.close((err) => (err ? reject(err) : resolve()))
      })
    },
  }
}
