import type { BrokerAdapter } from 'api-kickstart'

export interface MqttOptions {
  [key: string]: unknown
}

export function mqtt(options: Record<string, unknown>): BrokerAdapter {
  void options
  throw new Error('@kickstart/mqtt is not implemented yet. See the "Roadmap" section of the api-kickstart README.')
}
