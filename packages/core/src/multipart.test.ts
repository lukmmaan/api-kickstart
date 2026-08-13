import { describe, expect, it } from 'vitest'
import { isMultipart, parseMultipart } from './multipart.js'

describe('isMultipart', () => {
  it('detects a multipart content type', () => {
    expect(isMultipart('multipart/form-data; boundary=----abc123')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isMultipart('MULTIPART/FORM-DATA; boundary=abc')).toBe(true)
  })

  it('returns false for other content types', () => {
    expect(isMultipart('application/json')).toBe(false)
    expect(isMultipart(undefined)).toBe(false)
  })
})

describe('parseMultipart', () => {
  const boundary = '----kickstartBoundary'
  const contentType = `multipart/form-data; boundary=${boundary}`

  function buildBody(): Buffer {
    const parts = [
      `--${boundary}\r\n`,
      'Content-Disposition: form-data; name="title"\r\n\r\n',
      'Hello world\r\n',
      `--${boundary}\r\n`,
      'Content-Disposition: form-data; name="avatar"; filename="a.txt"\r\n',
      'Content-Type: text/plain\r\n\r\n',
      'file contents\r\n',
      `--${boundary}--\r\n`,
    ]
    return Buffer.from(parts.join(''), 'utf8')
  }

  it('parses text fields', () => {
    const { fields } = parseMultipart(buildBody(), contentType)
    expect(fields.title).toBe('Hello world')
  })

  it('parses file parts with metadata and content', () => {
    const { files } = parseMultipart(buildBody(), contentType)
    expect(files.avatar).toHaveLength(1)
    const file = files.avatar[0]
    expect(file.filename).toBe('a.txt')
    expect(file.contentType).toBe('text/plain')
    expect(file.data.toString('utf8')).toBe('file contents')
    expect(file.size).toBe(Buffer.byteLength('file contents'))
  })

  it('throws when the content type has no boundary', () => {
    expect(() => parseMultipart(buildBody(), 'multipart/form-data')).toThrow(/boundary/)
  })
})
