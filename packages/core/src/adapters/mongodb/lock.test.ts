import type { Db } from 'mongodb'
import { describe, expect, it } from 'vitest'
import { mongodbLock } from './lock.js'

interface FakeDoc {
  _id: string
  token: string
  expiresAt: Date
}

function fakeDb(): Db {
  const docs = new Map<string, FakeDoc>()

  const collection = {
    async findOneAndUpdate(
      filter: { _id: string; expiresAt: { $lte: Date } },
      update: { $set: { token: string; expiresAt: Date } },
    ) {
      const existing = docs.get(filter._id)
      const expired = existing && existing.expiresAt.getTime() <= filter.expiresAt.$lte.getTime()

      if (existing && !expired) {
        const err = new Error('E11000 duplicate key error collection') as Error & { code: number }
        err.code = 11000
        throw err
      }

      const doc: FakeDoc = { _id: filter._id, token: update.$set.token, expiresAt: update.$set.expiresAt }
      docs.set(filter._id, doc)
      return { value: doc }
    },
    async deleteOne(filter: { _id: string; token: string }) {
      const existing = docs.get(filter._id)
      if (existing && existing.token === filter.token) {
        docs.delete(filter._id)
        return { deletedCount: 1 }
      }
      return { deletedCount: 0 }
    },
  }

  return { collection: () => collection } as unknown as Db
}

describe('mongodbLock (against a fake Db double, no real MongoDB required)', () => {
  it('grants the lock to the first acquirer and denies a second concurrent acquirer', async () => {
    const db = fakeDb()
    const lockA = mongodbLock(db)
    const lockB = mongodbLock(db)

    await expect(lockA.acquire('nightly-report', 5000)).resolves.toBe(true)
    await expect(lockB.acquire('nightly-report', 5000)).resolves.toBe(false)
  })

  it('lets another holder acquire the lock after release', async () => {
    const db = fakeDb()
    const lockA = mongodbLock(db)
    const lockB = mongodbLock(db)

    await lockA.acquire('nightly-report', 5000)
    await lockA.release('nightly-report')

    await expect(lockB.acquire('nightly-report', 5000)).resolves.toBe(true)
  })

  it('lets another holder acquire the lock once the TTL expires', async () => {
    const db = fakeDb()
    const lockA = mongodbLock(db)
    const lockB = mongodbLock(db)

    await lockA.acquire('short-lived', 50)
    await new Promise((resolve) => setTimeout(resolve, 150))

    await expect(lockB.acquire('short-lived', 5000)).resolves.toBe(true)
  })

  it('release() is a safe no-op when the caller never held the lock', async () => {
    const lock = mongodbLock(fakeDb())
    await expect(lock.release('never-acquired')).resolves.toBeUndefined()
  })

  it('a stale release from a holder whose TTL already expired does not evict the current holder', async () => {
    const db = fakeDb()
    const lockA = mongodbLock(db)
    const lockB = mongodbLock(db)
    const lockC = mongodbLock(db)

    await lockA.acquire('race', 50)
    await new Promise((resolve) => setTimeout(resolve, 150))
    await lockB.acquire('race', 5000)

    await lockA.release('race')

    await expect(lockC.acquire('race', 5000)).resolves.toBe(false)
  })

  it('keeps independent locks per key', async () => {
    const lock = mongodbLock(fakeDb())
    await expect(lock.acquire('key-a', 5000)).resolves.toBe(true)
    await expect(lock.acquire('key-b', 5000)).resolves.toBe(true)
  })
})
