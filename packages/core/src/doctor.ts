import type { App } from './index.js'

export interface DoctorCheck {
  name: string
  passed: boolean
  message: string
}

const EXAMPLE_SECRET_VALUES = new Set(['changeme', 'secret', 'your-secret-here', 'example'])

export function runDoctorChecks(app: App, env: Record<string, string | undefined> = process.env): DoctorCheck[] {
  const checks: DoctorCheck[] = []
  const diagnostics = app.diagnostics()

  const jwtSecret = env.JWT_SECRET
  if (jwtSecret !== undefined) {
    const longEnough = jwtSecret.length >= 32
    const notExample = !EXAMPLE_SECRET_VALUES.has(jwtSecret.toLowerCase())
    checks.push({
      name: 'jwt-secret-strength',
      passed: longEnough && notExample,
      message:
        longEnough && notExample
          ? 'JWT_SECRET is at least 32 bytes and not a known placeholder'
          : 'JWT_SECRET should be at least 32 bytes and not a placeholder value',
    })
  }

  const routesWithoutExplicitAuth = diagnostics.routes.filter((r) => r.auth === undefined)
  checks.push({
    name: 'explicit-route-auth',
    passed: routesWithoutExplicitAuth.length === 0,
    message:
      routesWithoutExplicitAuth.length === 0
        ? 'Every route declares auth explicitly'
        : `Route(s) missing an explicit auth: true/false: ${routesWithoutExplicitAuth.map((r) => `${r.method} ${r.path}`).join(', ')}`,
  })

  const scopedResources = Object.entries(diagnostics.scopeMap)
  const resourcesWithoutRoles = scopedResources.filter(([, roles]) => Object.keys(roles).length === 0)
  checks.push({
    name: 'scope-roles-defined',
    passed: resourcesWithoutRoles.length === 0,
    message:
      resourcesWithoutRoles.length === 0
        ? 'Every scoped resource defines at least one role'
        : `Resource(s) with no roles defined, denying everyone: ${resourcesWithoutRoles.map(([name]) => name).join(', ')}`,
  })

  checks.push({
    name: 'scope-audit-enabled',
    passed: diagnostics.scopeAudit !== 'off',
    message:
      diagnostics.scopeAudit !== 'off'
        ? `scopeAudit is "${diagnostics.scopeAudit}"`
        : 'scopeAudit is "off" — turn it on in staging to catch queries that bypass scope',
  })

  const loginRoutes = diagnostics.routes.filter((r) => /login/i.test(r.path))
  const unrateLimitedLogin = loginRoutes.filter((r) => !r.rateLimit)
  checks.push({
    name: 'auth-endpoints-rate-limited',
    passed: loginRoutes.length === 0 || unrateLimitedLogin.length === 0,
    message:
      unrateLimitedLogin.length === 0
        ? 'Login route(s) have rate limiting configured'
        : `Login route(s) without rateLimit: ${unrateLimitedLogin.map((r) => `${r.method} ${r.path}`).join(', ')}`,
  })

  const gracefulShutdownWired = process.listenerCount('SIGTERM') > 0
  checks.push({
    name: 'graceful-shutdown-wired',
    passed: gracefulShutdownWired,
    message: gracefulShutdownWired
      ? 'A SIGTERM handler is registered'
      : 'No SIGTERM handler registered — call gracefulShutdown(app) before app.listen()',
  })

  return checks
}
