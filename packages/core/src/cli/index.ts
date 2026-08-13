import { runDoctorCommand } from './commands/doctor.js'
import { runEnvExampleCommand } from './commands/env-example.js'

export async function runCli(argv: string[]): Promise<void> {
  const [command, ...rest] = argv
  let exitCode = 0

  switch (command) {
    case 'doctor':
      exitCode = await runDoctorCommand(rest)
      break
    case 'env:example':
      exitCode = await runEnvExampleCommand(rest)
      break
    default:
      console.log('Usage: api-kickstart <doctor|env:example> [--config <path>]')
      exitCode = command ? 1 : 0
  }

  process.exitCode = exitCode
}
