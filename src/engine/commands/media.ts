// Media commands: save, delete, restore.

import { apiRequest } from '../connection/client';
import type { Connection } from '../connection/connection';
import type { FetchLike } from '../connection/detect';
import type { Media, MediaMetadata, MediaSource } from '../queries/media';

/** The part of a media the backend accepts on save. */
export interface MediaDocument {
  /** The media id. */
  id: string;
  /** The tags. */
  tags: string[];
  /** The playable sources. */
  sources: MediaSource[];
  /** The descriptive metadata. */
  metadata: MediaMetadata;
  /** When the media expires, ISO 8601; absent when it does not expire. */
  expiresAt?: string;
}

/**
 * Extracts the editable document of a media.
 *
 * @param media - The media.
 * @returns The document.
 */
export function toDocument(media: Media): MediaDocument {
  return {
    id: media.id,
    tags: media.tags ?? [],
    sources: media.sources ?? [],
    metadata: media.metadata ?? {},
    expiresAt: media.expiresAt,
  };
}

/**
 * Creates or fully replaces a media.
 *
 * @param connection - The live connection.
 * @param document - The media document.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns The saved media.
 */
export function saveMedia(
  connection: Connection,
  document: MediaDocument,
  fetchFn: FetchLike = fetch,
): Promise<Media> {
  return apiRequest<Media>(
    connection,
    '/v1/media',
    { method: 'POST', body: document },
    fetchFn,
  );
}

/**
 * Moves a media to the bin.
 *
 * @param connection - The live connection.
 * @param id - The media id.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns Nothing.
 */
export async function deleteMedia(
  connection: Connection,
  id: string,
  fetchFn: FetchLike = fetch,
): Promise<void> {
  await apiRequest<undefined>(
    connection,
    `/v1/media/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    fetchFn,
  );
}

/**
 * Restores a media from the bin. The backend grants this to `Admin` only.
 *
 * @param connection - The live connection.
 * @param id - The media id.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns Nothing.
 */
export async function restoreMedia(
  connection: Connection,
  id: string,
  fetchFn: FetchLike = fetch,
): Promise<void> {
  await apiRequest<unknown>(
    connection,
    `/v1/media/${encodeURIComponent(id)}/restore`,
    { method: 'POST' },
    fetchFn,
  );
}
