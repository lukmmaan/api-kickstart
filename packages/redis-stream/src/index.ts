import { Redis } from 'ioredis'
import type { BrokerAdapter, BrokerConsumeOptions } from 'api-kickstart'
import type { RedisStreamOptions } from './types.js'

export type { RedisStreamOptions }

type StreamEntries = [id: string, fields: string[]][]
type StreamReadResult = [stream: string, entries: StreamEntries][] | null

export function redisStream(options: RedisStreamOptions = {}): BrokerAdapter {
  const url = options.url ?? 'redis://localhost:6379'
  const publisher = new Redis(url)
  const consumerClient = new Redis(url)
  const activeConsumers: { stop: boolean }[] = []

  return {
    async publish(topic, message) {
      await publisher.xadd(topic, '*', 'payload', JSON.stringify(message))
    },

    consume(consumeOptions: BrokerConsumeOptions) {
      const group = consumeOptions.group ?? options.consumerGroup ?? 'api-kickstart'
      const consumerName = `${group}-${process.pid}-${Math.random().toString(36).slice(2)}`
      const state = { stop: false }
      activeConsumers.push(state)

      void (async () => {
        try {
          await consumerClient.xgroup('CREATE', consumeOptions.topic, group, '0', 'MKSTREAM')
        } catch (err) {
          if (!(err instanceof Error) || !err.message.includes('BUSYGROUP')) throw err
        }

        while (!state.stop) {
          const response = (await consumerClient.xreadgroup(
            'GROUP',
            group,
            consumerName,
            'COUNT',
            consumeOptions.concurrency ?? 1,
            'BLOCK',
            5000,
            'STREAMS',
            consumeOptions.topic,
            '>',
          )) as StreamReadResult

          if (!response) continue

          for (const [, entries] of response) {
            for (const [id, fields] of entries) {
              const payloadIndex = fields.indexOf('payload')
              const raw = payloadIndex >= 0 ? fields[payloadIndex + 1] : undefined
              const message = raw ? JSON.parse(raw) : null
              try {
                await consumeOptions.onMessage(message, { topic: consumeOptions.topic, attempt: 1 })
                await consumerClient.xack(consumeOptions.topic, group, id)
              } catch {}
            }
          }
        }
      })()
    },

    async close() {
      activeConsumers.forEach((s) => {
        s.stop = true
      })
      await publisher.quit()
      await consumerClient.quit()
    },
  }
}
