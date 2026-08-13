import type { DbAdapter } from 'api-kickstart'

export function mongodb(client: unknown): DbAdapter {
  void client
  throw new Error('@kickstart/mongodb is not implemented yet. See the "Roadmap" section of the api-kickstart README.')
}
