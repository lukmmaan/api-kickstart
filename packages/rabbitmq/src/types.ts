import type { OutboxStore } from 'api-kickstart'

export interface RabbitmqOptions {
  url: string
  exchange?: string
  exchangeType?: 'topic' | 'direct' | 'fanout'
  outbox?: OutboxStore
  attemptHeader?: string
}
