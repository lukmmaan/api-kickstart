import type { DbAdapter } from 'api-kickstart'

export function mongoose(client: unknown): DbAdapter {
  void client
  throw new Error('@kickstart/mongoose is not implemented yet. See the "Roadmap" section of the api-kickstart README.')
}
