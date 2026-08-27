import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  type Config,
  DEFAULT_SCOPES,
  discoveryUrl,
  type Profile,
  ProfileStore,
} from './profile';

const dir = mkdtempSync(join(tmpdir(), 'pbctl-test-'));
const path = join(dir, 'nested', 'config.json');
const store = new ProfileStore(path);

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const local: Profile = {
  name: 'local',
  backend: 'http://localhost:8080',
  issuer: 'http://localhost:8081/realms/pillarbox',
  clientId: 'pillarbox-api',
  scopes: [...DEFAULT_SCOPES],
  tlsVerify: true,
};
const prod: Profile = {
  name: 'prod',
  backend: 'https://pillarbox.example.com',
  issuer: 'https://login.microsoftonline.com/tenant/v2.0',
  clientId: 'pbctl',
  scopes: ['openid', 'api://pillarbox/.default'],
  tlsVerify: true,
};

/**
 * Seeds the store with the local and prod profiles.
 *
 * @returns Nothing.
 */
function seed(): void {
  store.upsert(local);
  store.upsert(prod);
}

test('discoveryUrl appends the well-known path to the issuer', () => {
  expect(discoveryUrl('http://localhost:8081/realms/pillarbox')).toBe(
    'http://localhost:8081/realms/pillarbox/.well-known/openid-configuration',
  );
});

test('discoveryUrl tolerates a trailing slash on the issuer', () => {
  expect(discoveryUrl('https://idp.example.com/')).toBe(
    'https://idp.example.com/.well-known/openid-configuration',
  );
});

test('upsert then load round-trips the configuration', () => {
  seed();
  const expected: Config = { profiles: [local, prod] };
  expect(store.load()).toEqual(expected);
});

test('load returns an empty configuration when the file does not exist', () => {
  expect(new ProfileStore(join(dir, 'missing.json')).load()).toEqual({
    profiles: [],
  });
});

test('load rejects invalid JSON', () => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, '{ not json');
  expect(() => store.load()).toThrow('Invalid JSON');
});

test('load rejects a file without a profiles array', () => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, '{ "profiles": "nope" }');
  expect(() => store.load()).toThrow('"profiles" must be an array');
});

test('upsert adds a new profile', () => {
  seed();
  store.upsert({ ...local, name: 'staging' });
  expect(store.load().profiles).toHaveLength(3);
});

test('upsert replaces a profile with the same name', () => {
  seed();
  store.upsert({ ...prod, backend: 'https://new.example.com' });
  const profiles = store.load().profiles;
  expect(profiles).toHaveLength(2);
  expect(profiles.find((profile) => profile.name === 'prod')?.backend).toBe(
    'https://new.example.com',
  );
});

test('upsert works without an existing configuration file', () => {
  const fresh = new ProfileStore(join(dir, 'fresh', 'config.json'));
  fresh.upsert(local);
  expect(fresh.load()).toEqual({ profiles: [local] });
});

test('remove deletes the profile and keeps the others', () => {
  seed();
  expect(store.remove('prod')).toBe(true);
  expect(store.load().profiles.map((profile) => profile.name)).toEqual([
    'local',
  ]);
});

test('remove reports unknown names', () => {
  seed();
  expect(store.remove('nope')).toBe(false);
});
