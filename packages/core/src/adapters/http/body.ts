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
      const buffer = Buffer.concat(chunks)
      const contentType = req.headers['content-type'] ?? ''
      if (contentType.includes('multipart/form-data')) {
        resolve(buffer)
        return
      }
      if (contentType.includes('application/json')) {
        try {
          resolve(JSON.parse(buffer.toString('utf8')))
        } catch (err) {
          reject(err)
        }
        return
      }
      resolve(buffer.toString('utf8'))
    })
    req.on('error', reject)
  })
}
