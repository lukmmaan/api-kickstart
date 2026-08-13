import type { FrameworkAdapter } from 'api-kickstart'

export interface HonoAdapterOptions {
  [key: string]: unknown
}

export function hono(options: Record<string, unknown> = {}): FrameworkAdapter {
  void options
  throw new Error('@kickstart/hono is not implemented yet. See the "Roadmap" section of the api-kickstart README.')
}
