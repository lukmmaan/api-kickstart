import { connect, StringCodec, type NatsConnection, type Subscription } from 'nats'
import type { BrokerAdapter, BrokerConsumeOptions } from 'api-kickstart'
import type { NatsOptions } from './types.js'

export type { NatsOptions }

export function nats(options: NatsOptions): BrokerAdapter {
  const codec = StringCodec()
  let connectionPromise: Promise<NatsConnection> | null = null
  const subscriptions: Subscription[] = []

  async function getConnection(): Promise<NatsConnection> {
    if (!connectionPromise) connectionPromise = connect({ servers: options.servers })
    return connectionPromise
  }

  return {
    async publish(topic, message) {
      const connection = await getConnection()
      connection.publish(topic, codec.encode(JSON.stringify(message)))
    },

    consume(consumeOptions: BrokerConsumeOptions) {
      void (async () => {
        const connection = await getConnection()
        const subscription = connection.subscribe(consumeOptions.topic, { queue: consumeOptions.group })
        subscriptions.push(subscription)
        for await (const msg of subscription) {
          const payload = JSON.parse(codec.decode(msg.data))
          await consumeOptions.onMessage(payload, { topic: consumeOptions.topic, attempt: 1 })
        }
      })()
    },

    async close() {
      subscriptions.forEach((s) => s.unsubscribe())
      const connection = connectionPromise ? await connectionPromise : null
      await connection?.close()
    },
  }
}
