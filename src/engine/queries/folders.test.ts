import { expect, test } from 'bun:test';
import type { Connection } from '../connection/connection';
import type { FetchLike } from '../connection/detect';
import { type Folder, listFolders } from './folders';

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
 * Builds a folder.
 *
 * @param id - The folder id.
 * @returns The folder.
 */
function folder(id: string): Folder {
  return {
    id,
    name: id,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    mediaCount: 0,
  };
}

test('listFolders pages until a short page and concatenates', async () => {
  const urls: string[] = [];
  const first = Array.from({ length: 100 }, (_, index) => folder(`f${index}`));
  const fetchFn: FetchLike = (url) => {
    urls.push(url);
    const body = urls.length === 1 ? first : [folder('last')];
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  };
  const folders = await listFolders(connection, fetchFn);
  expect(folders).toHaveLength(101);
  expect(folders[100]?.id).toBe('last');
  expect(urls).toEqual([
    'http://localhost:8080/v1/folder?limit=100&offset=0',
    'http://localhost:8080/v1/folder?limit=100&offset=100',
  ]);
});

test('listFolders returns an empty list for an empty backend', async () => {
  const fetchFn: FetchLike = () =>
    Promise.resolve(new Response('[]', { status: 200 }));
  expect(await listFolders(connection, fetchFn)).toEqual([]);
});
