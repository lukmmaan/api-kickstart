import { AsyncLocalStorage } from 'node:async_hooks'
import { parseCookieHeader } from './cookies.js'
import type { Context, Middleware } from './types.js'

export type TranslationParams = Record<string, string | number>

export interface TranslationDictionary {
  [key: string]: string | TranslationDictionary
}

interface LocaleStore {
  locale: string
}

const localeStorage = new AsyncLocalStorage<LocaleStore>()

export function currentLocale(): string | null {
  return localeStorage.getStore()?.locale ?? null
}

function getPath(dictionary: TranslationDictionary, key: string): string | undefined {
  let node: string | TranslationDictionary | undefined = dictionary
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = node[segment]
  }
  return typeof node === 'string' ? node : undefined
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key]
    return value === undefined ? match : String(value)
  })
}

/** Mutates `dictionary`, writing `value` at the dot-path `key` (creating nested objects as needed). */
export function setTranslationPath(dictionary: TranslationDictionary, key: string, value: string): void {
  const segments = key.split('.')
  let node = dictionary
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]
    const next = node[segment]
    if (typeof next !== 'object' || next === null) node[segment] = {}
    node = node[segment] as TranslationDictionary
  }
  node[segments[segments.length - 1]] = value
}

/** Reassembles flat `key.path` → value rows (e.g. from a database table or Redis hash) into a nested TranslationDictionary. */
export function buildDictionary(entries: Iterable<readonly [key: string, value: string]>): TranslationDictionary {
  const dictionary: TranslationDictionary = {}
  for (const [key, value] of entries) setTranslationPath(dictionary, key, value)
  return dictionary
}

export interface TranslatorOptions {
  locales: string[]
  defaultLocale: string
  dictionaries: Record<string, TranslationDictionary>
}

export interface Translator {
  t(key: string, params?: TranslationParams, locale?: string): string
  locales(): string[]
  defaultLocale(): string
  addDictionary(locale: string, dictionary: TranslationDictionary): void
}

export function createTranslator(options: TranslatorOptions): Translator {
  const dictionaries = new Map<string, TranslationDictionary>(Object.entries(options.dictionaries))
  const locales = [...options.locales]

  return {
    t(key, params, locale) {
      const resolvedLocale = locale ?? currentLocale() ?? options.defaultLocale

      const primary = dictionaries.get(resolvedLocale)
      const primaryValue = primary && getPath(primary, key)
      if (primaryValue !== undefined) return interpolate(primaryValue, params)

      const fallback = dictionaries.get(options.defaultLocale)
      const fallbackValue = fallback && getPath(fallback, key)
      if (fallbackValue !== undefined) return interpolate(fallbackValue, params)

      return key
    },
    locales() {
      return [...locales]
    },
    defaultLocale() {
      return options.defaultLocale
    },
    addDictionary(locale, dictionary) {
      dictionaries.set(locale, dictionary)
      if (!locales.includes(locale)) locales.push(locale)
    },
  }
}

/**
 * Where a translator's dictionaries come from: a database table, a Redis hash, or
 * an in-memory constant — see /pg, /knex, /mongodb, /redis, and /memory for the
 * concrete implementations (pgTranslationStore, knexTranslationStore, mongodbTranslationStore,
 * redisTranslationStore, memoryTranslationStore).
 */
export interface TranslationStore {
  loadAll(): Promise<Record<string, TranslationDictionary>>
  set(locale: string, key: string, value: string): Promise<void>
}

export async function createTranslatorFromStore(
  store: TranslationStore,
  options: Omit<TranslatorOptions, 'dictionaries'>,
): Promise<Translator> {
  const dictionaries = await store.loadAll()
  return createTranslator({ ...options, dictionaries })
}

interface WeightedTag {
  tag: string
  quality: number
}

function parseAcceptLanguage(header: string): WeightedTag[] {
  return header
    .split(',')
    .map((part): WeightedTag => {
      const [tag, ...params] = part.trim().split(';')
      const qParam = params.find((p) => p.trim().startsWith('q='))
      const quality = qParam ? Number(qParam.trim().slice(2)) : 1
      return { tag: tag.trim(), quality: Number.isFinite(quality) ? quality : 1 }
    })
    .filter((entry) => entry.tag.length > 0 && entry.tag !== '*')
    .sort((a, b) => b.quality - a.quality)
}

function matchSupportedLocale(candidates: WeightedTag[], supported: string[]): string | null {
  const normalizedSupported = supported.map((locale) => locale.toLowerCase())

  for (const candidate of candidates) {
    const tag = candidate.tag.toLowerCase()
    const exactIndex = normalizedSupported.indexOf(tag)
    if (exactIndex !== -1) return supported[exactIndex]

    const languageOnly = tag.split('-')[0]
    const languageIndex = normalizedSupported.findIndex((entry) => entry.split('-')[0] === languageOnly)
    if (languageIndex !== -1) return supported[languageIndex]
  }

  return null
}

function headerValue(ctx: Context, name: string): string | undefined {
  const value = ctx.headers[name]
  return Array.isArray(value) ? value[0] : value
}

export type LocaleSource = 'query' | 'cookie' | 'header'

export interface I18nOptions {
  locales: string[]
  defaultLocale: string
  dictionaries: Record<string, TranslationDictionary>
  detect?: LocaleSource[]
  headerName?: string
  queryParam?: string
  cookieName?: string
}

function detectLocale(ctx: Context, options: I18nOptions): string {
  const detectOrder = options.detect ?? ['query', 'cookie', 'header']
  const headerName = (options.headerName ?? 'accept-language').toLowerCase()
  const queryParam = options.queryParam ?? 'lang'
  const cookieName = options.cookieName ?? 'locale'
  const normalizedSupported = options.locales.map((locale) => locale.toLowerCase())

  for (const source of detectOrder) {
    if (source === 'query') {
      const query = ctx.query as Record<string, unknown> | null | undefined
      const raw = query?.[queryParam]
      const value = typeof raw === 'string' ? raw : undefined
      if (value) {
        const index = normalizedSupported.indexOf(value.toLowerCase())
        if (index !== -1) return options.locales[index]
      }
    }

    if (source === 'cookie') {
      const value = parseCookieHeader(headerValue(ctx, 'cookie'))[cookieName]
      if (value) {
        const index = normalizedSupported.indexOf(value.toLowerCase())
        if (index !== -1) return options.locales[index]
      }
    }

    if (source === 'header') {
      const raw = headerValue(ctx, headerName)
      if (raw) {
        const matched = matchSupportedLocale(parseAcceptLanguage(raw), options.locales)
        if (matched) return matched
      }
    }
  }

  return options.defaultLocale
}

export interface I18n {
  middleware: Middleware
  t(key: string, params?: TranslationParams, locale?: string): string
  locale(): string
  locales(): string[]
  defaultLocale(): string
  addDictionary(locale: string, dictionary: TranslationDictionary): void
}

export function createI18n(options: I18nOptions): I18n {
  const translator = createTranslator(options)

  const middleware: Middleware = async (ctx, next) => {
    const locale = detectLocale(ctx, options)
    ctx.response.headers['content-language'] = locale
    await localeStorage.run({ locale }, () => next())
  }

  return {
    middleware,
    t: translator.t,
    locale: () => currentLocale() ?? options.defaultLocale,
    locales: translator.locales,
    defaultLocale: translator.defaultLocale,
    addDictionary: translator.addDictionary,
  }
}

export async function createI18nFromStore(
  store: TranslationStore,
  options: Omit<I18nOptions, 'dictionaries'>,
): Promise<I18n> {
  const dictionaries = await store.loadAll()
  return createI18n({ ...options, dictionaries })
}
