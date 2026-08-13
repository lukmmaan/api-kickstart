import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password.js'

describe('hashPassword / verifyPassword', () => {
  it('produces a hash that verifies against the original password', async () => {
    const hash = await hashPassword('correct horse battery staple')
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple')
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false)
  })

  it('produces a different hash for the same password on each call', async () => {
    const a = await hashPassword('same password')
    const b = await hashPassword('same password')
    expect(a).not.toBe(b)
  })

  it('rejects a malformed hash instead of throwing', async () => {
    await expect(verifyPassword('anything', 'not-a-real-hash')).resolves.toBe(false)
  })

  it('respects a custom cost and key length', async () => {
    const hash = await hashPassword('tunable', { cost: 1024, keyLength: 32 })
    expect(hash.startsWith('scrypt$1024$')).toBe(true)
    await expect(verifyPassword('tunable', hash)).resolves.toBe(true)
  })
})
