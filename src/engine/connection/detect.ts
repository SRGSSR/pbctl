// Detects the identity provider a backend uses from its browser login redirect.

/** The issuer and client id a backend's login route points at. */
export interface IdentityProviderHint {
  /** The OIDC issuer URL derived from the authorize endpoint. */
  issuer: string;
  /** The client id the backend logs in as. */
  clientId: string;
}

/** The subset of fetch the detection needs, so tests can stub it. */
export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

/** The authorize endpoint suffix of a Keycloak realm. */
const KEYCLOAK_AUTHORIZE = '/protocol/openid-connect/auth';

/** The authorize endpoint suffix of a Microsoft Entra ID tenant (v2.0). */
const ENTRA_AUTHORIZE = '/oauth2/v2.0/authorize';

/**
 * Parses an OIDC authorize URL into the issuer and client id it carries.
 *
 * @param location - The authorize URL, as found in a login redirect.
 * @returns The hint, or undefined when the URL is invalid or has no client id.
 */
export function parseAuthorizeUrl(
  location: string,
): IdentityProviderHint | undefined {
  let url: URL;
  try {
    url = new URL(location);
  } catch {
    return undefined;
  }
  const clientId = url.searchParams.get('client_id');
  if (clientId === null || clientId === '') {
    return undefined;
  }
  return { issuer: issuerOf(url), clientId };
}

/**
 * Derives the issuer from an authorize endpoint. Keycloak and Entra have
 * known layouts; anything else drops the last path segment.
 *
 * @param url - The authorize endpoint.
 * @returns The issuer URL.
 */
function issuerOf(url: URL): string {
  const base = `${url.protocol}//${url.host}`;
  const path = url.pathname;
  if (path.endsWith(KEYCLOAK_AUTHORIZE)) {
    return base + path.slice(0, -KEYCLOAK_AUTHORIZE.length);
  }
  if (path.endsWith(ENTRA_AUTHORIZE)) {
    return `${base}${path.slice(0, -ENTRA_AUTHORIZE.length)}/v2.0`;
  }
  return base + path.slice(0, path.lastIndexOf('/'));
}

/**
 * Asks the backend where its browser login goes and reads the identity
 * provider from that redirect. Any network or protocol failure yields
 * undefined: the result only pre-fills wizard defaults.
 *
 * @param backend - The backend base URL.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns The hint, or undefined when the backend gives no usable redirect.
 */
export async function detectIdentityProvider(
  backend: string,
  fetchFn: FetchLike = fetch,
): Promise<IdentityProviderHint | undefined> {
  const login = new URL('/login', backend).toString();
  let response: Response;
  try {
    response = await fetchFn(login, { redirect: 'manual' });
  } catch {
    return undefined;
  }
  const location = response.headers.get('location');
  if (response.status < 300 || response.status >= 400 || location === null) {
    return undefined;
  }
  return parseAuthorizeUrl(new URL(location, login).toString());
}
