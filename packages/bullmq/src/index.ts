import type { BrokerAdapter } from 'api-kickstart'

export interface BullmqOptions {
  [key: string]: unknown
}

export function bullmq(options: Record<string, unknown>): BrokerAdapter {
  void options
  throw new Error('@kickstart/bullmq is not implemented yet. See the "Roadmap" section of the api-kickstart README.')
}
