import type { Context, Next } from 'koa'

export async function captureMultipartBody(ctx: Context, next: Next): Promise<void> {
  const contentType = ctx.headers['content-type'] ?? ''
  if (!contentType.includes('multipart/form-data')) {
    await next()
    return
  }

  const chunks: Buffer[] = []
  for await (const chunk of ctx.req) {
    chunks.push(chunk as Buffer)
  }
  ctx.request.body = Buffer.concat(chunks)
  await next()
}
