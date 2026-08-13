import type { FrameworkAdapter } from 'api-kickstart'

export interface NestAdapterOptions {
  [key: string]: unknown
}

export function nest(options: Record<string, unknown> = {}): FrameworkAdapter {
  void options
  throw new Error('@kickstart/nest is not implemented yet. See the "Roadmap" section of the api-kickstart README.')
}
