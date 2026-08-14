import { Queue, Worker } from 'bullmq'
import type { BrokerAdapter, BrokerConsumeOptions } from '../../index.js'
import type { BullmqOptions } from './types.js'

export type { BullmqOptions }

export function bullmq(options: BullmqOptions): BrokerAdapter {
  const queues = new Map<string, Queue>()
  const workers: Worker[] = []

  function getQueue(topic: string): Queue {
    let queue = queues.get(topic)
    if (!queue) {
      queue = new Queue(topic, { connection: options.connection })
      queues.set(topic, queue)
    }
    return queue
  }

  return {
    async publish(topic, message) {
      await getQueue(topic).add(topic, message)
    },

    consume(consumeOptions: BrokerConsumeOptions) {
      const worker = new Worker(
        consumeOptions.topic,
        async (job) => {
          await consumeOptions.onMessage(job.data, { topic: consumeOptions.topic, attempt: job.attemptsMade + 1 })
        },
        { connection: options.connection, concurrency: consumeOptions.concurrency ?? 1 },
      )
      workers.push(worker)
    },

    async close() {
      await Promise.all(workers.map((w) => w.close()))
      await Promise.all([...queues.values()].map((q) => q.close()))
    },
  }
}
