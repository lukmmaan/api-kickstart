import type { BrokerAdapter } from 'api-kickstart'

export interface RedisStreamOptions {
  [key: string]: unknown
}

export function redisStream(options: Record<string, unknown>): BrokerAdapter {
  void options
  throw new Error('@kickstart/redis-stream is not implemented yet. See the "Roadmap" section of the api-kickstart README.')
}
