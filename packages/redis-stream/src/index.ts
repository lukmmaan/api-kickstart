import { Redis } from 'ioredis'
import type { BrokerAdapter, BrokerConsumeOptions } from 'api-kickstart'
import { BLOCK_TIMEOUT_MS, BUSY_GROUP_ERROR_SUBSTRING, DEFAULT_CONCURRENCY, DEFAULT_CONSUMER_GROUP, DEFAULT_REDIS_URL, PAYLOAD_FIELD } from './constants.js'
import type { RedisStreamOptions } from './types.js'

export type { RedisStreamOptions }

type StreamEntries = [id: string, fields: string[]][]
type StreamReadResult = [stream: string, entries: StreamEntries][] | null

export function redisStream(options: RedisStreamOptions = {}): BrokerAdapter {
  const url = options.url ?? DEFAULT_REDIS_URL
  const payloadField = options.payloadField ?? PAYLOAD_FIELD
  const blockTimeoutMs = options.blockTimeoutMs ?? BLOCK_TIMEOUT_MS
  const publisher = new Redis(url)
  const consumerClient = new Redis(url)
  const activeConsumers: { stop: boolean }[] = []

  return {
    async publish(topic, message) {
      await publisher.xadd(topic, '*', payloadField, JSON.stringify(message))
    },

    consume(consumeOptions: BrokerConsumeOptions) {
      const group = consumeOptions.group ?? options.consumerGroup ?? DEFAULT_CONSUMER_GROUP
      const consumerName = `${group}-${process.pid}-${Math.random().toString(36).slice(2)}`
      const state = { stop: false }
      activeConsumers.push(state)

      void (async () => {
        try {
          await consumerClient.xgroup('CREATE', consumeOptions.topic, group, '0', 'MKSTREAM')
        } catch (err) {
          if (!(err instanceof Error) || !err.message.includes(BUSY_GROUP_ERROR_SUBSTRING)) throw err
        }

        while (!state.stop) {
          const response = (await consumerClient.xreadgroup(
            'GROUP',
            group,
            consumerName,
            'COUNT',
            consumeOptions.concurrency ?? DEFAULT_CONCURRENCY,
            'BLOCK',
            blockTimeoutMs,
            'STREAMS',
            consumeOptions.topic,
            '>',
          )) as StreamReadResult

          if (!response) continue

          for (const [, entries] of response) {
            for (const [id, fields] of entries) {
              const payloadIndex = fields.indexOf(payloadField)
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
