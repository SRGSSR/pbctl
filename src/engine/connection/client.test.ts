import { expect, test } from 'bun:test';
import type { Profile } from '../config/profile';
import { ApiError, apiRequest } from './client';
import type { Connection } from './connection';
import type { FetchLike } from './detect';

const profile: Profile = {
  name: 'local',
  backend: 'http://localhost:8080',
  issuer: 'http://idp',
  clientId: 'pbctl',
  scopes: ['openid'],
  tlsVerify: true,
};

/**
 * Builds a connection whose access token expires at the given time.
 *
 * @param expiresAt - The expiry in epoch milliseconds.
 * @param refreshToken - The refresh token, absent when omitted.
 * @returns The connection.
 */
function connectionAt(expiresAt: number, refreshToken?: string): Connection {
  return {
    profile,
    discovery: {
      issuer: 'http://idp',
      deviceAuthorizationEndpoint: 'http://idp/device',
      tokenEndpoint: 'http://idp/token',
    },
    tokens: { accessToken: 'at', refreshToken, expiresAt },
    identity: { subject: '1', name: 'Ada', roles: [] },
  };
}

/** One recorded request. */
interface Seen {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body?: string;
}

/**
 * Builds a fetch stub answering in order and recording the requests.
 *
 * @param answers - The answers, as status and body text.
 * @returns The stub and the recorded requests.
 */
function stub(answers: { status: number; body?: string }[]): {
  fetchFn: FetchLike;
  seen: Seen[];
} {
  const seen: Seen[] = [];
  const fetchFn: FetchLike = (url, init) => {
    seen.push({
      url,
      method: init?.method,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body === undefined ? undefined : String(init.body),
    });
    const answer = answers[Math.min(seen.length, answers.length) - 1];
    return Promise.resolve(
      new Response(answer?.body ?? null, { status: answer?.status ?? 200 }),
    );
  };
  return { fetchFn, seen };
}

test('apiRequest sends the bearer and parses the JSON answer', async () => {
  const { fetchFn, seen } = stub([{ status: 200, body: '[{"id":"f1"}]' }]);
  const result = await apiRequest<{ id: string }[]>(
    connectionAt(Date.now() + 3_600_000),
    '/v1/folder',
    { query: { limit: 100, offset: 0, parentId: undefined } },
    fetchFn,
  );
  expect(result).toEqual([{ id: 'f1' }]);
  expect(seen[0]?.url).toBe(
    'http://localhost:8080/v1/folder?limit=100&offset=0',
  );
  expect(seen[0]?.headers.authorization).toBe('Bearer at');
  expect(seen[0]?.method).toBe('GET');
});

test('apiRequest posts a JSON body and returns undefined for an empty answer', async () => {
  const { fetchFn, seen } = stub([{ status: 204 }]);
  const result = await apiRequest(
    connectionAt(Date.now() + 3_600_000),
    '/v1/folder',
    { method: 'POST', body: { name: 'x' } },
    fetchFn,
  );
  expect(result).toBe(undefined);
  expect(seen[0]?.method).toBe('POST');
  expect(seen[0]?.headers['content-type']).toBe('application/json');
  expect(seen[0]?.body).toBe('{"name":"x"}');
});

test('apiRequest throws an ApiError with the answer message', async () => {
  const { fetchFn } = stub([
    { status: 403, body: '{"message":"Write access required"}' },
  ]);
  const error = await apiRequest(
    connectionAt(Date.now() + 3_600_000),
    '/v1/media',
    {},
    fetchFn,
  ).catch((thrown: unknown) => thrown);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).status).toBe(403);
  expect((error as ApiError).message).toBe('Write access required');
});

test('apiRequest renews an expiring token before the request', async () => {
  const connection = connectionAt(Date.now() + 5_000, 'rt');
  const { fetchFn, seen } = stub([
    { status: 200, body: '{"access_token":"at2","expires_in":300}' },
    { status: 200, body: '[]' },
  ]);
  await apiRequest(connection, '/v1/folder', {}, fetchFn);
  expect(seen[0]?.url).toBe('http://idp/token');
  expect(seen[1]?.headers.authorization).toBe('Bearer at2');
  expect(connection.tokens.accessToken).toBe('at2');
  expect(connection.tokens.refreshToken).toBe('rt');
});

test('apiRequest keeps a fresh token', async () => {
  const { fetchFn, seen } = stub([{ status: 200, body: '[]' }]);
  await apiRequest(
    connectionAt(Date.now() + 3_600_000, 'rt'),
    '/v1/folder',
    {},
    fetchFn,
  );
  expect(seen).toHaveLength(1);
});
