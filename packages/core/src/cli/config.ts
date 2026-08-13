import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { App } from '../index.js'
import type { EnvSchema } from '../env.js'

export interface CliConfig {
  app?: App | (() => App | Promise<App>)
  envSchema?: EnvSchema
}

const DEFAULT_CONFIG_FILES = ['api-kickstart.config.mjs', 'api-kickstart.config.js']

export async function loadConfig(configPath?: string): Promise<CliConfig> {
  const candidate = configPath ?? DEFAULT_CONFIG_FILES.find((file) => existsSync(resolve(process.cwd(), file)))
  if (!candidate) {
    throw new Error(
      'No config file found. Pass --config <path> or create api-kickstart.config.mjs exporting { app } and/or { envSchema }.',
    )
  }
  const fullPath = resolve(process.cwd(), candidate)
  const mod = (await import(pathToFileURL(fullPath).href)) as { default?: CliConfig } & CliConfig
  return mod.default ?? mod
}

export async function resolveApp(config: CliConfig): Promise<App> {
  if (!config.app) {
    throw new Error('Config must export "app": an App instance created with createApp(), or a function returning one.')
  }
  return typeof config.app === 'function' ? config.app() : config.app
}
