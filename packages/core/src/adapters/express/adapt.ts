import type { NextFunction, Request, RequestHandler, Response } from 'express'

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
