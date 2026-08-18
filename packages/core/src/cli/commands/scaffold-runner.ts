import { createPrompter, promptChoice, promptText, type Questioner } from '../prompt.js'
import {
  findTheme,
  parseFields,
  parseResourceList,
  PROJECT_THEMES,
  resourceNames,
  type ScaffoldChoice,
  type ScaffoldFile,
  type ScaffoldResource,
} from '../scaffold.js'
import { writeScaffoldFiles, type WriteResult } from '../write-files.js'

export interface ScaffoldWizardOptions {
  /** Injectable for tests — defaults to a real readline interface over process.stdin/stdout. */
  prompter?: Questioner & { close?: () => void }
  /** Injectable for tests — defaults to actually writing files to disk. */
  write?: (files: ScaffoldFile[], cwd: string) => WriteResult
  /** Injectable for tests — defaults to process.stdin.isTTY. */
  isInteractive?: boolean
}

export async function runScaffoldWizard(
  selections: Record<string, string[]>,
  cwd: string,
  options: ScaffoldWizardOptions = {},
): Promise<number> {
  const isInteractive = options.isInteractive ?? Boolean(process.stdin.isTTY)
  if (!isInteractive) return 0

  const rl = options.prompter ?? createPrompter()
  let themeId: string | null
  const resources: ScaffoldResource[] = []

  try {
    themeId = await promptChoice(
      rl,
      'Project structure',
      'Scaffold a folder structure now (controllers, routes, services, models, config, middleware)?',
      PROJECT_THEMES.map((theme) => ({ id: theme.id, label: theme.label })),
    )
    if (!themeId) return 0

    const resourcesAnswer = await promptText(
      rl,
      'Name your resources — one module gets generated per name (comma-separated, plural, e.g. users, posts):',
      'users',
    )
    const resourceInputs = parseResourceList(resourcesAnswer)

    for (const input of resourceInputs.length > 0 ? resourceInputs : ['users']) {
      const plural = resourceNames(input).plural
      const fieldsAnswer = await promptText(
        rl,
        `Fields for ${plural} — name:type, comma-separated (types: string, number, boolean):`,
        'name:string',
      )
      resources.push({ input, fields: parseFields(fieldsAnswer) })
    }
  } finally {
    rl.close?.()
  }

  const theme = findTheme(themeId)
  if (!theme) return 0

  const choice: ScaffoldChoice = {
    frameworkId: selections.framework?.[0] ?? 'http',
    databaseId: selections.database?.[0] ?? 'none',
    validatorId: selections.validation?.[0] ?? 'none',
    resources,
  }

  const files = theme.generate(choice)
  const write = options.write ?? writeScaffoldFiles
  const { written, skipped } = write(files, cwd)

  const moduleWord = choice.resources.length === 1 ? 'module' : 'modules'
  const moduleNames = choice.resources.map((r) => r.input).join(', ')
  console.log(
    `\nScaffolded ${written.length} file(s) under src/ (${choice.resources.length} ${moduleWord}: ${moduleNames}) using the "${theme.label.split(' (')[0]}" structure.`,
  )
  if (skipped.length > 0) {
    console.log(`Left ${skipped.length} existing file(s) untouched: ${skipped.join(', ')}`)
  }

  return 0
}
