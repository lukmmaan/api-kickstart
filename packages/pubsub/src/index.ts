import { PubSub, type Message } from '@google-cloud/pubsub'
import type { BrokerAdapter, BrokerConsumeOptions } from 'api-kickstart'
import type { PubsubOptions } from './types.js'

export type { PubsubOptions }

export function pubsub(options: PubsubOptions = {}): BrokerAdapter {
  const client = new PubSub({ projectId: options.projectId, ...options.clientConfig })

  return {
    async publish(topic, message) {
      await client.topic(topic).publishMessage({ json: message })
    },

    consume(consumeOptions: BrokerConsumeOptions) {
      const subscriptionName = consumeOptions.group
        ? `${consumeOptions.topic}-${consumeOptions.group}`
        : consumeOptions.topic
      const subscription = client.subscription(subscriptionName)

      subscription.on('message', (msg: Message) => {
        void (async () => {
          try {
            const payload = JSON.parse(msg.data.toString('utf8'))
            await consumeOptions.onMessage(payload, { topic: consumeOptions.topic, attempt: msg.deliveryAttempt ?? 1 })
            msg.ack()
          } catch {
            msg.nack()
          }
        })()
      })
    },

    async close() {
      await client.close()
    },
  }
}
