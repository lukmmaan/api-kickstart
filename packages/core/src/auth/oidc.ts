import type { AuthenticatedUser, AuthStrategy } from '../types.js'

export interface OidcOptions {
  issuer: string
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes?: string[]
  onUser: (profile: Record<string, unknown>) => Promise<AuthenticatedUser>
}

export function oidc(options: OidcOptions): AuthStrategy {
  void options
  return {
    name: 'oidc',
    async authenticate() {
      throw new Error(
        'api-kickstart/auth oidc() is not implemented yet. Discovery, PKCE, state/nonce handling, and JWKS rotation are still on the roadmap — see the "Roadmap" section of the README.',
      )
    },
  }
}
