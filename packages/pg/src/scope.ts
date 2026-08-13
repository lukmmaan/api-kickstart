import type { ScopeFilter } from 'api-kickstart'

export interface PgScopeQuery {
  where: string
  values: unknown[]
}

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`
}

export function translateScope(filter: ScopeFilter): PgScopeQuery {
  const keys = Object.keys(filter)
  if (keys.length === 0) return { where: 'true', values: [] }
  const clauses: string[] = []
  const values: unknown[] = []
  keys.forEach((key, i) => {
    clauses.push(`${quoteIdent(key)} = $${i + 1}`)
    values.push(filter[key])
  })
  return { where: clauses.join(' AND '), values }
}
