import { EventEmitter } from 'node:events'
import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import { readBody } from './body.js'

function fakeRequest(headers: Record<string, string>, chunks: Buffer[]): IncomingMessage {
  const emitter = new EventEmitter() as unknown as IncomingMessage
  ;(emitter as unknown as { headers: Record<string, string> }).headers = headers
  queueMicrotask(() => {
    for (const chunk of chunks) emitter.emit('data', chunk)
    emitter.emit('end')
  })
  return emitter
}

describe('readBody', () => {
  it('resolves undefined when there is no body', async () => {
    const req = fakeRequest({}, [])
    await expect(readBody(req)).resolves.toBeUndefined()
  })

  it('parses a JSON body when content-type is application/json', async () => {
    const req = fakeRequest({ 'content-type': 'application/json' }, [Buffer.from('{"a":1}')])
    await expect(readBody(req)).resolves.toEqual({ a: 1 })
  })

  it('rejects when the JSON body is malformed', async () => {
    const req = fakeRequest({ 'content-type': 'application/json' }, [Buffer.from('{not json')])
    await expect(readBody(req)).rejects.toBeInstanceOf(Error)
  })

  it('returns a raw Buffer for multipart/form-data', async () => {
    const req = fakeRequest({ 'content-type': 'multipart/form-data; boundary=x' }, [Buffer.from('raw-bytes')])
    const result = await readBody(req)
    expect(Buffer.isBuffer(result)).toBe(true)
    expect((result as Buffer).toString('utf8')).toBe('raw-bytes')
  })

  it('falls back to a plain string for other content types', async () => {
    const req = fakeRequest({ 'content-type': 'text/plain' }, [Buffer.from('hello')])
    await expect(readBody(req)).resolves.toBe('hello')
  })
})
