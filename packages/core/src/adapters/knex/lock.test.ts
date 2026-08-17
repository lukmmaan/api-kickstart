import Knex from 'knex'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { knexLock } from './lock.js'

let client: ReturnType<typeof Knex>

beforeEach(() => {
  client = Knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true })
})

afterEach(async () => {
  await client.destroy()
})

describe('knexLock', () => {
  it('grants the lock to the first acquirer and denies a second concurrent acquirer', async () => {
    const lockA = knexLock(client)
    const lockB = knexLock(client)

    await expect(lockA.acquire('nightly-report', 5000)).resolves.toBe(true)
    await expect(lockB.acquire('nightly-report', 5000)).resolves.toBe(false)
  })

  it('lets another holder acquire the lock after release', async () => {
    const lockA = knexLock(client)
    const lockB = knexLock(client)

    await lockA.acquire('nightly-report', 5000)
    await lockA.release('nightly-report')

    await expect(lockB.acquire('nightly-report', 5000)).resolves.toBe(true)
  })

  it('lets another holder acquire the lock once the TTL expires', async () => {
    const lockA = knexLock(client)
    const lockB = knexLock(client)

    await lockA.acquire('short-lived', 50)
    await new Promise((resolve) => setTimeout(resolve, 150))

    await expect(lockB.acquire('short-lived', 5000)).resolves.toBe(true)
  })

  it('release() is a safe no-op when the caller never held the lock', async () => {
    const lock = knexLock(client)
    await expect(lock.release('never-acquired')).resolves.toBeUndefined()
  })

  it('a stale release from a holder whose TTL already expired does not evict the current holder', async () => {
    const lockA = knexLock(client)
    const lockB = knexLock(client)
    const lockC = knexLock(client)

    await lockA.acquire('race', 50)
    await new Promise((resolve) => setTimeout(resolve, 150))
    await lockB.acquire('race', 5000)

    await lockA.release('race')

    await expect(lockC.acquire('race', 5000)).resolves.toBe(false)
  })

  it('keeps independent locks per key', async () => {
    const lock = knexLock(client)
    await expect(lock.acquire('key-a', 5000)).resolves.toBe(true)
    await expect(lock.acquire('key-b', 5000)).resolves.toBe(true)
  })

  it('creates the lock table lazily', async () => {
    expect(await client.schema.hasTable('_api_kickstart_locks')).toBe(false)
    await knexLock(client).acquire('bootstraps-table', 5000)
    expect(await client.schema.hasTable('_api_kickstart_locks')).toBe(true)
  })
})
