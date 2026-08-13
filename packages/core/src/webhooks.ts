import { createHmac, timingSafeEqual } from 'node:crypto'

const DEFAULT_TOLERANCE_SECONDS = 300

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebhookSignatureError'
  }
}

function computeSignature(payload: string | Buffer, secret: string, timestamp: number): string {
  const body = typeof payload === 'string' ? payload : payload.toString('utf8')
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

export interface SignWebhookOptions {
  secret: string
  timestamp?: number
}

export function signWebhook(payload: string | Buffer, options: SignWebhookOptions): string {
  const timestamp = options.timestamp ?? Date.now()
  const signature = computeSignature(payload, options.secret, timestamp)
  return `t=${timestamp},v1=${signature}`
}

export interface VerifyWebhookOptions {
  secret: string
  toleranceSeconds?: number
}

function parseSignatureHeader(header: string): { timestamp: number; signature: string } {
  const parts: Record<string, string> = {}
  for (const part of header.split(',')) {
    const [key, value] = part.split('=')
    if (key && value) parts[key] = value
  }
  const timestamp = Number(parts.t)
  const signature = parts.v1
  if (!Number.isFinite(timestamp) || !signature) {
    throw new WebhookSignatureError('Malformed signature header')
  }
  return { timestamp, signature }
}

export function verifyWebhook(payload: string | Buffer, signatureHeader: string, options: VerifyWebhookOptions): void {
  const { timestamp, signature } = parseSignatureHeader(signatureHeader)
  const toleranceMs = (options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS) * 1000

  if (Math.abs(Date.now() - timestamp) > toleranceMs) {
    throw new WebhookSignatureError('Timestamp outside tolerance window')
  }

  const expected = Buffer.from(computeSignature(payload, options.secret, timestamp))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new WebhookSignatureError('Signature mismatch')
  }
}
