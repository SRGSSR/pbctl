// The HTTP client: bearer requests to the backend, with a silent token refresh.

import type { Connection } from './connection';
import type { FetchLike } from './detect';
import { refreshTokens } from './oidc';

/** One request to the backend. */
export interface ApiRequest {
  /** The HTTP method. GET when omitted. */
  method?: string;
  /** The JSON body. */
  body?: unknown;
  /** The query parameters; undefined values are left out. */
  query?: Record<string, string | number | undefined>;
}

/** A backend answer with an error status. */
export class ApiError extends Error {
  /** The HTTP status. */
  readonly status: number;

  /**
   * Creates the error.
   *
   * @param status - The HTTP status.
   * @param message - The message from the answer, or the status text.
   */
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** How long before the access token expires a refresh starts, in ms. */
const REFRESH_MARGIN_MS = 30_000;

/**
 * Sends a request with the connection's bearer token and parses the JSON
 * answer. An access token about to expire is renewed first, in place on the
 * connection.
 *
 * @param connection - The live connection.
 * @param path - The path under the backend URL, such as `/v1/folder`.
 * @param request - The method, body, and query.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns The parsed answer, undefined for an empty one.
 */
export async function apiRequest<T>(
  connection: Connection,
  path: string,
  request: ApiRequest = {},
  fetchFn: FetchLike = fetch,
): Promise<T> {
  await renewIfNeeded(connection, fetchFn);
  const response = await fetchFn(urlOf(connection, path, request.query), {
    method: request.method ?? 'GET',
    headers: {
      authorization: `Bearer ${connection.tokens.accessToken}`,
      accept: 'application/json',
      ...(request.body === undefined
        ? {}
        : { 'content-type': 'application/json' }),
    },
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
  });
  if (!response.ok) {
    throw new ApiError(response.status, await describe(response));
  }
  const text = await response.text();
  return (text === '' ? undefined : JSON.parse(text)) as T;
}

/**
 * Builds the request URL.
 *
 * @param connection - The live connection.
 * @param path - The path under the backend URL.
 * @param query - The query parameters.
 * @returns The URL.
 */
function urlOf(
  connection: Connection,
  path: string,
  query: ApiRequest['query'],
): string {
  const url = new URL(path, `${connection.profile.backend}/`);
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(name, String(value));
    }
  }
  return url.toString();
}

/**
 * Renews the tokens when the access token expires within the margin.
 *
 * @param connection - The live connection; its tokens are replaced.
 * @param fetchFn - The fetch implementation.
 * @returns Nothing.
 */
async function renewIfNeeded(
  connection: Connection,
  fetchFn: FetchLike,
): Promise<void> {
  const { tokens, discovery, profile } = connection;
  if (
    tokens.refreshToken === undefined ||
    tokens.expiresAt - Date.now() > REFRESH_MARGIN_MS
  ) {
    return;
  }
  connection.tokens = await refreshTokens(
    discovery,
    profile.clientId,
    tokens.refreshToken,
    fetchFn,
  );
}

/**
 * Reads the message of an error answer.
 *
 * @param response - The answer.
 * @returns The `message` or `error` field of a JSON body, else the status text.
 */
async function describe(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}${
    response.statusText === '' ? '' : ` ${response.statusText}`
  }`;
  try {
    const body = (await response.json()) as Record<string, unknown>;
    const message = body.message ?? body.error;
    return typeof message === 'string' && message !== '' ? message : fallback;
  } catch {
    return fallback;
  }
}
