import type { OutboxStore } from '../../index.js'

export interface RabbitmqOptions {
  url: string
  exchange?: string
  exchangeType?: 'topic' | 'direct' | 'fanout'
  outbox?: OutboxStore
  attemptHeader?: string
}
