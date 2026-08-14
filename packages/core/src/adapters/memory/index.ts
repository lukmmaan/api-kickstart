import type { BrokerAdapter, BrokerConsumeOptions } from '../../index.js'

export interface MemoryBrokerOptions {
  deliverOnPublish?: boolean
}

interface PublishedMessage {
  topic: string
  message: unknown
}

export interface MemoryBrokerAdapter extends BrokerAdapter {
  published: PublishedMessage[]
}

export function memoryBroker(options: MemoryBrokerOptions = {}): MemoryBrokerAdapter {
  const deliverOnPublish = options.deliverOnPublish ?? true
  const published: PublishedMessage[] = []
  const consumers = new Map<string, BrokerConsumeOptions[]>()

  return {
    published,

    async publish(topic, message) {
      published.push({ topic, message })
      if (!deliverOnPublish) return
      const handlers = consumers.get(topic) ?? []
      for (const consumeOptions of handlers) {
        await consumeOptions.onMessage(message, { attempt: 1, topic })
      }
    },

    consume(options) {
      const existing = consumers.get(options.topic) ?? []
      existing.push(options)
      consumers.set(options.topic, existing)
    },

    async close() {
      consumers.clear()
    },
  }
}
