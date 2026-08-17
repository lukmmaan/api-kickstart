import { describe, expect, it } from 'vitest'
import { memoryLock } from './lock.js'

describe('memoryLock', () => {
  it('grants the lock to the first acquirer and denies a second concurrent acquirer', async () => {
    const lockA = memoryLock()
    const lockB = memoryLock()

    await expect(lockA.acquire('nightly-report', 5000)).resolves.toBe(true)
    await expect(lockB.acquire('nightly-report', 5000)).resolves.toBe(false)
  })

  it('lets another holder acquire the lock after release', async () => {
    const lockA = memoryLock()
    const lockB = memoryLock()

    await lockA.acquire('report-after-release', 5000)
    await lockA.release('report-after-release')

    await expect(lockB.acquire('report-after-release', 5000)).resolves.toBe(true)
  })

  it('lets another holder acquire the lock once the TTL expires', async () => {
    const lockA = memoryLock()
    const lockB = memoryLock()

    await lockA.acquire('short-lived', 50)
    await new Promise((resolve) => setTimeout(resolve, 150))

    await expect(lockB.acquire('short-lived', 5000)).resolves.toBe(true)
  })

  it('release() is a safe no-op when the caller never held the lock', async () => {
    const lock = memoryLock()
    await expect(lock.release('never-acquired')).resolves.toBeUndefined()
  })

  it('a stale release from a holder whose TTL already expired does not evict the current holder', async () => {
    const lockA = memoryLock()
    const lockB = memoryLock()
    const lockC = memoryLock()

    await lockA.acquire('race', 50)
    await new Promise((resolve) => setTimeout(resolve, 150))
    await lockB.acquire('race', 5000)

    await lockA.release('race')

    await expect(lockC.acquire('race', 5000)).resolves.toBe(false)
  })

  it('keeps independent locks per key', async () => {
    const lock = memoryLock()
    await expect(lock.acquire('key-a', 5000)).resolves.toBe(true)
    await expect(lock.acquire('key-b', 5000)).resolves.toBe(true)
  })
})
