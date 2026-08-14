import amqp, { type ConsumeMessage } from 'amqplib'
import { startOutboxRelay, type BrokerAdapter, type BrokerConsumeOptions } from '../../index.js'
import { ATTEMPT_HEADER, DEFAULT_EXCHANGE_TYPE, DEFAULT_PREFETCH } from './constants.js'
import type { RabbitmqOptions } from './types.js'

export type { RabbitmqOptions }

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>

export function rabbitmq(options: RabbitmqOptions): BrokerAdapter {
  const exchange = options.exchange ?? ''
  const exchangeType = options.exchangeType ?? DEFAULT_EXCHANGE_TYPE
  const attemptHeader = options.attemptHeader ?? ATTEMPT_HEADER

  let connectionPromise: Promise<AmqpConnection> | null = null
  let channelPromise: Promise<AmqpChannel> | null = null

  async function getChannel(): Promise<AmqpChannel> {
    if (!connectionPromise) {
      connectionPromise = amqp.connect(options.url)
    }
    const connection = connectionPromise
    if (!channelPromise) {
      channelPromise = connection.then(async (conn) => {
        const channel = await conn.createChannel()
        if (exchange) await channel.assertExchange(exchange, exchangeType, { durable: true })
        return channel
      })
    }
    return channelPromise
  }

  async function publishNow(topic: string, message: unknown): Promise<void> {
    const channel = await getChannel()
    const payload = Buffer.from(JSON.stringify(message))
    if (exchange) {
      channel.publish(exchange, topic, payload, { persistent: true })
    } else {
      channel.sendToQueue(topic, payload, { persistent: true })
    }
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
        const channel = await getChannel()
        await channel.prefetch(consumeOptions.concurrency ?? DEFAULT_PREFETCH)
        const queueName = consumeOptions.group ? `${consumeOptions.topic}.${consumeOptions.group}` : consumeOptions.topic
        await channel.assertQueue(queueName, { durable: true })
        if (exchange) await channel.bindQueue(queueName, exchange, consumeOptions.topic)

        await channel.consume(queueName, (msg: ConsumeMessage | null) => {
          if (!msg) return
          void (async () => {
            try {
              const message = JSON.parse(msg.content.toString('utf8'))
              const attempt = (msg.properties.headers?.[attemptHeader] as number | undefined) ?? 1
              await consumeOptions.onMessage(message, { topic: consumeOptions.topic, attempt })
              channel.ack(msg)
            } catch {
              channel.nack(msg, false, false)
            }
          })()
        })
      })()
    },

    async close() {
      stopRelay?.()
      const channel = channelPromise ? await channelPromise : null
      await channel?.close()
      const connection = connectionPromise ? await connectionPromise : null
      await connection?.close()
    },
  }
}
