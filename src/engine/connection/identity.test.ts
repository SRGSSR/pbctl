import { expect, test } from 'bun:test';
import { identityOf } from './identity';

/**
 * Builds an unsigned JWT with the given payload.
 *
 * @param claims - The payload claims.
 * @returns The token.
 */
function jwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode(claims)}.sig`;
}

test('identityOf prefers the name claim and the roles claim', () => {
  expect(
    identityOf(
      jwt({
        sub: '42',
        name: 'Ada',
        preferred_username: 'ada',
        roles: ['PillarboxDemo.Write'],
        realm_access: { roles: ['ignored'] },
      }),
    ),
  ).toEqual({ subject: '42', name: 'Ada', roles: ['PillarboxDemo.Write'] });
});

test('identityOf falls back to the username and the realm roles', () => {
  expect(
    identityOf(
      jwt({
        sub: '42',
        preferred_username: 'editor',
        realm_access: { roles: ['PillarboxDemo.Write', 7] },
      }),
    ),
  ).toEqual({ subject: '42', name: 'editor', roles: ['PillarboxDemo.Write'] });
});

test('identityOf falls back to the subject without names or roles', () => {
  expect(identityOf(jwt({ sub: '42' }))).toEqual({
    subject: '42',
    name: '42',
    roles: [],
  });
});

test('identityOf rejects tokens that are not JWTs', () => {
  expect(() => identityOf('opaque')).toThrow('not a JWT');
  expect(() => identityOf('a.b.c')).toThrow('not valid JSON');
});
