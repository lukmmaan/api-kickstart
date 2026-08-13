import { Redis } from 'ioredis'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { redisCacheStore, redisIdempotencyStore, redisRateLimitStore, redisSessionStore } from './index.js'

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
const keyPrefix = 'kickstart-test:'

beforeEach(async () => {
  const keys = await redis.keys(`${keyPrefix}*`)
  if (keys.length > 0) await redis.del(...keys)
})

afterAll(async () => {
  const keys = await redis.keys(`${keyPrefix}*`)
  if (keys.length > 0) await redis.del(...keys)
  await redis.quit()
})

describe('redisRateLimitStore', () => {
  it('increments a counter and shares it across increment calls for the same key', async () => {
    const store = redisRateLimitStore('1m', { redis, keyPrefix })
    const first = await store.increment('user1')
    const second = await store.increment('user1')
    expect(first.count).toBe(1)
    expect(second.count).toBe(2)
    expect(second.resetAt).toBeGreaterThan(Date.now())
  })

  it('keeps separate counters per key', async () => {
    const store = redisRateLimitStore('1m', { redis, keyPrefix })
    await store.increment('a')
    const b = await store.increment('b')
    expect(b.count).toBe(1)
  })
})

describe('redisIdempotencyStore', () => {
  it('round-trips a stored record', async () => {
    const store = redisIdempotencyStore({ redis, keyPrefix })
    await store.set('req-1', { status: 201, headers: { 'x-a': '1' }, body: { id: 1 } }, 5000)
    await expect(store.get('req-1')).resolves.toEqual({ status: 201, headers: { 'x-a': '1' }, body: { id: 1 } })
  })

  it('returns null for a key that was never set', async () => {
    const store = redisIdempotencyStore({ redis, keyPrefix })
    await expect(store.get('missing')).resolves.toBeNull()
  })
})

describe('redisCacheStore', () => {
  it('round-trips a cached response', async () => {
    const store = redisCacheStore({ redis, keyPrefix })
    await store.set('GET:/posts', { status: 200, headers: {}, body: [1, 2, 3] }, 5000)
    await expect(store.get('GET:/posts')).resolves.toEqual({ status: 200, headers: {}, body: [1, 2, 3] })
  })
})

describe('redisSessionStore', () => {
  it('stores and retrieves a session record', async () => {
    const store = redisSessionStore({ redis, keyPrefix })
    const expiresAt = Date.now() + 60_000
    await store.set('sid-1', { userId: 'u1', data: { id: 'u1', role: 'admin' }, expiresAt })
    await expect(store.get('sid-1')).resolves.toEqual({ userId: 'u1', data: { id: 'u1', role: 'admin' }, expiresAt })
  })

  it('removes a session on destroy', async () => {
    const store = redisSessionStore({ redis, keyPrefix })
    await store.set('sid-2', { userId: 'u1', data: { id: 'u1' }, expiresAt: Date.now() + 60_000 })
    await store.destroy('sid-2')
    await expect(store.get('sid-2')).resolves.toBeNull()
  })

  it('does not store a record whose expiresAt is already in the past', async () => {
    const store = redisSessionStore({ redis, keyPrefix })
    await store.set('sid-3', { userId: 'u1', data: { id: 'u1' }, expiresAt: Date.now() - 1000 })
    await expect(store.get('sid-3')).resolves.toBeNull()
  })
})
