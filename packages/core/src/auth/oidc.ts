import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { DEFAULT_JWT_TOKEN_SOURCES } from '../constants.js'
import type { AuthenticateArgs, AuthenticatedUser, AuthStrategy } from '../types.js'
import { fetchDiscoveryDocument, type OidcDiscoveryDocument } from './oidc-discovery.js'
import { generateCodeChallenge, generateCodeVerifier, generateRandomToken } from './oidc-pkce.js'

export interface OidcOptions {
  issuer: string
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes?: string[]
  from?: string[]
  onUser: (profile: Record<string, unknown>) => Promise<AuthenticatedUser>
}

export interface OidcAuthorizationRequest {
  url: string
  state: string
  nonce: string
  codeVerifier: string
}

export interface OidcTokenResponse {
  access_token: string
  id_token?: string
  refresh_token?: string
  token_type: string
  expires_in?: number
}

export interface OidcCallbackResult {
  user: AuthenticatedUser
  tokens: OidcTokenResponse
}

export interface OidcAuthStrategy extends AuthStrategy {
  authorizationUrl(state?: string): Promise<OidcAuthorizationRequest>
  handleCallback(params: { code: string; codeVerifier: string }): Promise<OidcCallbackResult>
}

function extractToken(args: AuthenticateArgs, from: string[]): string | null {
  for (const source of from) {
    const [kind, name] = source.split(':')
    if (kind === 'header' && name) {
      const value = args.headers[name]
      const header = Array.isArray(value) ? value[0] : value
      if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7)
    }
    if (kind === 'cookie' && name) {
      const value = args.cookies[name]
      if (value) return value
    }
  }
  return null
}

export function oidc(options: OidcOptions): OidcAuthStrategy {
  const from = options.from ?? DEFAULT_JWT_TOKEN_SOURCES
  const scopes = options.scopes ?? ['openid', 'email', 'profile']

  let discoveryPromise: Promise<OidcDiscoveryDocument> | null = null
  function getDiscovery(): Promise<OidcDiscoveryDocument> {
    if (!discoveryPromise) discoveryPromise = fetchDiscoveryDocument(options.issuer)
    return discoveryPromise
  }

  let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
  function getJwks(jwksUri: string): ReturnType<typeof createRemoteJWKSet> {
    if (!jwks) jwks = createRemoteJWKSet(new URL(jwksUri))
    return jwks
  }

  async function verifyIdToken(idToken: string, doc: OidcDiscoveryDocument): Promise<JWTPayload> {
    const { payload } = await jwtVerify(idToken, getJwks(doc.jwks_uri), {
      issuer: doc.issuer,
      audience: options.clientId,
    })
    return payload
  }

  return {
    name: 'oidc',

    async authorizationUrl(state) {
      const doc = await getDiscovery()
      const resolvedState = state ?? generateRandomToken()
      const nonce = generateRandomToken()
      const codeVerifier = generateCodeVerifier()
      const codeChallenge = generateCodeChallenge(codeVerifier)

      const url = new URL(doc.authorization_endpoint)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('client_id', options.clientId)
      url.searchParams.set('redirect_uri', options.redirectUri)
      url.searchParams.set('scope', scopes.join(' '))
      url.searchParams.set('state', resolvedState)
      url.searchParams.set('nonce', nonce)
      url.searchParams.set('code_challenge', codeChallenge)
      url.searchParams.set('code_challenge_method', 'S256')

      return { url: url.toString(), state: resolvedState, nonce, codeVerifier }
    },

    async handleCallback(params) {
      const doc = await getDiscovery()
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: options.redirectUri,
        client_id: options.clientId,
        client_secret: options.clientSecret,
        code_verifier: params.codeVerifier,
      })

      const res = await fetch(doc.token_endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (!res.ok) {
        throw new Error(`oidc(): token exchange failed (HTTP ${res.status})`)
      }
      const tokens = (await res.json()) as OidcTokenResponse

      const profile = tokens.id_token ? await verifyIdToken(tokens.id_token, doc) : {}
      const user = await options.onUser(profile as Record<string, unknown>)
      return { user, tokens }
    },

    async authenticate(args) {
      const token = extractToken(args, from)
      if (!token) return null
      try {
        const doc = await getDiscovery()
        const payload = await verifyIdToken(token, doc)
        return await options.onUser(payload as Record<string, unknown>)
      } catch {
        return null
      }
    },
  }
}
