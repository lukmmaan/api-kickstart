import { DeleteMessageCommand, ReceiveMessageCommand, SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import type { BrokerAdapter, BrokerConsumeOptions } from 'api-kickstart'
import { DEFAULT_CONCURRENCY, MAX_MESSAGES_PER_POLL, WAIT_TIME_SECONDS } from './constants.js'
import type { SqsOptions } from './types.js'

export type { SqsOptions }

export function sqs(options: SqsOptions = {}): BrokerAdapter {
  const client = new SQSClient({ region: options.region, ...options.clientConfig })
  const waitTimeSeconds = options.waitTimeSeconds ?? WAIT_TIME_SECONDS
  const stopFlags: { stop: boolean }[] = []

  return {
    async publish(topic, message) {
      await client.send(new SendMessageCommand({ QueueUrl: topic, MessageBody: JSON.stringify(message) }))
    },

    consume(consumeOptions: BrokerConsumeOptions) {
      const state = { stop: false }
      stopFlags.push(state)

      void (async () => {
        while (!state.stop) {
          const response = await client.send(
            new ReceiveMessageCommand({
              QueueUrl: consumeOptions.topic,
              MaxNumberOfMessages: Math.min(consumeOptions.concurrency ?? DEFAULT_CONCURRENCY, MAX_MESSAGES_PER_POLL),
              WaitTimeSeconds: waitTimeSeconds,
              MessageSystemAttributeNames: ['ApproximateReceiveCount'],
            }),
          )

          for (const msg of response.Messages ?? []) {
            try {
              const payload = msg.Body ? JSON.parse(msg.Body) : null
              const attempt = Number(msg.Attributes?.ApproximateReceiveCount ?? '1')
              await consumeOptions.onMessage(payload, { topic: consumeOptions.topic, attempt })
              if (msg.ReceiptHandle) {
                await client.send(new DeleteMessageCommand({ QueueUrl: consumeOptions.topic, ReceiptHandle: msg.ReceiptHandle }))
              }
            } catch {}
          }
        }
      })()
    },

    async close() {
      stopFlags.forEach((s) => {
        s.stop = true
      })
    },
  }
}
