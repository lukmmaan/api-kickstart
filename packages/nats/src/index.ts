import type { BrokerAdapter } from 'api-kickstart'

export interface NatsOptions {
  [key: string]: unknown
}

export function nats(options: Record<string, unknown>): BrokerAdapter {
  void options
  throw new Error('@kickstart/nats is not implemented yet. See the "Roadmap" section of the api-kickstart README.')
}
