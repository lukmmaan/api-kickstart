import { runDoctorChecks } from '../../doctor.js'
import { extractFlag } from '../flags.js'
import { loadConfig, resolveApp } from '../config.js'

export async function runDoctorCommand(args: string[]): Promise<number> {
  const configPath = extractFlag(args, '--config')
  const config = await loadConfig(configPath)
  const app = await resolveApp(config)

  const checks = runDoctorChecks(app)
  let failed = 0

  for (const check of checks) {
    console.log(`[${check.passed ? 'PASS' : 'FAIL'}] ${check.name}: ${check.message}`)
    if (!check.passed) failed += 1
  }

  console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
  return failed > 0 ? 1 : 0
}
