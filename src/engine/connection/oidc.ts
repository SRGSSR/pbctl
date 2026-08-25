// The OIDC device authorization flow: discovery, device code, token polling, refresh.

import { discoveryUrl } from '../config/profile';
import type { FetchLike } from './detect';

/** The identity provider endpoints the device flow needs. */
export interface Discovery {
  /** The issuer as the provider states it. */
  issuer: string;
  /** Where the device code is requested. */
  deviceAuthorizationEndpoint: string;
  /** Where codes and refresh tokens are exchanged for tokens. */
  tokenEndpoint: string;
}

/** A pending device login. */
export interface DeviceAuthorization {
  /** The code pbctl polls the token endpoint with. */
  deviceCode: string;
  /** The code the user types in the browser. */
  userCode: string;
  /** The page where the user enters the code. */
  verificationUri: string;
  /** The same page with the code pre-filled, when the provider offers one. */
  verificationUriComplete?: string;
  /** Seconds until the codes expire. */
  expiresIn: number;
  /** Seconds to wait between polls. */
  interval: number;
}

/** The tokens of a completed login. */
export interface TokenSet {
  /** The bearer token sent to the backend. */
  accessToken: string;
  /** The token that renews the access token, when the provider issued one. */
  refreshToken?: string;
  /** When the access token expires, in epoch milliseconds. */
  expiresAt: number;
}

/** The grant type of the device flow token request. */
const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

/** The access token lifetime assumed when the provider states none. */
const DEFAULT_LIFETIME_SECONDS = 300;

/**
 * Fetches the discovery document of an issuer.
 *
 * @param issuer - The issuer URL.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns The endpoints the device flow needs.
 */
export async function fetchDiscovery(
  issuer: string,
  fetchFn: FetchLike = fetch,
): Promise<Discovery> {
  const url = discoveryUrl(issuer);
  const response = await fetchFn(url, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Discovery failed: HTTP ${response.status} from ${url}.`);
  }
  const document = (await response.json()) as Record<string, unknown>;
  const tokenEndpoint = document.token_endpoint;
  const deviceEndpoint = document.device_authorization_endpoint;
  if (typeof tokenEndpoint !== 'string') {
    throw new Error('The discovery document has no token_endpoint.');
  }
  if (typeof deviceEndpoint !== 'string') {
    throw new Error(
      'The identity provider does not offer the device authorization grant.',
    );
  }
  return {
    issuer: typeof document.issuer === 'string' ? document.issuer : issuer,
    deviceAuthorizationEndpoint: deviceEndpoint,
    tokenEndpoint,
  };
}

/**
 * Starts a device login.
 *
 * @param discovery - The provider endpoints.
 * @param clientId - The public client pbctl authenticates as.
 * @param scopes - The scopes to request.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns The codes the user and the poller need.
 */
export async function requestDeviceCode(
  discovery: Discovery,
  clientId: string,
  scopes: string[],
  fetchFn: FetchLike = fetch,
): Promise<DeviceAuthorization> {
  const body = await postForm(fetchFn, discovery.deviceAuthorizationEndpoint, {
    client_id: clientId,
    scope: scopes.join(' '),
  });
  if (body.error !== undefined) {
    throw new Error(describeError(body));
  }
  return {
    deviceCode: requireString(body, 'device_code'),
    userCode: requireString(body, 'user_code'),
    verificationUri: requireString(body, 'verification_uri'),
    verificationUriComplete: optionalString(body, 'verification_uri_complete'),
    expiresIn: numberOr(body.expires_in, DEFAULT_LIFETIME_SECONDS),
    interval: numberOr(body.interval, 5),
  };
}

/** How the poller waits and talks to the provider. Tests replace both. */
export interface PollOptions {
  /** Aborts the polling; the promise rejects with "Login cancelled.". */
  signal?: AbortSignal;
  /** Waits for the given milliseconds, rejecting when the signal aborts. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** The fetch implementation, the global one when omitted. */
  fetchFn?: FetchLike;
}

/**
 * Polls the token endpoint until the user completes the login in the browser.
 *
 * @param discovery - The provider endpoints.
 * @param clientId - The public client pbctl authenticates as.
 * @param auth - The pending device login.
 * @param options - The poll options.
 * @returns The tokens.
 */
export async function pollForToken(
  discovery: Discovery,
  clientId: string,
  auth: DeviceAuthorization,
  options: PollOptions = {},
): Promise<TokenSet> {
  const sleep = options.sleep ?? wait;
  const fetchFn = options.fetchFn ?? fetch;
  const deadline = Date.now() + auth.expiresIn * 1000;
  let interval = auth.interval;
  while (Date.now() < deadline) {
    await sleep(interval * 1000, options.signal);
    const outcome = await pollOnce(discovery, clientId, auth, fetchFn);
    if (outcome.tokens !== undefined) {
      return outcome.tokens;
    }
    if (outcome.slowDown) {
      interval += 5;
    }
  }
  throw new Error('The login code expired before the login completed.');
}

/**
 * Renews the tokens with a refresh token.
 *
 * @param discovery - The provider endpoints.
 * @param clientId - The public client pbctl authenticates as.
 * @param refreshToken - The refresh token of the current login.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns The new tokens. The old refresh token is kept when none is issued.
 */
export async function refreshTokens(
  discovery: Discovery,
  clientId: string,
  refreshToken: string,
  fetchFn: FetchLike = fetch,
): Promise<TokenSet> {
  const body = await postForm(fetchFn, discovery.tokenEndpoint, {
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
  });
  if (body.error !== undefined) {
    throw new Error(describeError(body));
  }
  const tokens = toTokenSet(body);
  return { ...tokens, refreshToken: tokens.refreshToken ?? refreshToken };
}

/**
 * Makes one token request of the device flow.
 *
 * @param discovery - The provider endpoints.
 * @param clientId - The public client pbctl authenticates as.
 * @param auth - The pending device login.
 * @param fetchFn - The fetch implementation.
 * @returns The tokens when the login completed, else whether to slow down.
 */
async function pollOnce(
  discovery: Discovery,
  clientId: string,
  auth: DeviceAuthorization,
  fetchFn: FetchLike,
): Promise<{ tokens?: TokenSet; slowDown: boolean }> {
  const body = await postForm(fetchFn, discovery.tokenEndpoint, {
    grant_type: DEVICE_GRANT,
    client_id: clientId,
    device_code: auth.deviceCode,
  });
  if (body.error === undefined) {
    return { tokens: toTokenSet(body), slowDown: false };
  }
  if (body.error === 'authorization_pending') {
    return { slowDown: false };
  }
  if (body.error === 'slow_down') {
    return { slowDown: true };
  }
  throw new Error(describeError(body));
}

/**
 * Posts a form and parses the JSON answer, whatever the status: OAuth error
 * answers are JSON bodies on 4xx statuses.
 *
 * @param fetchFn - The fetch implementation.
 * @param url - The endpoint.
 * @param params - The form fields.
 * @returns The parsed body.
 */
async function postForm(
  fetchFn: FetchLike,
  url: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const response = await fetchFn(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: new URLSearchParams(params).toString(),
  });
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    throw new Error(`HTTP ${response.status} from ${url} is not JSON.`);
  }
}

/**
 * Reads a token endpoint answer.
 *
 * @param body - The parsed answer.
 * @returns The tokens.
 */
function toTokenSet(body: Record<string, unknown>): TokenSet {
  const lifetime = numberOr(body.expires_in, DEFAULT_LIFETIME_SECONDS);
  return {
    accessToken: requireString(body, 'access_token'),
    refreshToken: optionalString(body, 'refresh_token'),
    expiresAt: Date.now() + lifetime * 1000,
  };
}

/**
 * Formats an OAuth error answer.
 *
 * @param body - The parsed answer carrying `error`.
 * @returns The message.
 */
function describeError(body: Record<string, unknown>): string {
  const description = optionalString(body, 'error_description');
  return description === undefined
    ? String(body.error)
    : `${String(body.error)}: ${description}`;
}

/**
 * Reads a required string field.
 *
 * @param body - The parsed answer.
 * @param field - The field name.
 * @returns The value.
 */
function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value === '') {
    throw new Error(`The identity provider answer has no ${field}.`);
  }
  return value;
}

/**
 * Reads an optional string field.
 *
 * @param body - The parsed answer.
 * @param field - The field name.
 * @returns The value, or undefined when absent or not a string.
 */
function optionalString(
  body: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = body[field];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * Reads a number field with a fallback.
 *
 * @param value - The field value.
 * @param fallback - The value used when the field is not a number.
 * @returns The number.
 */
function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Waits, or rejects as soon as the signal aborts.
 *
 * @param ms - The milliseconds to wait.
 * @param signal - The abort signal.
 * @returns Nothing.
 */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Login cancelled.'));
      return;
    }
    const cancel = (): void => {
      clearTimeout(timer);
      reject(new Error('Login cancelled.'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }, ms);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}
