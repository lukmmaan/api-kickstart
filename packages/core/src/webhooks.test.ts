import { describe, expect, it, vi } from 'vitest'
import { signWebhook, verifyWebhook, WebhookSignatureError } from './webhooks.js'

describe('signWebhook / verifyWebhook', () => {
  it('verifies a signature it just signed', () => {
    const payload = JSON.stringify({ event: 'order.created', id: 1 })
    const header = signWebhook(payload, { secret: 'whsec_test' })
    expect(() => verifyWebhook(payload, header, { secret: 'whsec_test' })).not.toThrow()
  })

  it('rejects a payload that was tampered with after signing', () => {
    const payload = JSON.stringify({ event: 'order.created', id: 1 })
    const header = signWebhook(payload, { secret: 'whsec_test' })
    const tampered = JSON.stringify({ event: 'order.created', id: 2 })
    expect(() => verifyWebhook(tampered, header, { secret: 'whsec_test' })).toThrow(WebhookSignatureError)
  })

  it('rejects a signature produced with a different secret', () => {
    const payload = JSON.stringify({ event: 'order.created' })
    const header = signWebhook(payload, { secret: 'whsec_a' })
    expect(() => verifyWebhook(payload, header, { secret: 'whsec_b' })).toThrow(WebhookSignatureError)
  })

  it('rejects a malformed signature header', () => {
    expect(() => verifyWebhook('payload', 'not-a-real-header', { secret: 'whsec_test' })).toThrow(WebhookSignatureError)
  })

  it('rejects a timestamp outside the tolerance window', () => {
    const payload = 'hello'
    const oldTimestamp = Date.now() - 10 * 60 * 1000
    const header = signWebhook(payload, { secret: 'whsec_test', timestamp: oldTimestamp })
    expect(() => verifyWebhook(payload, header, { secret: 'whsec_test', toleranceSeconds: 300 })).toThrow(WebhookSignatureError)
  })

  it('accepts a custom tolerance window that covers an older timestamp', () => {
    const payload = 'hello'
    const oldTimestamp = Date.now() - 10 * 60 * 1000
    const header = signWebhook(payload, { secret: 'whsec_test', timestamp: oldTimestamp })
    expect(() => verifyWebhook(payload, header, { secret: 'whsec_test', toleranceSeconds: 3600 })).not.toThrow()
  })

  it('produces a different signature for the same payload at a different timestamp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    const a = signWebhook('same payload', { secret: 'whsec_test' })
    vi.setSystemTime(1_700_000_005_000)
    const b = signWebhook('same payload', { secret: 'whsec_test' })
    expect(a).not.toBe(b)
    vi.useRealTimers()
  })

  it('works with a Buffer payload identically to its string form', () => {
    const text = JSON.stringify({ a: 1 })
    const header = signWebhook(Buffer.from(text), { secret: 'whsec_test' })
    expect(() => verifyWebhook(text, header, { secret: 'whsec_test' })).not.toThrow()
  })
})
