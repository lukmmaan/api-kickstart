import expressLib, { type Express, type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import type { DispatchHandler, FrameworkAdapter, RequestLike } from 'api-kickstart'

export interface ExpressAdapterOptions {
  app?: Express
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

export function express(options: ExpressAdapterOptions = {}): FrameworkAdapter {
  const app = options.app ?? expressLib()
  let dispatchHandler: DispatchHandler | null = null
  let server: ReturnType<Express['listen']> | null = null

  app.use(expressLib.json())

  app.use(async (req: Request, res: Response) => {
    if (!dispatchHandler) {
      res.status(503).json({ error: { code: 'NOT_READY', message: 'api-kickstart handler not registered' } })
      return
    }

    const requestLike: RequestLike = {
      method: req.method,
      path: req.path,
      headers: req.headers as Record<string, string | string[] | undefined>,
      cookies: parseCookies(req.headers.cookie),
      rawQuery: req.query as Record<string, unknown>,
      rawBody: req.body,
    }

    const result = await dispatchHandler(requestLike, { req, res })
    for (const [key, value] of Object.entries(result.headers ?? {})) {
      res.setHeader(key, value)
    }
    res.status(result.status).json(result.body)
  })

  return {
    name: 'express',

    onRequest(handler) {
      dispatchHandler = handler
    },

    listen(port, cb) {
      server = app.listen(port, cb)
      return server
    },

    handler(): RequestHandler {
      return app as unknown as RequestHandler
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

export function adapt(middleware: RequestHandler) {
  return async (ctx: { raw: { req: unknown; res: unknown } }, next: () => Promise<void>) => {
    await new Promise<void>((resolve, reject) => {
      middleware(ctx.raw.req as Request, ctx.raw.res as Response, ((err?: unknown) => {
        if (err) reject(err)
        else resolve()
      }) as NextFunction)
    })
    await next()
  }
}
