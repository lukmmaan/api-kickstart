import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeScaffoldFiles } from './write-files.js'

describe('writeScaffoldFiles', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'api-kickstart-scaffold-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('writes every file, creating nested directories as needed', () => {
    const result = writeScaffoldFiles(
      [
        { path: 'src/app.ts', contents: 'export const app = 1\n' },
        { path: 'src/models/posts.model.ts', contents: 'export const posts = []\n' },
      ],
      dir,
    )

    expect(result.written.sort()).toEqual(['src/app.ts', 'src/models/posts.model.ts'].sort())
    expect(result.skipped).toEqual([])
    expect(readFileSync(join(dir, 'src/app.ts'), 'utf8')).toBe('export const app = 1\n')
    expect(readFileSync(join(dir, 'src/models/posts.model.ts'), 'utf8')).toBe('export const posts = []\n')
  })

  it('never overwrites a file that already exists', () => {
    writeFileSync(join(dir, 'existing.ts'), 'original\n')

    const result = writeScaffoldFiles([{ path: 'existing.ts', contents: 'new contents\n' }], dir)

    expect(result.written).toEqual([])
    expect(result.skipped).toEqual(['existing.ts'])
    expect(readFileSync(join(dir, 'existing.ts'), 'utf8')).toBe('original\n')
  })

  it('writes the ones that are new while skipping the ones that already exist', () => {
    writeFileSync(join(dir, 'a.ts'), 'a\n')

    const result = writeScaffoldFiles(
      [
        { path: 'a.ts', contents: 'new-a\n' },
        { path: 'b.ts', contents: 'b\n' },
      ],
      dir,
    )

    expect(result.skipped).toEqual(['a.ts'])
    expect(result.written).toEqual(['b.ts'])
    expect(readFileSync(join(dir, 'a.ts'), 'utf8')).toBe('a\n')
    expect(readFileSync(join(dir, 'b.ts'), 'utf8')).toBe('b\n')
  })
})
