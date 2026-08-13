import type { DispatchHandler, FrameworkAdapter } from './types.js'

export function fakeFramework(): FrameworkAdapter {
  let handler: DispatchHandler | null = null
  return {
    name: 'fake',
    onRequest(h) {
      handler = h
    },
    listen() {
      return null
    },
    handler() {
      return handler
    },
    async close() {},
  }
}
