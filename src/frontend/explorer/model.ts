// Pure helpers of the explorer: tree nodes and row texts.

import type { TreeNode } from 'inkstand';
import type { Folder, Identity, Media } from '../../engine/engine';

/** The id of the virtual folder listing the media assigned to no folder. */
export const UNASSIGNED_ID = 'pbctl:unassigned';

/** The id of the virtual folder listing the bin. */
export const BIN_ID = 'pbctl:bin';

/** The ids of the virtual folders. */
export const VIRTUAL_IDS: readonly string[] = [UNASSIGNED_ID, BIN_ID];

/**
 * Reports whether the user holds the backend's administrator role.
 *
 * @param identity - The logged-in user.
 * @returns Whether a role is named `Admin`, with or without a prefix.
 */
export function isAdmin(identity: Identity): boolean {
  return identity.roles.some((role) => role.split('.').pop() === 'Admin');
}

/**
 * Turns the folders into tree nodes, with the virtual roots first: the
 * unassigned media, and the bin for an administrator.
 *
 * @param folders - The folders from the backend.
 * @param admin - Whether the user may see the bin.
 * @returns The nodes, siblings sorted by name.
 */
export function folderNodes(folders: Folder[], admin: boolean): TreeNode[] {
  const sorted = [...folders].sort((a, b) => a.name.localeCompare(b.name));
  return [
    { id: UNASSIGNED_ID, label: '[Unassigned media]' },
    ...(admin ? [{ id: BIN_ID, label: '[Bin]' }] : []),
    ...sorted.map((folder) => ({
      id: folder.id,
      parentId: folder.parentId,
      label: folder.name,
    })),
  ];
}

/** What the media pane detail is computed from. */
export interface MediaDetailState {
  /** The highlighted folder; undefined before the folders loaded. */
  folder: { id: string } | undefined;
  /** The folders from the backend. */
  folders: Folder[];
  /** The media rows fetched. */
  media: unknown[];
  /** The search query; empty when none. */
  query: string;
  /** Whether the media are loading. */
  loadingMedia: boolean;
}

/**
 * Formats the media count of the media pane. A real folder without a query
 * shows the backend's count; a virtual folder or a query counts the rows
 * fetched, since the backend counts neither.
 *
 * @param state - The explorer state.
 * @returns The count, such as `3 media`, or `loading…`.
 */
export function mediaDetail(state: MediaDetailState): string {
  if (state.loadingMedia) {
    return 'loading…';
  }
  const folder = state.folders.find(
    (candidate) => candidate.id === state.folder?.id,
  );
  const count =
    folder !== undefined && state.query === ''
      ? folder.mediaCount
      : state.media.length;
  return `${count} media`;
}

/**
 * Returns the display title of a media.
 *
 * @param media - The media.
 * @returns The title, or the id when the metadata has none.
 */
export function mediaTitle(media: Media): string {
  const title = media.metadata?.title?.trim();
  return title === undefined || title === '' ? media.id : title;
}

/**
 * Summarizes the sources of a media by MIME type.
 *
 * @param media - The media.
 * @returns The formats, such as `hls, mp4`; `no source` when empty.
 */
export function sourceSummary(media: Media): string {
  const sources = media.sources ?? [];
  if (sources.length === 0) {
    return 'no source';
  }
  const kinds = sources.map((source) => formatOf(source.mimeType));
  return [...new Set(kinds)].join(', ');
}

/**
 * Formats a media as a list row.
 *
 * @param media - The media.
 * @param width - The row width in cells.
 * @returns The title padded to the width, then the source summary.
 */
export function mediaRow(media: Media, width: number): string {
  const summary = sourceSummary(media);
  const flag = media.deleted ? ' [bin]' : expired(media) ? ' [expired]' : '';
  const room = Math.max(width - summary.length - flag.length - 2, 8);
  return `${fit(mediaTitle(media), room)}  ${summary}${flag}`;
}

/**
 * Formats the inspector lines of a media.
 *
 * @param media - The media.
 * @returns Two lines: the title, subtitle, and id (once, when the title is
 * its own), then the tags, sources, and expiry.
 */
export function inspectorLines(media: Media): string[] {
  const subtitle = media.metadata?.subtitle?.trim();
  const title = mediaTitle(media);
  const first = [title, subtitle, title === media.id ? undefined : media.id]
    .filter((part) => part !== undefined && part !== '')
    .join(' · ');
  const tags = (media.tags ?? []).join(', ');
  const second = [
    `tags: ${tags === '' ? 'none' : tags}`,
    `sources: ${sourceSummary(media)}`,
    `expires: ${media.expiresAt === undefined ? 'never' : media.expiresAt.slice(0, 10)}`,
  ].join('   ');
  return [first, second];
}

/**
 * Names a source format from its MIME type.
 *
 * @param mimeType - The MIME type.
 * @returns `hls`, `dash`, `mp4`, the subtype, or `unknown`.
 */
function formatOf(mimeType: string | undefined): string {
  switch (mimeType) {
    case 'application/x-mpegURL':
    case 'application/vnd.apple.mpegurl':
      return 'hls';
    case 'application/dash+xml':
      return 'dash';
    case undefined:
      return 'unknown';
    default:
      return mimeType.split('/').pop() ?? mimeType;
  }
}

/**
 * Reports whether a media's expiry is in the past.
 *
 * @param media - The media.
 * @returns Whether the media expired.
 */
function expired(media: Media): boolean {
  return (
    media.expiresAt !== undefined && Date.parse(media.expiresAt) < Date.now()
  );
}

/**
 * Pads or truncates a text to a width.
 *
 * @param text - The text.
 * @param width - The width in cells.
 * @returns The text at the width, ending with `…` when truncated.
 */
function fit(text: string, width: number): string {
  const chars = [...text];
  if (chars.length <= width) {
    return text.padEnd(width);
  }
  return `${chars.slice(0, Math.max(width - 1, 0)).join('')}…`;
}
