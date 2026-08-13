import type { DbAdapter } from 'api-kickstart'

export function sequelize(client: unknown): DbAdapter {
  void client
  throw new Error('@kickstart/sequelize is not implemented yet. See the "Roadmap" section of the api-kickstart README.')
}
