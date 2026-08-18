import { STACK_CATEGORIES } from '../stack.js'
import { runScaffoldWizard } from './scaffold-runner.js'
import { runStackWizard } from './stack-runner.js'

export async function runInitCommand(_args: string[]): Promise<number> {
  console.log("api-kickstart init — pick the pieces of your stack; only what you choose gets installed.")

  const selections: Record<string, string[]> = {}
  const exitCode = await runStackWizard(STACK_CATEGORIES, process.cwd(), {
    onSelections: (picked) => Object.assign(selections, picked),
  })
  if (exitCode !== 0) return exitCode

  const scaffoldExitCode = await runScaffoldWizard(selections, process.cwd())
  if (scaffoldExitCode !== 0) return scaffoldExitCode

  console.log('\nDone. Run `npx api-kickstart add` any time later to add more.')
  return 0
}
