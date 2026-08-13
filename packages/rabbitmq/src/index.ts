import type { BrokerAdapter } from 'api-kickstart'

export interface RabbitmqOptions {
  [key: string]: unknown
}

export function rabbitmq(options: Record<string, unknown>): BrokerAdapter {
  void options
  throw new Error('@kickstart/rabbitmq is not implemented yet. See the "Roadmap" section of the api-kickstart README.')
}
