import type { OutboxStore } from 'api-kickstart'

export interface KafkaOptions {
  brokers: string[]
  clientId?: string
  groupId?: string
  outbox?: OutboxStore
}
