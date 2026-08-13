import mqttLib, { type MqttClient } from 'mqtt'
import type { BrokerAdapter, BrokerConsumeOptions } from 'api-kickstart'
import type { MqttOptions } from './types.js'

export type { MqttOptions }

export function mqtt(options: MqttOptions): BrokerAdapter {
  const client: MqttClient = mqttLib.connect(options.url)
  const handlers = new Map<string, BrokerConsumeOptions>()

  client.on('message', (topic, payload) => {
    const consumeOptions = handlers.get(topic)
    if (!consumeOptions) return
    void (async () => {
      const message = JSON.parse(payload.toString('utf8'))
      await consumeOptions.onMessage(message, { topic, attempt: 1 })
    })()
  })

  return {
    async publish(topic, message) {
      await new Promise<void>((resolve, reject) => {
        client.publish(topic, JSON.stringify(message), (err) => (err ? reject(err) : resolve()))
      })
    },

    consume(consumeOptions: BrokerConsumeOptions) {
      handlers.set(consumeOptions.topic, consumeOptions)
      client.subscribe(consumeOptions.topic)
    },

    async close() {
      await new Promise<void>((resolve) => client.end(false, {}, () => resolve()))
    },
  }
}
