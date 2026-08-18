import { installPackages } from '../install.js'
import { createPrompter, promptCategory, type Questioner } from '../prompt.js'
import { dedupePackages, resolvePackages, type StackCategory, type StackPackage } from '../stack.js'

export interface StackWizardOptions {
  /** Injectable for tests — defaults to a real readline interface over process.stdin/stdout. */
  prompter?: Questioner & { close?: () => void }
  /** Injectable for tests — defaults to actually spawning the detected package manager. */
  install?: (packages: StackPackage[], cwd: string) => boolean
  /** Injectable for tests — defaults to process.stdin.isTTY. */
  isInteractive?: boolean
  /** Called with the choiceIds picked in each visited category, keyed by category id, before install runs. */
  onSelections?: (selections: Record<string, string[]>) => void
}

export async function runStackWizard(
  categories: StackCategory[],
  cwd: string,
  options: StackWizardOptions = {},
): Promise<number> {
  const isInteractive = options.isInteractive ?? Boolean(process.stdin.isTTY)
  if (!isInteractive) {
    console.error('This command needs an interactive terminal — run it in a real shell, not piped or in CI.')
    return 1
  }

  const rl = options.prompter ?? createPrompter()
  let packages: StackPackage[] = []
  const selections: Record<string, string[]> = {}

  try {
    for (const category of categories) {
      const choiceIds = await promptCategory(rl, category)
      selections[category.id] = choiceIds
      packages = packages.concat(resolvePackages(category, choiceIds))
    }
  } finally {
    rl.close?.()
  }

  options.onSelections?.(selections)
  packages = dedupePackages(packages)

  if (packages.length === 0) {
    console.log('\nNo packages selected — nothing to install.')
    return 0
  }

  const install = options.install ?? installPackages
  const ok = install(packages, cwd)
  if (!ok) {
    console.error('\nInstall failed. Try running the install command yourself with the packages listed above.')
    return 1
  }

  return 0
}
