import { expect, test } from 'bun:test';
import {
  detectIdentityProvider,
  type FetchLike,
  parseAuthorizeUrl,
} from './detect';

const KEYCLOAK =
  'http://localhost:8081/realms/pillarbox/protocol/openid-connect/auth' +
  '?client_id=pillarbox-api&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fcallback' +
  '&scope=openid+profile+email&state=abc&response_type=code';

const ENTRA =
  'https://login.microsoftonline.com/11111111-2222-3333-4444-555555555555' +
  '/oauth2/v2.0/authorize?client_id=pbctl&response_type=code';

/**
 * Builds a fetch stub answering every request with the given response.
 *
 * @param status - The HTTP status.
 * @param location - The Location header, absent when omitted.
 * @returns The stub.
 */
function fetchStub(status: number, location?: string): FetchLike {
  const headers = location === undefined ? {} : { location };
  return () => Promise.resolve(new Response(null, { status, headers }));
}

test('parseAuthorizeUrl derives a Keycloak realm issuer', () => {
  expect(parseAuthorizeUrl(KEYCLOAK)).toEqual({
    issuer: 'http://localhost:8081/realms/pillarbox',
    clientId: 'pillarbox-api',
  });
});

test('parseAuthorizeUrl derives an Entra tenant issuer', () => {
  expect(parseAuthorizeUrl(ENTRA)).toEqual({
    issuer:
      'https://login.microsoftonline.com/11111111-2222-3333-4444-555555555555/v2.0',
    clientId: 'pbctl',
  });
});

test('parseAuthorizeUrl drops the last segment for unknown providers', () => {
  expect(
    parseAuthorizeUrl('https://idp.example.com/oauth/authorize?client_id=x'),
  ).toEqual({ issuer: 'https://idp.example.com/oauth', clientId: 'x' });
});

test('parseAuthorizeUrl rejects a URL without a client id', () => {
  expect(parseAuthorizeUrl('https://idp.example.com/authorize')).toBe(
    undefined,
  );
  expect(
    parseAuthorizeUrl('https://idp.example.com/authorize?client_id='),
  ).toBe(undefined);
});

test('parseAuthorizeUrl rejects an invalid URL', () => {
  expect(parseAuthorizeUrl('not a url')).toBe(undefined);
});

test('detectIdentityProvider follows the login redirect', async () => {
  const hint = await detectIdentityProvider(
    'http://localhost:8080',
    fetchStub(302, KEYCLOAK),
  );
  expect(hint).toEqual({
    issuer: 'http://localhost:8081/realms/pillarbox',
    clientId: 'pillarbox-api',
  });
});

test('detectIdentityProvider resolves a relative redirect', async () => {
  const hint = await detectIdentityProvider(
    'http://localhost:8080',
    fetchStub(302, '/oauth/authorize?client_id=self'),
  );
  expect(hint).toEqual({
    issuer: 'http://localhost:8080/oauth',
    clientId: 'self',
  });
});

test('detectIdentityProvider returns undefined without a redirect', async () => {
  expect(
    await detectIdentityProvider('http://localhost:8080', fetchStub(200)),
  ).toBe(undefined);
  expect(
    await detectIdentityProvider('http://localhost:8080', fetchStub(302)),
  ).toBe(undefined);
});

test('detectIdentityProvider returns undefined when the backend is down', async () => {
  const failing: FetchLike = () => Promise.reject(new Error('refused'));
  expect(await detectIdentityProvider('http://localhost:8080', failing)).toBe(
    undefined,
  );
});
