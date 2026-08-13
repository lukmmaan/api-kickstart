import { extractFlag } from '../flags.js'
import { loadConfig, resolveApp } from '../config.js'

function formatAuth(auth: boolean | string | string[] | undefined): string {
  if (auth === undefined) return '?'
  if (auth === false) return '-'
  if (auth === true) return 'yes'
  return Array.isArray(auth) ? auth.join(',') : auth
}

export async function runRoutesCommand(args: string[]): Promise<number> {
  const configPath = extractFlag(args, '--config')
  const config = await loadConfig(configPath)
  const app = await resolveApp(config)

  const routes = app.diagnostics().routes
  const rows = routes.map((route) => ({
    method: route.method,
    path: route.path,
    auth: formatAuth(route.auth),
    roles: route.roles?.join(',') ?? '-',
    scope: route.scope ?? '-',
  }))

  const widths = {
    method: Math.max(6, ...rows.map((r) => r.method.length)),
    path: Math.max(4, ...rows.map((r) => r.path.length)),
    auth: Math.max(4, ...rows.map((r) => r.auth.length)),
    roles: Math.max(5, ...rows.map((r) => r.roles.length)),
    scope: Math.max(5, ...rows.map((r) => r.scope.length)),
  }

  const header = { method: 'METHOD', path: 'PATH', auth: 'AUTH', roles: 'ROLES', scope: 'SCOPE' }
  const pad = (value: string, width: number) => value.padEnd(width)
  const printRow = (row: typeof header) =>
    console.log(`${pad(row.method, widths.method)}  ${pad(row.path, widths.path)}  ${pad(row.auth, widths.auth)}  ${pad(row.roles, widths.roles)}  ${row.scope}`)

  printRow(header)
  for (const row of rows) printRow(row)
  console.log(`\n${rows.length} route(s)`)

  return 0
}
