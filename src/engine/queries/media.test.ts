import { expect, test } from 'bun:test';
import type { Connection } from '../connection/connection';
import type { FetchLike } from '../connection/detect';
import { getMedia, listFolderMedia, listMedia } from './media';

const connection: Connection = {
  profile: {
    name: 'local',
    backend: 'http://localhost:8080',
    issuer: 'http://idp',
    clientId: 'pbctl',
    scopes: [],
    tlsVerify: true,
  },
  discovery: {
    issuer: 'http://idp',
    deviceAuthorizationEndpoint: 'http://idp/device',
    tokenEndpoint: 'http://idp/token',
  },
  tokens: { accessToken: 'at', expiresAt: Date.now() + 3_600_000 },
  identity: { subject: '1', name: 'Ada', roles: [] },
};

/**
 * Builds a fetch stub answering one JSON body and recording the URL.
 *
 * @param body - The answer.
 * @returns The stub and the recorded URL.
 */
function stub(body: unknown): { fetchFn: FetchLike; seen: { url?: string } } {
  const seen: { url?: string } = {};
  const fetchFn: FetchLike = (url) => {
    seen.url = url;
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  };
  return { fetchFn, seen };
}

test('listFolderMedia pages the folder listing and asks for active media', async () => {
  const { fetchFn, seen } = stub([{ id: 'm1' }]);
  const media = await listFolderMedia(
    connection,
    'f/1',
    { limit: 10, offset: 20 },
    undefined,
    'active',
    fetchFn,
  );
  expect(media.map((item) => item.id)).toEqual(['m1']);
  expect(seen.url).toBe(
    'http://localhost:8080/v1/folder/f%2F1/media?limit=10&offset=20&visibility=active',
  );
});

test('listFolderMedia asks for the bin of a folder', async () => {
  const { fetchFn, seen } = stub([]);
  await listFolderMedia(connection, 'f1', {}, undefined, 'deleted', fetchFn);
  expect(seen.url).toBe(
    'http://localhost:8080/v1/folder/f1/media?limit=50&offset=0&visibility=deleted',
  );
});

test('listMedia adds the text query when given', async () => {
  const { fetchFn, seen } = stub([]);
  await listMedia(connection, {}, 'surf', 'anywhere', 'active', fetchFn);
  expect(seen.url).toBe(
    'http://localhost:8080/v1/media?limit=50&offset=0&q=surf&visibility=active',
  );
});

test('listMedia leaves an empty query out', async () => {
  const { fetchFn, seen } = stub([]);
  await listMedia(connection, {}, '', 'anywhere', 'active', fetchFn);
  expect(seen.url).toBe(
    'http://localhost:8080/v1/media?limit=50&offset=0&visibility=active',
  );
});

test('getMedia fetches one media by id', async () => {
  const { fetchFn, seen } = stub({ id: 'urn:rts:video:1' });
  const media = await getMedia(connection, 'urn:rts:video:1', fetchFn);
  expect(media.id).toBe('urn:rts:video:1');
  expect(seen.url).toBe('http://localhost:8080/v1/media/urn%3Arts%3Avideo%3A1');
});

test('listMedia asks for the unassigned scope', async () => {
  const { fetchFn, seen } = stub([]);
  await listMedia(connection, {}, undefined, 'unassigned', 'active', fetchFn);
  expect(seen.url).toBe(
    'http://localhost:8080/v1/media?limit=50&offset=0&scope=unassigned&visibility=active',
  );
});

test('listFolderMedia adds the text query when given', async () => {
  const { fetchFn, seen } = stub([]);
  await listFolderMedia(connection, 'f1', {}, ' surf ', 'active', fetchFn);
  expect(seen.url).toBe(
    'http://localhost:8080/v1/folder/f1/media?limit=50&offset=0&q=surf&visibility=active',
  );
});

test('listMedia asks for the bin', async () => {
  const { fetchFn, seen } = stub([]);
  await listMedia(connection, {}, undefined, 'anywhere', 'deleted', fetchFn);
  expect(seen.url).toBe(
    'http://localhost:8080/v1/media?limit=50&offset=0&visibility=deleted',
  );
});
