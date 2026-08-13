import 'reflect-metadata'
import { All, Controller, Module, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { DispatchHandler, RequestLike } from 'api-kickstart'
import { parseCookies } from './cookies.js'

export const dispatchRef: { current: DispatchHandler | null } = { current: null }

@Controller()
export class KickstartController {
  @All('*')
  async handleAll(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!dispatchRef.current) {
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

    const result = await dispatchRef.current(requestLike, { req, res })
    for (const [key, value] of Object.entries(result.headers ?? {})) {
      res.setHeader(key, value)
    }
    if (Buffer.isBuffer(result.body)) {
      res.status(result.status).end(result.body)
    } else {
      res.status(result.status).json(result.body)
    }
  }
}

@Module({ controllers: [KickstartController] })
export class KickstartModule {}
