import { createInterface, type Interface } from 'node:readline/promises'
import type { StackCategory } from './stack.js'

/** The slice of readline's promise-based Interface that prompting actually needs — easy to fake in tests. */
export interface Questioner {
  question(query: string): Promise<string>
}

export function createPrompter(): Interface {
  return createInterface({ input: process.stdin, output: process.stdout })
}

export function parseSelection(answer: string, choiceCount: number, multiple: boolean): number[] {
  const picks = answer
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= choiceCount)

  const unique = [...new Set(picks)]
  return multiple ? unique : unique.slice(0, 1)
}

export async function promptCategory(rl: Questioner, category: StackCategory, log: (line: string) => void = console.log): Promise<string[]> {
  log(`\n${category.label}: ${category.question}`)
  category.choices.forEach((choice, i) => log(`  ${i + 1}) ${choice.label}`))

  const hint = category.multiple
    ? 'Enter numbers separated by commas, or press enter to skip: '
    : 'Enter a number, or press enter to skip: '
  const answer = (await rl.question(hint)).trim()
  if (!answer) return []

  return parseSelection(answer, category.choices.length, category.multiple ?? false).map(
    (n) => category.choices[n - 1].id,
  )
}
