import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { StackPackage } from './stack.js'

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun'

export function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(resolve(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(resolve(cwd, 'yarn.lock'))) return 'yarn'
  if (existsSync(resolve(cwd, 'bun.lockb'))) return 'bun'
  return 'npm'
}

export function installArgs(manager: PackageManager, specs: string[]): string[] {
  return manager === 'npm' ? ['install', ...specs] : ['add', ...specs]
}

export function packageSpecs(packages: StackPackage[]): string[] {
  return packages.map((p) => `${p.name}@${p.range}`)
}

export function installPackages(packages: StackPackage[], cwd: string): boolean {
  if (packages.length === 0) return true

  const manager = detectPackageManager(cwd)
  const specs = packageSpecs(packages)
  console.log(`\nInstalling with ${manager}: ${specs.join(', ')}\n`)

  const result = spawnSync(manager, installArgs(manager, specs), {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  return result.status === 0
}
