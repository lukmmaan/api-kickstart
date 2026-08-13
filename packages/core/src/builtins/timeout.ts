import { RequestTimeout } from '../errors.js'
import type { Middleware } from '../types.js'
import { parseDurationMs } from './duration.js'

export interface TimeoutOptions {
  duration: string
}

export function timeout(options: TimeoutOptions): Middleware {
  const durationMs = parseDurationMs(options.duration)

  return async (_ctx, next) => {
    let timer: ReturnType<typeof setTimeout>
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new RequestTimeout(`Request exceeded ${options.duration}`)), durationMs)
    })

    try {
      await Promise.race([next(), timeoutPromise])
    } finally {
      clearTimeout(timer!)
    }
  }
}
