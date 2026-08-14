import type { NextFunction, Request, Response } from 'express'

export function captureMultipartBody(req: Request, res: Response, next: NextFunction): void {
  const contentType = req.headers['content-type'] ?? ''
  if (!contentType.includes('multipart/form-data')) {
    next()
    return
  }

  const chunks: Buffer[] = []
  req.on('data', (chunk) => chunks.push(chunk))
  req.on('end', () => {
    req.body = Buffer.concat(chunks)
    next()
  })
  req.on('error', next)
}
