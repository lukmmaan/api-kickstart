import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './index.js'
import { fakeFramework } from './test-helpers.js'
import type { Lock } from './types.js'

function fakeLock() {
  const held = new Set<string>()
  const acquireCalls: [string, number][] = []
  const releaseCalls: string[] = []
  const lock: Lock = {
    async acquire(key, ttlMs) {
      acquireCalls.push([key, ttlMs])
      if (held.has(key)) return false
      held.add(key)
      return true
    },
    async release(key) {
      releaseCalls.push(key)
      held.delete(key)
    },
  }
  return { lock, held, acquireCalls, releaseCalls }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('app.schedule()', () => {
  it('runs the handler on each interval tick, not immediately by default', async () => {
    const app = createApp({ framework: fakeFramework() })
    const calls: number[] = []
    app.schedule('tick', { interval: '1m' }, () => {
      calls.push(Date.now())
    })

    expect(calls).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls).toHaveLength(2)
  })

  it('runs immediately when runImmediately is true', async () => {
    const app = createApp({ framework: fakeFramework() })
    let count = 0
    app.schedule('tick', { interval: '1m', runImmediately: true }, () => {
      count += 1
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(count).toBe(1)
  })

  it('calls onError instead of throwing when the handler rejects', async () => {
    const app = createApp({ framework: fakeFramework() })
    const errors: unknown[] = []
    app.schedule(
      'failing-task',
      { interval: '1m', runImmediately: true, onError: (err) => errors.push(err) },
      () => {
        throw new Error('boom')
      },
    )

    await vi.advanceTimersByTimeAsync(0)
    expect(errors).toHaveLength(1)
    expect((errors[0] as Error).message).toBe('boom')
  })

  it('stops firing after app.close()', async () => {
    const app = createApp({ framework: fakeFramework() })
    let count = 0
    app.schedule('tick', { interval: '1m' }, () => {
      count += 1
    })

    await vi.advanceTimersByTimeAsync(60_000)
    expect(count).toBe(1)

    await app.close()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(count).toBe(1)
  })

  it('supports multiple independent scheduled tasks', async () => {
    const app = createApp({ framework: fakeFramework() })
    let a = 0
    let b = 0
    app.schedule('a', { interval: '1m' }, () => { a += 1 })
    app.schedule('b', { interval: '2m' }, () => { b += 1 })

    await vi.advanceTimersByTimeAsync(120_000)
    expect(a).toBe(2)
    expect(b).toBe(1)
  })

  it('acquires the lock before running and releases it after, defaulting the TTL to the interval', async () => {
    const app = createApp({ framework: fakeFramework() })
    const { lock, acquireCalls, releaseCalls } = fakeLock()
    let count = 0
    app.schedule('nightly-report', { interval: '1m', runImmediately: true, lock }, () => { count += 1 })

    await vi.advanceTimersByTimeAsync(0)

    expect(count).toBe(1)
    expect(acquireCalls).toEqual([['schedule:nightly-report', 60_000]])
    expect(releaseCalls).toEqual(['schedule:nightly-report'])
  })

  it('skips the handler entirely when another holder already has the lock', async () => {
    const app = createApp({ framework: fakeFramework() })
    const { lock, held, releaseCalls } = fakeLock()
    held.add('schedule:nightly-report')
    let count = 0
    app.schedule('nightly-report', { interval: '1m', runImmediately: true, lock }, () => { count += 1 })

    await vi.advanceTimersByTimeAsync(0)

    expect(count).toBe(0)
    expect(releaseCalls).toEqual([])
  })

  it('still releases the lock, and still calls onError, when the handler throws', async () => {
    const app = createApp({ framework: fakeFramework() })
    const { lock, releaseCalls } = fakeLock()
    const errors: unknown[] = []
    app.schedule(
      'nightly-report',
      { interval: '1m', runImmediately: true, lock, onError: (err) => errors.push(err) },
      () => {
        throw new Error('boom')
      },
    )

    await vi.advanceTimersByTimeAsync(0)

    expect(errors).toHaveLength(1)
    expect(releaseCalls).toEqual(['schedule:nightly-report'])
  })

  it('respects a custom lockTtlMs instead of defaulting to the interval', async () => {
    const app = createApp({ framework: fakeFramework() })
    const { lock, acquireCalls } = fakeLock()
    app.schedule('nightly-report', { interval: '1m', runImmediately: true, lock, lockTtlMs: 5000 }, () => {})

    await vi.advanceTimersByTimeAsync(0)

    expect(acquireCalls).toEqual([['schedule:nightly-report', 5000]])
  })
})
