import { createApp, type App, type CreateAppOptions } from './index.js'
import type { BrokerAdapter, DbAdapter } from './types.js'

export function createTestApp(options: CreateAppOptions): App {
  return createApp(options)
}

export interface MemoryBroker extends BrokerAdapter {
  published: { topic: string; message: unknown }[]
}

export function memoryBroker(): MemoryBroker {
  const published: { topic: string; message: unknown }[] = []
  return {
    published,
    async publish(topic, message) {
      published.push({ topic, message })
    },
  }
}

export function runDbConformance(factory: () => DbAdapter): void {
  const adapter = factory()

  if (!adapter.client) {
    throw new Error('DbAdapter.client must be set')
  }
  if (typeof adapter.translateScope !== 'function') {
    throw new Error('DbAdapter.translateScope must be a function')
  }
  if (typeof adapter.normalizeError !== 'function') {
    throw new Error('DbAdapter.normalizeError must be a function')
  }

  const translated = adapter.translateScope({ ok: true })
  if (translated === undefined) {
    throw new Error('DbAdapter.translateScope must return a value')
  }

  const normalized = adapter.normalizeError(new Error('not a real db error'))
  if (normalized !== null && !(normalized instanceof Error)) {
    throw new Error('DbAdapter.normalizeError must return an Error or null')
  }
}
