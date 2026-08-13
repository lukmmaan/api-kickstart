import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { Unauthorized } from '../errors.js'
import type { AuthenticatedUser } from '../types.js'
import { jwt } from './jwt.js'

const users: Record<string, AuthenticatedUser> = {
  '1': { id: '1', role: 'admin' },
}

function authHeader(token: string) {
  return { headers: { authorization: `Bearer ${token}` }, cookies: {}, raw: { req: null, res: null } }
}

describe('jwt() with HS256', () => {
  function makeStrategy() {
    return jwt({
      secret: 'a-sufficiently-long-test-secret-value',
      resolveUser: async (payload) => users[String(payload.sub)] ?? null,
    })
  }

  it('issues an access/refresh token pair and authenticates with the access token', async () => {
    const strategy = makeStrategy()
    const pair = await strategy.issueTokenPair(users['1'])
    expect(pair.accessToken).toEqual(expect.any(String))
    expect(pair.refreshToken).toEqual(expect.any(String))

    const authenticated = await strategy.authenticate(authHeader(pair.accessToken))
    expect(authenticated).toEqual(users['1'])
  })

  it('returns null for a missing or malformed token', async () => {
    const strategy = makeStrategy()
    await expect(strategy.authenticate({ headers: {}, cookies: {}, raw: { req: null, res: null } })).resolves.toBeNull()
    await expect(strategy.authenticate(authHeader('not-a-real-token'))).resolves.toBeNull()
  })

  it('rotates the refresh token and rejects reuse of a consumed one', async () => {
    const strategy = makeStrategy()
    const first = await strategy.issueTokenPair(users['1'])
    const second = await strategy.refresh(first.refreshToken)
    expect(second.refreshToken).not.toBe(first.refreshToken)

    await expect(strategy.refresh(first.refreshToken)).rejects.toThrow(Unauthorized)
    await expect(strategy.refresh(second.refreshToken)).rejects.toThrow(Unauthorized)
  })

  it('revokes the token family on logout', async () => {
    const strategy = makeStrategy()
    const pair = await strategy.issueTokenPair(users['1'])
    await strategy.revoke(pair.refreshToken)
    await expect(strategy.refresh(pair.refreshToken)).rejects.toThrow(Unauthorized)
  })
})

describe('jwt() with RS256', () => {
  it('signs with the private key and verifies with the public key', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const strategy = jwt({
      algorithm: 'RS256',
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      resolveUser: async (payload) => users[String(payload.sub)] ?? null,
    })

    const pair = await strategy.issueTokenPair(users['1'])
    const authenticated = await strategy.authenticate(authHeader(pair.accessToken))
    expect(authenticated).toEqual(users['1'])
  })

  it('rejects a token signed with a different key pair', async () => {
    const pairA = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const pairB = generateKeyPairSync('rsa', { modulusLength: 2048 })

    const signer = jwt({
      algorithm: 'RS256',
      privateKey: pairA.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      publicKey: pairA.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      resolveUser: async (payload) => users[String(payload.sub)] ?? null,
    })
    const verifier = jwt({
      algorithm: 'RS256',
      privateKey: pairB.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      publicKey: pairB.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      resolveUser: async (payload) => users[String(payload.sub)] ?? null,
    })

    const pair = await signer.issueTokenPair(users['1'])
    await expect(verifier.authenticate(authHeader(pair.accessToken))).resolves.toBeNull()
  })
})
