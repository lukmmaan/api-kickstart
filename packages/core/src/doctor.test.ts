import { describe, expect, it } from 'vitest'
import { createApp } from './index.js'
import { runDoctorChecks } from './doctor.js'
import { fakeFramework } from './test-helpers.js'

function check(checks: ReturnType<typeof runDoctorChecks>, name: string) {
  const found = checks.find((c) => c.name === name)
  if (!found) throw new Error(`no check named "${name}"`)
  return found
}

describe('runDoctorChecks', () => {
  it('flags routes missing an explicit auth declaration', () => {
    const app = createApp({ framework: fakeFramework() })
    app.route({ method: 'GET', path: '/no-auth-declared', handler: async () => ({}) })
    const checks = runDoctorChecks(app, {})
    expect(check(checks, 'explicit-route-auth').passed).toBe(false)
  })

  it('passes explicit-route-auth when every route declares auth', () => {
    const app = createApp({ framework: fakeFramework() })
    app.route({ method: 'GET', path: '/public', auth: false, handler: async () => ({}) })
    app.route({ method: 'GET', path: '/private', auth: true, handler: async () => ({}) })
    const checks = runDoctorChecks(app, {})
    expect(check(checks, 'explicit-route-auth').passed).toBe(true)
  })

  it('flags scoped resources with no roles configured', () => {
    const app = createApp({ framework: fakeFramework(), scope: { posts: {} } })
    const checks = runDoctorChecks(app, {})
    expect(check(checks, 'scope-roles-defined').passed).toBe(false)
  })

  it('passes scope-roles-defined when a role resolver exists', () => {
    const app = createApp({ framework: fakeFramework(), scope: { posts: { admin: () => ({}) } } })
    const checks = runDoctorChecks(app, {})
    expect(check(checks, 'scope-roles-defined').passed).toBe(true)
  })

  it('flags scopeAudit "off"', () => {
    const app = createApp({ framework: fakeFramework(), scopeAudit: 'off' })
    const checks = runDoctorChecks(app, {})
    expect(check(checks, 'scope-audit-enabled').passed).toBe(false)
  })

  it('passes scope-audit-enabled for "warn" or "throw"', () => {
    const app = createApp({ framework: fakeFramework(), scopeAudit: 'warn' })
    const checks = runDoctorChecks(app, {})
    expect(check(checks, 'scope-audit-enabled').passed).toBe(true)
  })

  it('flags a login route with no rateLimit configured', () => {
    const app = createApp({ framework: fakeFramework() })
    app.route({ method: 'POST', path: '/login', auth: false, handler: async () => ({}) })
    const checks = runDoctorChecks(app, {})
    expect(check(checks, 'auth-endpoints-rate-limited').passed).toBe(false)
  })

  it('passes auth-endpoints-rate-limited when the login route has rateLimit', () => {
    const app = createApp({ framework: fakeFramework() })
    app.route({ method: 'POST', path: '/login', auth: false, rateLimit: { window: '1m', max: 5 }, handler: async () => ({}) })
    const checks = runDoctorChecks(app, {})
    expect(check(checks, 'auth-endpoints-rate-limited').passed).toBe(true)
  })

  it('checks JWT_SECRET strength only when the env var is present', () => {
    const app = createApp({ framework: fakeFramework() })
    const withoutVar = runDoctorChecks(app, {})
    expect(withoutVar.find((c) => c.name === 'jwt-secret-strength')).toBeUndefined()

    const weak = runDoctorChecks(app, { JWT_SECRET: 'changeme' })
    expect(check(weak, 'jwt-secret-strength').passed).toBe(false)

    const strong = runDoctorChecks(app, { JWT_SECRET: 'a'.repeat(32) })
    expect(check(strong, 'jwt-secret-strength').passed).toBe(true)
  })
})
