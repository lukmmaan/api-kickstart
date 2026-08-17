import { findCategory, STACK_CATEGORIES } from '../stack.js'
import { runStackWizard } from './stack-runner.js'

export async function runAddCommand(args: string[]): Promise<number> {
  const [categoryId] = args

  if (!categoryId) {
    console.log('api-kickstart add — pick more pieces of your stack to install.')
    return runStackWizard(STACK_CATEGORIES, process.cwd())
  }

  const category = findCategory(categoryId)
  if (!category) {
    console.error(
      `add: unknown category "${categoryId}". Choose one of: ${STACK_CATEGORIES.map((c) => c.id).join(', ')} (or run "api-kickstart add" with no argument to pick from all of them).`,
    )
    return 1
  }

  return runStackWizard([category], process.cwd())
}
