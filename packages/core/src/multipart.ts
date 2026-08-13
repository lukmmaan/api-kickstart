import type { UploadedFile } from './types.js'

export interface ParsedMultipart {
  fields: Record<string, string>
  files: Record<string, UploadedFile[]>
}

export function isMultipart(contentType: string | undefined): boolean {
  return Boolean(contentType?.toLowerCase().includes('multipart/form-data'))
}

function splitBuffer(buffer: Buffer, delimiter: Buffer): Buffer[] {
  const parts: Buffer[] = []
  let start = 0
  let index = buffer.indexOf(delimiter, start)
  while (index !== -1) {
    if (start !== 0) parts.push(buffer.subarray(start, index))
    start = index + delimiter.length
    index = buffer.indexOf(delimiter, start)
  }
  return parts
}

export function parseMultipart(body: Buffer, contentType: string): ParsedMultipart {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)
  if (!boundaryMatch) {
    throw new Error('multipart: missing boundary in content-type header')
  }
  const boundary = boundaryMatch[1] ?? boundaryMatch[2]
  const delimiter = Buffer.from(`--${boundary}`)

  const fields: Record<string, string> = {}
  const files: Record<string, UploadedFile[]> = {}

  for (const part of splitBuffer(body, delimiter)) {
    if (part.length === 0) continue
    const headerEnd = part.indexOf('\r\n\r\n')
    if (headerEnd === -1) continue

    const headerText = part.subarray(0, headerEnd).toString('utf8')
    let content = part.subarray(headerEnd + 4)
    if (content.subarray(-2).toString('utf8') === '\r\n') {
      content = content.subarray(0, -2)
    }

    const dispositionMatch = /Content-Disposition:\s*form-data;\s*name="([^"]*)"(?:;\s*filename="([^"]*)")?/i.exec(headerText)
    if (!dispositionMatch) continue
    const [, name, filename] = dispositionMatch

    if (filename !== undefined) {
      const contentTypeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headerText)
      const fileContentType = contentTypeMatch?.[1]?.trim() ?? 'application/octet-stream'
      files[name] ??= []
      files[name].push({ fieldName: name, filename, contentType: fileContentType, data: content, size: content.length })
    } else {
      fields[name] = content.toString('utf8')
    }
  }

  return { fields, files }
}
