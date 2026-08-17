import { describe, expect, it } from 'vitest'
import { createApp } from './index.js'
import { createI18n, createTranslator, currentLocale } from './i18n.js'
import { fakeFramework } from './test-helpers.js'

const dictionaries = {
  en: {
    greeting: 'Hello, {name}!',
    onlyInEnglish: 'English only',
    errors: { notFound: 'Not found' },
  },
  id: {
    greeting: 'Halo, {name}!',
    errors: { notFound: 'Tidak ditemukan' },
  },
}

describe('createTranslator', () => {
  it('looks up a dot-path key and interpolates params', () => {
    const translator = createTranslator({ locales: ['en', 'id'], defaultLocale: 'en', dictionaries })
    expect(translator.t('greeting', { name: 'Alice' }, 'en')).toBe('Hello, Alice!')
    expect(translator.t('greeting', { name: 'Alice' }, 'id')).toBe('Halo, Alice!')
    expect(translator.t('errors.notFound', undefined, 'id')).toBe('Tidak ditemukan')
  })

  it('falls back to the default locale when a key is missing in the requested locale', () => {
    const translator = createTranslator({ locales: ['en', 'id'], defaultLocale: 'en', dictionaries })
    expect(translator.t('onlyInEnglish', undefined, 'id')).toBe('English only')
  })

  it('returns the key itself when missing in every locale', () => {
    const translator = createTranslator({ locales: ['en', 'id'], defaultLocale: 'en', dictionaries })
    expect(translator.t('does.not.exist')).toBe('does.not.exist')
  })

  it('leaves an unmatched {placeholder} untouched when no param is given for it', () => {
    const translator = createTranslator({ locales: ['en'], defaultLocale: 'en', dictionaries })
    expect(translator.t('greeting', {}, 'en')).toBe('Hello, {name}!')
  })

  it('lets addDictionary register a new locale after creation', () => {
    const translator = createTranslator({ locales: ['en'], defaultLocale: 'en', dictionaries: { en: dictionaries.en } })
    translator.addDictionary('fr', { greeting: 'Bonjour, {name}!' })
    expect(translator.locales()).toContain('fr')
    expect(translator.t('greeting', { name: 'Alice' }, 'fr')).toBe('Bonjour, Alice!')
  })
})

describe('createI18n middleware', () => {
  it('detects locale from a query param and stamps content-language', async () => {
    const i18n = createI18n({ locales: ['en', 'id'], defaultLocale: 'en', dictionaries })
    const app = createApp({ framework: fakeFramework(), middleware: [i18n.middleware] })
    app.route({
      method: 'GET',
      path: '/greet',
      auth: false,
      handler: async () => ({ message: i18n.t('greeting', { name: 'Alice' }) }),
    })

    const res = await app.inject({ method: 'GET', path: '/greet', query: { lang: 'id' } })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ message: 'Halo, Alice!' })
    expect(res.headers['content-language']).toBe('id')
  })

  it('detects locale from a cookie', async () => {
    const i18n = createI18n({ locales: ['en', 'id'], defaultLocale: 'en', dictionaries })
    const app = createApp({ framework: fakeFramework(), middleware: [i18n.middleware] })
    app.route({ method: 'GET', path: '/greet', auth: false, handler: async () => ({ message: i18n.t('greeting', { name: 'Bob' }) }) })

    const res = await app.inject({ method: 'GET', path: '/greet', headers: { cookie: 'locale=id' } })
    expect(res.body).toEqual({ message: 'Halo, Bob!' })
  })

  it('detects locale from the Accept-Language header, honoring quality values', async () => {
    const i18n = createI18n({ locales: ['en', 'id'], defaultLocale: 'en', dictionaries })
    const app = createApp({ framework: fakeFramework(), middleware: [i18n.middleware] })
    app.route({ method: 'GET', path: '/greet', auth: false, handler: async () => ({ message: i18n.t('greeting', { name: 'Cara' }) }) })

    const res = await app.inject({ method: 'GET', path: '/greet', headers: { 'accept-language': 'fr-FR,id;q=0.9,en;q=0.8' } })
    expect(res.body).toEqual({ message: 'Halo, Cara!' })
  })

  it('matches a region-qualified header tag against a base language locale', async () => {
    const i18n = createI18n({ locales: ['en', 'id'], defaultLocale: 'en', dictionaries })
    const app = createApp({ framework: fakeFramework(), middleware: [i18n.middleware] })
    app.route({ method: 'GET', path: '/greet', auth: false, handler: async () => ({ message: i18n.t('greeting', { name: 'Dee' }) }) })

    const res = await app.inject({ method: 'GET', path: '/greet', headers: { 'accept-language': 'id-ID' } })
    expect(res.body).toEqual({ message: 'Halo, Dee!' })
  })

  it('falls back to defaultLocale when nothing matches any configured source', async () => {
    const i18n = createI18n({ locales: ['en', 'id'], defaultLocale: 'en', dictionaries })
    const app = createApp({ framework: fakeFramework(), middleware: [i18n.middleware] })
    app.route({ method: 'GET', path: '/greet', auth: false, handler: async () => ({ message: i18n.t('greeting', { name: 'Eve' }) }) })

    const res = await app.inject({ method: 'GET', path: '/greet', headers: { 'accept-language': 'fr-FR' } })
    expect(res.body).toEqual({ message: 'Hello, Eve!' })
    expect(res.headers['content-language']).toBe('en')
  })

  it('respects a custom detection order, query before header by default but overridable', async () => {
    const i18n = createI18n({
      locales: ['en', 'id'],
      defaultLocale: 'en',
      dictionaries,
      detect: ['header', 'query'],
    })
    const app = createApp({ framework: fakeFramework(), middleware: [i18n.middleware] })
    app.route({ method: 'GET', path: '/greet', auth: false, handler: async () => ({ message: i18n.t('greeting', { name: 'Finn' }) }) })

    const res = await app.inject({
      method: 'GET',
      path: '/greet',
      query: { lang: 'id' },
      headers: { 'accept-language': 'en' },
    })
    expect(res.body).toEqual({ message: 'Hello, Finn!' })
  })

  it('makes currentLocale() available inside the handler via AsyncLocalStorage', async () => {
    const i18n = createI18n({ locales: ['en', 'id'], defaultLocale: 'en', dictionaries })
    const app = createApp({ framework: fakeFramework(), middleware: [i18n.middleware] })
    app.route({ method: 'GET', path: '/whoami', auth: false, handler: async () => ({ locale: currentLocale() }) })

    const res = await app.inject({ method: 'GET', path: '/whoami', query: { lang: 'id' } })
    expect(res.body).toEqual({ locale: 'id' })
  })

  it('i18n.locale() reports the currently active request locale', async () => {
    const i18n = createI18n({ locales: ['en', 'id'], defaultLocale: 'en', dictionaries })
    const app = createApp({ framework: fakeFramework(), middleware: [i18n.middleware] })
    app.route({ method: 'GET', path: '/whoami', auth: false, handler: async () => ({ locale: i18n.locale() }) })

    const res = await app.inject({ method: 'GET', path: '/whoami', query: { lang: 'id' } })
    expect(res.body).toEqual({ locale: 'id' })
  })
})
