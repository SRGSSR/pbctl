import { expect, test } from 'bun:test';
import type { Connection } from '../connection/connection';
import type { FetchLike } from '../connection/detect';
import type { Media } from '../queries/media';
import {
  assignMedia,
  createFolder,
  deleteFolder,
  renameFolder,
  unassignMedia,
} from './folders';
import { deleteMedia, restoreMedia, saveMedia, toDocument } from './media';

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

const media: Media = {
  id: 'urn:rts:video:1',
  tags: ['a', 'b'],
  sources: [{ url: 'http://a/master.m3u8', mimeType: 'application/x-mpegURL' }],
  metadata: { title: 'The pilot' },
  deleted: false,
  createdAt: '2026-01-01T00:00:00Z',
  lastModified: '2026-01-01T00:00:00Z',
};

/** One recorded request. */
interface Seen {
  url: string;
  method?: string;
  body?: unknown;
}

/**
 * Builds a fetch stub answering one body and recording the request.
 *
 * @param body - The answer body, absent for an empty answer.
 * @param status - The HTTP status.
 * @returns The stub and the recorded request.
 */
function stub(
  body?: unknown,
  status = 200,
): { fetchFn: FetchLike; seen: Seen } {
  const seen: Seen = { url: '' };
  const fetchFn: FetchLike = (url, init) => {
    seen.url = url;
    seen.method = init?.method;
    seen.body =
      init?.body === undefined ? undefined : JSON.parse(String(init.body));
    return Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
      }),
    );
  };
  return { fetchFn, seen };
}

test('createFolder posts the name and parent', async () => {
  const { fetchFn, seen } = stub({ id: 'f1', name: 'Shows' });
  const folder = await createFolder(connection, 'Shows', 'root', fetchFn);
  expect(folder.id).toBe('f1');
  expect(seen).toEqual({
    url: 'http://localhost:8080/v1/folder',
    method: 'POST',
    body: { name: 'Shows', parentId: 'root' },
  });
});

test('renameFolder patches the name and keeps the parent', async () => {
  const { fetchFn, seen } = stub({ id: 'f1', name: 'Series' });
  const folder = {
    id: 'f1',
    name: 'Shows',
    parentId: 'root',
    createdAt: '',
    updatedAt: '',
    mediaCount: 0,
  };
  await renameFolder(connection, folder, 'Series', fetchFn);
  expect(seen).toEqual({
    url: 'http://localhost:8080/v1/folder/f1',
    method: 'PATCH',
    body: { name: 'Series', parentId: 'root' },
  });
});

test('deleteFolder, assignMedia, and unassignMedia hit the folder routes', async () => {
  const deleted = stub(undefined, 204);
  await deleteFolder(connection, 'f1', deleted.fetchFn);
  expect(deleted.seen).toEqual({
    url: 'http://localhost:8080/v1/folder/f1',
    method: 'DELETE',
  });
  const assigned = stub({}, 201);
  await assignMedia(connection, 'f1', 'urn:rts:video:1', assigned.fetchFn);
  expect(assigned.seen).toEqual({
    url: 'http://localhost:8080/v1/folder/f1/media',
    method: 'POST',
    body: { mediaId: 'urn:rts:video:1' },
  });
  const unassigned = stub(undefined, 204);
  await unassignMedia(connection, 'f1', 'urn:rts:video:1', unassigned.fetchFn);
  expect(unassigned.seen).toEqual({
    url: 'http://localhost:8080/v1/folder/f1/media/urn%3Arts%3Avideo%3A1',
    method: 'DELETE',
  });
});

test('toDocument keeps the editable fields and defaults the tags', () => {
  expect(toDocument({ ...media, tags: undefined })).toEqual({
    id: 'urn:rts:video:1',
    tags: [],
    sources: media.sources ?? [],
    metadata: { title: 'The pilot' },
    expiresAt: undefined,
  });
  expect(
    toDocument({ ...media, sources: undefined, metadata: undefined }),
  ).toEqual({
    id: 'urn:rts:video:1',
    tags: ['a', 'b'],
    sources: [],
    metadata: {},
    expiresAt: undefined,
  });
});

test('saveMedia posts the document', async () => {
  const { fetchFn, seen } = stub(media);
  const saved = await saveMedia(connection, toDocument(media), fetchFn);
  expect(saved.id).toBe('urn:rts:video:1');
  expect(seen.method).toBe('POST');
  expect(seen.url).toBe('http://localhost:8080/v1/media');
  expect((seen.body as { tags: string[] }).tags).toEqual(['a', 'b']);
});

test('deleteMedia deletes by id', async () => {
  const { fetchFn, seen } = stub(undefined, 204);
  await deleteMedia(connection, 'urn:rts:video:1', fetchFn);
  expect(seen).toEqual({
    url: 'http://localhost:8080/v1/media/urn%3Arts%3Avideo%3A1',
    method: 'DELETE',
  });
});

test('restoreMedia posts to the restore route', async () => {
  const { fetchFn, seen } = stub({}, 201);
  await restoreMedia(connection, 'urn:rts:video:1', fetchFn);
  expect(seen).toEqual({
    url: 'http://localhost:8080/v1/media/urn%3Arts%3Avideo%3A1/restore',
    method: 'POST',
  });
});
