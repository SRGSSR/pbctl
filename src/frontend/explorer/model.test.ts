import { expect, test } from 'bun:test';
import type { Media } from '../../engine/engine';
import {
  BIN_ID,
  canWrite,
  folderDetail,
  folderNodes,
  inspectorLines,
  isAdmin,
  mediaDetail,
  mediaRow,
  mediaTitle,
  sourceSummary,
  UNASSIGNED_ID,
} from './model';

const media: Media = {
  id: 'urn:rts:video:1',
  tags: ['drama', 's1'],
  sources: [
    { url: 'http://a/master.m3u8', mimeType: 'application/x-mpegURL' },
    { url: 'http://a/file.mp4', mimeType: 'video/mp4' },
    { url: 'http://a/other.mp4', mimeType: 'video/mp4' },
  ],
  metadata: { title: 'The pilot', subtitle: 'Season 1' },
  deleted: false,
  createdAt: '2026-01-01T00:00:00Z',
  lastModified: '2026-01-01T00:00:00Z',
  expiresAt: '2029-05-31T12:14:00Z',
};

test('folderNodes puts the unassigned root first and sorts siblings by name', () => {
  const stamp = { createdAt: '', updatedAt: '', mediaCount: 0 };
  const folders = [
    { id: 'b', name: 'Zeta', ...stamp },
    { id: 'a', name: 'Alpha', ...stamp },
    { id: 'c', name: 'Child', parentId: 'a', ...stamp },
  ];
  const nodes = folderNodes(folders, false);
  expect(nodes.map((node) => node.id)).toEqual([UNASSIGNED_ID, 'a', 'c', 'b']);
  expect(nodes[2]?.parentId).toBe('a');
  expect(folderNodes(folders, true).map((node) => node.id)).toEqual([
    UNASSIGNED_ID,
    BIN_ID,
    'a',
    'c',
    'b',
  ]);
});

test('mediaTitle falls back to the id', () => {
  expect(mediaTitle(media)).toBe('The pilot');
  expect(mediaTitle({ ...media, metadata: { title: ' ' } })).toBe(
    'urn:rts:video:1',
  );
});

test('sourceSummary names the formats once each', () => {
  expect(sourceSummary(media)).toBe('hls, mp4');
  expect(sourceSummary({ ...media, sources: [] })).toBe('no source');
  expect(
    sourceSummary({
      ...media,
      sources: [{ url: 'x' }, { url: 'y', mimeType: 'application/dash+xml' }],
    }),
  ).toBe('unknown, dash');
});

test('mediaRow pads the title and truncates with an ellipsis', () => {
  expect(mediaRow(media, 30)).toBe('The pilot             hls, mp4');
  expect(
    mediaRow({ ...media, metadata: { title: 'A very long title indeed' } }, 24),
  ).toBe('A very long t…  hls, mp4');
  expect(mediaRow({ ...media, deleted: true }, 40)).toContain('[bin]');
  expect(
    mediaRow({ ...media, expiresAt: '2000-01-01T00:00:00Z' }, 40),
  ).toContain('[expired]');
});

test('inspectorLines joins the title, subtitle, id, then the details', () => {
  expect(inspectorLines(media)).toEqual([
    'The pilot · Season 1 · urn:rts:video:1',
    'tags: drama, s1   sources: hls, mp4   expires: 2029-05-31',
  ]);
  expect(
    inspectorLines({ ...media, tags: undefined, expiresAt: undefined })[1],
  ).toBe('tags: none   sources: hls, mp4   expires: never');
});

test('isAdmin reads the Admin role with or without a prefix', () => {
  const identity = {
    subject: '1',
    name: 'Ada',
    roles: ['PillarboxDemo.Write'],
  };
  expect(isAdmin(identity)).toBe(false);
  expect(isAdmin({ ...identity, roles: ['PillarboxDemo.Admin'] })).toBe(true);
  expect(isAdmin({ ...identity, roles: ['Admin'] })).toBe(true);
});

test('the row and the inspector survive a media without sources or metadata', () => {
  const bare: Media = {
    id: 'urn:bare',
    deleted: true,
    createdAt: '',
    lastModified: '',
  };
  expect(mediaRow(bare, 30)).toBe('urn:bare       no source [bin]');
  expect(inspectorLines(bare)).toEqual([
    'urn:bare',
    'tags: none   sources: no source   expires: never',
  ]);
});

test('mediaDetail shows the backend count of a folder, else the rows fetched', () => {
  const stamp = { createdAt: '', updatedAt: '' };
  const folders = [{ id: 'a', name: 'Alpha', mediaCount: 7, ...stamp }];
  const base = { folders, media: [1, 2], query: '', loadingMedia: false };
  expect(mediaDetail({ ...base, folder: { id: 'a' } })).toBe('7 media');
  expect(mediaDetail({ ...base, folder: { id: 'a' }, query: 'surf' })).toBe(
    '2 media',
  );
  expect(mediaDetail({ ...base, folder: { id: UNASSIGNED_ID } })).toBe(
    '2 media',
  );
  expect(mediaDetail({ ...base, folder: undefined })).toBe('2 media');
  expect(
    mediaDetail({ ...base, folder: { id: 'a' }, loadingMedia: true }),
  ).toBe('loading…');
});

test('folderNodes locks a folder with grants', () => {
  const stamp = { createdAt: '', updatedAt: '', mediaCount: 0 };
  const folders = [
    { id: 'a', name: 'Alpha', ...stamp },
    { id: 'b', name: 'Beta', ...stamp },
    { id: 'c', name: 'Gamma', ...stamp },
  ];
  const nodes = folderNodes(folders, false, { a: 'denied', b: 'granted' });
  expect(nodes.map((node) => node.label)).toEqual([
    '[Unassigned media]',
    'Alpha \u{1F512}',
    'Beta \u{1F513}',
    'Gamma',
  ]);
});

test('canWrite reads the Write and Admin roles', () => {
  const identity = { subject: '1', name: 'Ada', roles: ['PillarboxDemo.Read'] };
  expect(canWrite(identity)).toBe(false);
  expect(canWrite({ ...identity, roles: [] })).toBe(false);
  expect(canWrite({ ...identity, roles: ['PillarboxDemo.Write'] })).toBe(true);
  expect(canWrite({ ...identity, roles: ['Admin'] })).toBe(true);
});

test('mediaRow flags a marked media next to its state', () => {
  expect(mediaRow(media, 40, true)).toContain('[marked]');
  expect(mediaRow({ ...media, deleted: true }, 44, true)).toContain(
    '[bin] [marked]',
  );
  expect(mediaRow(media, 40, false)).not.toContain('[marked]');
});

test('folderDetail shows the loading flag, then the marked title', () => {
  const mark = { title: 'The pilot' };
  expect(folderDetail({ loadingFolders: true, mark })).toBe('loading…');
  expect(folderDetail({ loadingFolders: false, mark: undefined })).toBe(
    undefined,
  );
  expect(folderDetail({ loadingFolders: false, mark })).toBe('→ The pilot');
  expect(
    folderDetail({ loadingFolders: false, mark: { title: 'A longer title' } }),
  ).toBe('→ A longer ti…');
});
