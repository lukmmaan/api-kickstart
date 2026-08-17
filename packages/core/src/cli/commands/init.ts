import { STACK_CATEGORIES } from '../stack.js'
import { runStackWizard } from './stack-runner.js'

export async function runInitCommand(_args: string[]): Promise<number> {
  console.log("api-kickstart init — pick the pieces of your stack; only what you choose gets installed.")

  const exitCode = await runStackWizard(STACK_CATEGORIES, process.cwd())
  if (exitCode === 0) {
    console.log('\nDone. Run `npx api-kickstart add` any time later to add more.')
  }
  return exitCode
}
