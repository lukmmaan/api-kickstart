export interface RabbitmqOptions {
  url: string
  exchange?: string
  exchangeType?: 'topic' | 'direct' | 'fanout'
  outbox?: boolean
}
