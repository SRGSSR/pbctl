import { expect, test } from 'bun:test';
import type { Profile } from '../config/profile';
import { createConnection, probeBackend } from './connection';
import type { FetchLike } from './detect';

const profile: Profile = {
  name: 'local',
  backend: 'http://localhost:8080',
  issuer: 'http://idp',
  clientId: 'pbctl',
  scopes: ['openid'],
  tlsVerify: true,
};

const discovery = {
  issuer: 'http://idp',
  deviceAuthorizationEndpoint: 'http://idp/device',
  tokenEndpoint: 'http://idp/token',
};

const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(
  JSON.stringify({ sub: '1', name: 'Ada', roles: ['PillarboxDemo.Write'] }),
).toString('base64url')}.sig`;

const connection = createConnection(profile, discovery, {
  accessToken: token,
  expiresAt: 0,
});

/**
 * Builds a fetch stub answering one status and recording the request.
 *
 * @param status - The HTTP status.
 * @returns The stub and the seen request.
 */
function stub(status: number): {
  fetchFn: FetchLike;
  seen: { url?: string; auth?: string };
} {
  const seen: { url?: string; auth?: string } = {};
  const fetchFn: FetchLike = (url, init) => {
    seen.url = url;
    const headers = init?.headers as Record<string, string> | undefined;
    seen.auth = headers?.authorization;
    return Promise.resolve(new Response(null, { status }));
  };
  return { fetchFn, seen };
}

test('createConnection decodes the identity from the access token', () => {
  expect(connection.identity).toEqual({
    subject: '1',
    name: 'Ada',
    roles: ['PillarboxDemo.Write'],
  });
});

test('probeBackend sends the bearer to the media listing', async () => {
  const { fetchFn, seen } = stub(200);
  expect(await probeBackend(connection, fetchFn)).toEqual({ kind: 'ok' });
  expect(seen.url).toBe('http://localhost:8080/v1/media?limit=1');
  expect(seen.auth).toBe(`Bearer ${token}`);
});

test('probeBackend reports a rejected token', async () => {
  expect(await probeBackend(connection, stub(401).fetchFn)).toEqual({
    kind: 'rejected',
    status: 401,
  });
});

test('probeBackend reports other failures as unreachable', async () => {
  expect(await probeBackend(connection, stub(502).fetchFn)).toEqual({
    kind: 'unreachable',
    message: 'HTTP 502',
  });
  const failing: FetchLike = () => Promise.reject(new Error('refused'));
  expect(await probeBackend(connection, failing)).toEqual({
    kind: 'unreachable',
    message: 'refused',
  });
});
