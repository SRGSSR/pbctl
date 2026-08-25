// The live connection: a profile, its provider endpoints, tokens, and identity.

import type { Profile } from '../config/profile';
import type { FetchLike } from './detect';
import { type Identity, identityOf } from './identity';
import type { Discovery, TokenSet } from './oidc';

/** A logged-in profile. */
export interface Connection {
  /** The profile logged in to. */
  profile: Profile;
  /** The provider endpoints, for token refresh. */
  discovery: Discovery;
  /** The current tokens. Held in memory only; the client renews them in place. */
  tokens: TokenSet;
  /** Who the tokens identify. */
  identity: Identity;
}

/** What the backend answered to the first authenticated request. */
export type ProbeResult =
  | { kind: 'ok' }
  | { kind: 'rejected'; status: number }
  | { kind: 'unreachable'; message: string };

/**
 * Builds the connection of a completed login.
 *
 * @param profile - The profile logged in to.
 * @param discovery - The provider endpoints.
 * @param tokens - The tokens of the login.
 * @returns The connection.
 */
export function createConnection(
  profile: Profile,
  discovery: Discovery,
  tokens: TokenSet,
): Connection {
  return {
    profile,
    discovery,
    tokens,
    identity: identityOf(tokens.accessToken),
  };
}

/**
 * Checks that the backend accepts the token, with a minimal media listing.
 *
 * @param connection - The connection to probe.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns What the backend answered.
 */
export async function probeBackend(
  connection: Connection,
  fetchFn: FetchLike = fetch,
): Promise<ProbeResult> {
  const url = new URL('/v1/media?limit=1', connection.profile.backend);
  let response: Response;
  try {
    response = await fetchFn(url.toString(), {
      headers: {
        authorization: `Bearer ${connection.tokens.accessToken}`,
        accept: 'application/json',
      },
    });
  } catch (error) {
    return { kind: 'unreachable', message: (error as Error).message };
  }
  if (response.ok) {
    return { kind: 'ok' };
  }
  if (response.status === 401 || response.status === 403) {
    return { kind: 'rejected', status: response.status };
  }
  return { kind: 'unreachable', message: `HTTP ${response.status}` };
}
