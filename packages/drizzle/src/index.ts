import type { DbAdapter } from 'api-kickstart'

export function drizzle(client: unknown): DbAdapter {
  void client
  throw new Error('@kickstart/drizzle is not implemented yet. See the "Roadmap" section of the api-kickstart README.')
}
