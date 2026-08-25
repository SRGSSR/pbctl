// Reads who the user is from the access token claims.

/** The user an access token identifies. */
export interface Identity {
  /** The OIDC subject. */
  subject: string;
  /** The display name: `name`, else `preferred_username`, else the subject. */
  name: string;
  /** The roles claim the backend reads. */
  roles: string[];
}

/**
 * Decodes the identity from a JWT access token. The signature is not
 * verified: the backend does that, this only shows who is logged in.
 *
 * @param accessToken - The JWT access token.
 * @returns The identity.
 */
export function identityOf(accessToken: string): Identity {
  const claims = decodePayload(accessToken);
  const subject = typeof claims.sub === 'string' ? claims.sub : '';
  return {
    subject,
    name: firstString(claims, ['name', 'preferred_username']) ?? subject,
    roles: rolesOf(claims),
  };
}

/**
 * Decodes the payload segment of a JWT.
 *
 * @param token - The JWT.
 * @returns The payload claims.
 */
function decodePayload(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  if (payload === undefined) {
    throw new Error('The access token is not a JWT.');
  }
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('The access token payload is not valid JSON.');
  }
}

/**
 * Returns the first string claim among the given names.
 *
 * @param claims - The token claims.
 * @param names - The claim names, in order of preference.
 * @returns The claim value, or undefined when none is a string.
 */
function firstString(
  claims: Record<string, unknown>,
  names: string[],
): string | undefined {
  for (const name of names) {
    const value = claims[name];
    if (typeof value === 'string' && value !== '') {
      return value;
    }
  }
  return undefined;
}

/**
 * Reads the roles: the top-level `roles` claim the backend reads, else
 * Keycloak's `realm_access.roles`.
 *
 * @param claims - The token claims.
 * @returns The role names, empty when the token carries none.
 */
function rolesOf(claims: Record<string, unknown>): string[] {
  const realm = claims.realm_access as { roles?: unknown } | undefined;
  const candidate = Array.isArray(claims.roles) ? claims.roles : realm?.roles;
  return Array.isArray(candidate)
    ? candidate.filter((role): role is string => typeof role === 'string')
    : [];
}
