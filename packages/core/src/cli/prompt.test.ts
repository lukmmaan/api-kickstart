import { describe, expect, it } from 'vitest'
import { parseSelection, promptCategory, promptChoice, promptMultiChoice, promptText, type Questioner } from './prompt.js'
import { findCategory } from './stack.js'

describe('parseSelection', () => {
  it('parses a single number for a single-select category', () => {
    expect(parseSelection('2', 5, false)).toEqual([2])
  })

  it('parses comma-separated numbers for a multi-select category', () => {
    expect(parseSelection('1, 3,4', 5, true)).toEqual([1, 3, 4])
  })

  it('keeps only the first pick for a single-select category even if several are given', () => {
    expect(parseSelection('2,4', 5, false)).toEqual([2])
  })

  it('drops out-of-range and non-numeric entries', () => {
    expect(parseSelection('0,6,abc,3', 5, true)).toEqual([3])
  })

  it('dedupes repeated picks', () => {
    expect(parseSelection('2,2,3', 5, true)).toEqual([2, 3])
  })

  it('returns an empty array for blank input', () => {
    expect(parseSelection('', 5, true)).toEqual([])
  })
})

function fakeQuestioner(answer: string): Questioner {
  return { async question() { return answer } }
}

describe('promptCategory', () => {
  it('maps the picked numbers back to choice ids', async () => {
    const category = findCategory('framework')!
    const ids = await promptCategory(fakeQuestioner('1'), category, () => {})
    expect(ids).toEqual(['express'])
  })

  it('returns an empty array when the user presses enter with no input', async () => {
    const category = findCategory('database')!
    const ids = await promptCategory(fakeQuestioner(''), category, () => {})
    expect(ids).toEqual([])
  })

  it('supports multiple picks for a multi-select category', async () => {
    const category = findCategory('broker')!
    const ids = await promptCategory(fakeQuestioner('3,4'), category, () => {})
    expect(ids).toEqual(['redis', 'bullmq'])
  })

  it('prints the question and every choice label', async () => {
    const category = findCategory('logging')!
    const logs: string[] = []
    await promptCategory(fakeQuestioner(''), category, (line) => logs.push(line))
    const output = logs.join('\n')
    expect(output).toContain(category.question)
    expect(output).toContain('pino')
  })
})

describe('promptChoice', () => {
  const choices = [
    { id: 'layered', label: 'Layered' },
    { id: 'modular', label: 'Modular' },
  ]

  it('maps the picked number back to a choice id', async () => {
    const id = await promptChoice(fakeQuestioner('2'), 'Structure', 'Pick one', choices, () => {})
    expect(id).toBe('modular')
  })

  it('returns null when the user presses enter with no input', async () => {
    const id = await promptChoice(fakeQuestioner(''), 'Structure', 'Pick one', choices, () => {})
    expect(id).toBeNull()
  })

  it('returns null for an out-of-range pick', async () => {
    const id = await promptChoice(fakeQuestioner('9'), 'Structure', 'Pick one', choices, () => {})
    expect(id).toBeNull()
  })

  it('prints the title, question, and every choice label', async () => {
    const logs: string[] = []
    await promptChoice(fakeQuestioner(''), 'Structure', 'Pick one', choices, (line) => logs.push(line))
    const output = logs.join('\n')
    expect(output).toContain('Structure')
    expect(output).toContain('Pick one')
    expect(output).toContain('Layered')
    expect(output).toContain('Modular')
  })
})

describe('promptMultiChoice', () => {
  const choices = [
    { id: 'requestId', label: 'Request ID' },
    { id: 'logger', label: 'Logger' },
    { id: 'helmet', label: 'Helmet' },
  ]

  it('maps picked numbers back to choice ids', async () => {
    const ids = await promptMultiChoice(fakeQuestioner('1,3'), 'Middleware', 'Pick any', choices, () => {})
    expect(ids).toEqual(['requestId', 'helmet'])
  })

  it('returns an empty array when the user presses enter with no input', async () => {
    const ids = await promptMultiChoice(fakeQuestioner(''), 'Middleware', 'Pick any', choices, () => {})
    expect(ids).toEqual([])
  })

  it('drops out-of-range picks', async () => {
    const ids = await promptMultiChoice(fakeQuestioner('2,9'), 'Middleware', 'Pick any', choices, () => {})
    expect(ids).toEqual(['logger'])
  })

  it('prints the title, question, and every choice label', async () => {
    const logs: string[] = []
    await promptMultiChoice(fakeQuestioner(''), 'Middleware', 'Pick any', choices, (line) => logs.push(line))
    const output = logs.join('\n')
    expect(output).toContain('Middleware')
    expect(output).toContain('Pick any')
    expect(output).toContain('Helmet')
  })
})

describe('promptText', () => {
  it('returns the trimmed answer when one is given', async () => {
    const value = await promptText(fakeQuestioner('  posts  '), 'Resource name?', 'items', () => {})
    expect(value).toBe('posts')
  })

  it('falls back to the default value when the answer is blank', async () => {
    const value = await promptText(fakeQuestioner(''), 'Resource name?', 'items', () => {})
    expect(value).toBe('items')
  })
})
