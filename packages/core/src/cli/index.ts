import { runAddCommand } from './commands/add.js'
import { runDoctorCommand } from './commands/doctor.js'
import { runEnvExampleCommand } from './commands/env-example.js'
import { runInitCommand } from './commands/init.js'
import { runRoutesCommand } from './commands/routes.js'
import { runOpenapiGenerateCommand } from './commands/openapi-generate.js'

export async function runCli(argv: string[]): Promise<void> {
  const [command, ...rest] = argv
  let exitCode = 0

  switch (command) {
    case 'init':
      exitCode = await runInitCommand(rest)
      break
    case 'add':
      exitCode = await runAddCommand(rest)
      break
    case 'doctor':
      exitCode = await runDoctorCommand(rest)
      break
    case 'env:example':
      exitCode = await runEnvExampleCommand(rest)
      break
    case 'routes':
      exitCode = await runRoutesCommand(rest)
      break
    case 'openapi:generate':
      exitCode = await runOpenapiGenerateCommand(rest)
      break
    default:
      console.log(
        'Usage: api-kickstart <init|add [category]|doctor|env:example|routes|openapi:generate> [--config <path>]',
      )
      exitCode = command ? 1 : 0
  }

  process.exitCode = exitCode
}
