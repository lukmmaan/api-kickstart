import { Kafka, type Consumer, type Producer } from 'kafkajs'
import { startOutboxRelay, type BrokerAdapter, type BrokerConsumeOptions } from 'api-kickstart'
import { DEFAULT_CLIENT_ID, DEFAULT_CONCURRENCY, DEFAULT_GROUP_ID } from './constants.js'
import type { KafkaOptions } from './types.js'

export type { KafkaOptions }

export function kafka(options: KafkaOptions): BrokerAdapter {
  const client = new Kafka({ clientId: options.clientId ?? DEFAULT_CLIENT_ID, brokers: options.brokers })
  let producer: Producer | null = null
  const consumers: Consumer[] = []

  async function getProducer(): Promise<Producer> {
    if (!producer) {
      producer = client.producer()
      await producer.connect()
    }
    return producer
  }

  async function publishNow(topic: string, message: unknown): Promise<void> {
    const activeProducer = await getProducer()
    await activeProducer.send({ topic, messages: [{ value: JSON.stringify(message) }] })
  }

  const stopRelay = options.outbox ? startOutboxRelay(options.outbox, publishNow) : null

  return {
    async publish(topic, message, opts) {
      if (options.outbox) {
        await options.outbox.save({ topic, message }, opts?.tx)
        return
      }
      await publishNow(topic, message)
    },

    consume(consumeOptions: BrokerConsumeOptions) {
      void (async () => {
        const consumer = client.consumer({ groupId: consumeOptions.group ?? options.groupId ?? DEFAULT_GROUP_ID })
        consumers.push(consumer)
        await consumer.connect()
        await consumer.subscribe({ topic: consumeOptions.topic, fromBeginning: false })
        await consumer.run({
          partitionsConsumedConcurrently: consumeOptions.concurrency ?? DEFAULT_CONCURRENCY,
          eachMessage: async ({ message }) => {
            const payload = message.value ? JSON.parse(message.value.toString('utf8')) : null
            await consumeOptions.onMessage(payload, { topic: consumeOptions.topic, attempt: 1 })
          },
        })
      })()
    },

    async close() {
      stopRelay?.()
      await producer?.disconnect()
      await Promise.all(consumers.map((c) => c.disconnect()))
    },
  }
}
