import type { OutboxStore } from '../../index.js'

export interface KafkaOptions {
  brokers: string[]
  clientId?: string
  groupId?: string
  outbox?: OutboxStore
}
