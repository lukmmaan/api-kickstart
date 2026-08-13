import type { BrokerAdapter } from 'api-kickstart'

export interface SqsOptions {
  [key: string]: unknown
}

export function sqs(options: Record<string, unknown>): BrokerAdapter {
  void options
  throw new Error('@kickstart/sqs is not implemented yet. See the "Roadmap" section of the api-kickstart README.')
}
