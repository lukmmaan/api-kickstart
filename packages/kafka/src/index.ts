import type { BrokerAdapter } from 'api-kickstart'

export interface KafkaOptions {
  [key: string]: unknown
}

export function kafka(options: Record<string, unknown>): BrokerAdapter {
  void options
  throw new Error('@kickstart/kafka is not implemented yet. See the "Roadmap" section of the api-kickstart README.')
}
