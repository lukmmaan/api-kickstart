export interface OidcDiscoveryDocument {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  jwks_uri: string
}

export async function fetchDiscoveryDocument(issuer: string): Promise<OidcDiscoveryDocument> {
  const url = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`oidc(): discovery failed for issuer "${issuer}" (HTTP ${res.status})`)
  }
  return (await res.json()) as OidcDiscoveryDocument
}
