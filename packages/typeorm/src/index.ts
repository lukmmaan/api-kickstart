import type { DbAdapter } from 'api-kickstart'

export function typeorm(client: unknown): DbAdapter {
  void client
  throw new Error('@kickstart/typeorm is not implemented yet. See the "Roadmap" section of the api-kickstart README.')
}
