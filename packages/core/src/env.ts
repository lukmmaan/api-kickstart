export interface EnvSchemaEntry {
  parse(value: unknown): unknown
}

export type EnvSchema = Record<string, EnvSchemaEntry>

export interface EnvIssue {
  key: string
  message: string
}

export class EnvValidationError extends Error {
  issues: EnvIssue[]

  constructor(issues: EnvIssue[]) {
    super(`Environment validation failed:\n${issues.map((i) => `  ${i.key}: ${i.message}`).join('\n')}`)
    this.name = 'EnvValidationError'
    this.issues = issues
  }
}

export function env<S extends EnvSchema>(
  schema: S,
  source: Record<string, string | undefined> = process.env,
): { [K in keyof S]: ReturnType<S[K]['parse']> } {
  const result: Record<string, unknown> = {}
  const issues: EnvIssue[] = []

  for (const key of Object.keys(schema)) {
    try {
      result[key] = schema[key].parse(source[key])
    } catch (err) {
      issues.push({ key, message: err instanceof Error ? err.message : String(err) })
    }
  }

  if (issues.length > 0) {
    throw new EnvValidationError(issues)
  }

  return result as { [K in keyof S]: ReturnType<S[K]['parse']> }
}
