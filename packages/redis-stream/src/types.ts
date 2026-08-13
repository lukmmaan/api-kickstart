export interface RedisStreamOptions {
  url?: string
  consumerGroup?: string
  blockTimeoutMs?: number
  payloadField?: string
}
