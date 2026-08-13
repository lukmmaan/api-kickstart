import type { DbAdapter } from 'api-kickstart'

export function knex(client: unknown): DbAdapter {
  void client
  throw new Error('@kickstart/knex is not implemented yet. See the "Roadmap" section of the api-kickstart README.')
}
