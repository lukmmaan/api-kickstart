import type { IncomingMessage } from 'node:http'

export function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined)
        return
      }
      const raw = Buffer.concat(chunks).toString('utf8')
      const contentType = req.headers['content-type'] ?? ''
      if (contentType.includes('application/json')) {
        try {
          resolve(JSON.parse(raw))
        } catch (err) {
          reject(err)
        }
        return
      }
      resolve(raw)
    })
    req.on('error', reject)
  })
}
