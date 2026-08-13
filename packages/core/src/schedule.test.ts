import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from './index.js'
import { fakeFramework } from './test-helpers.js'

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
})
