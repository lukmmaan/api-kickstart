import expressLib, { type Express, type Request, type RequestHandler, type Response } from 'express'
import type { DispatchHandler, FrameworkAdapter, RequestLike } from 'api-kickstart'
import { parseCookies } from './cookies.js'

export { adapt } from './adapt.js'

export interface ExpressAdapterOptions {
  app?: Express
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
