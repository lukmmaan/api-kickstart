import type { BrokerAdapter } from 'api-kickstart'

export interface PubsubOptions {
  [key: string]: unknown
}

export function pubsub(options: Record<string, unknown>): BrokerAdapter {
  void options
  throw new Error('@kickstart/pubsub is not implemented yet. See the "Roadmap" section of the api-kickstart README.')
}
