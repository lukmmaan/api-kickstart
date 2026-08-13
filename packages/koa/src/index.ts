import type { FrameworkAdapter } from 'api-kickstart'

export interface KoaAdapterOptions {
  [key: string]: unknown
}

export function koa(options: Record<string, unknown> = {}): FrameworkAdapter {
  void options
  throw new Error('@kickstart/koa is not implemented yet. See the "Roadmap" section of the api-kickstart README.')
}
