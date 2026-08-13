export interface HealthCheckOptions {
  path?: string
  checks?: Record<string, () => Promise<boolean>>
}

export interface HealthCheckResult {
  status: 'ok' | 'degraded'
  checks: Record<string, boolean>
}

export async function runHealthChecks(
  dbHealthcheck: (() => Promise<boolean>) | undefined,
  customChecks: Record<string, () => Promise<boolean>>,
): Promise<HealthCheckResult> {
  const checks: Record<string, boolean> = {}

  if (dbHealthcheck) {
    checks.db = await dbHealthcheck().catch(() => false)
  }

  for (const [name, check] of Object.entries(customChecks)) {
    checks[name] = await check().catch(() => false)
  }

  const status = Object.values(checks).every(Boolean) ? 'ok' : 'degraded'
  return { status, checks }
}
