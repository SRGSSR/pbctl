// Media queries.

import { apiRequest } from '../connection/client';
import type { Connection } from '../connection/connection';
import type { FetchLike } from '../connection/detect';

/** One playable source of a media. */
export interface MediaSource {
  /** The stream URL. */
  url: string;
  /** The source type, such as `ON-DEMAND` or `LIVE`. */
  type?: string;
  /** The MIME type, such as `application/x-mpegURL`. */
  mimeType?: string;
  /** The DRM systems the source needs. */
  drmConfigs?: { keySystem?: string; securityLevel?: string }[];
}

/** The descriptive metadata of a media. */
export interface MediaMetadata {
  /** The title. */
  title?: string;
  /** The subtitle. */
  subtitle?: string;
  /** The description. */
  description?: string;
  /** The poster image URL. */
  posterUrl?: string;
  /** The season number. */
  seasonNumber?: number;
  /** The episode number. */
  episodeNumber?: number;
}

/** A media as the backend returns it. */
export interface Media {
  /** The media id, such as `urn:rts:video:...`. */
  id: string;
  /** The tags. */
  tags?: string[];
  /** The playable sources; absent when the media has none. */
  sources?: MediaSource[];
  /** The descriptive metadata; absent when the media has none. */
  metadata?: MediaMetadata;
  /** Whether the media is in the bin. */
  deleted: boolean;
  /** When the media was created, ISO 8601. */
  createdAt: string;
  /** When the media was last modified, ISO 8601. */
  lastModified: string;
  /** When the media expires, ISO 8601; absent when it does not expire. */
  expiresAt?: string;
}

/** A page of a media listing. */
export interface MediaPage {
  /** The rows fetched per page. */
  limit?: number;
  /** The index of the first row. */
  offset?: number;
}

/** The rows fetched per page when the page states none. */
const DEFAULT_LIMIT = 50;

/** Which media a listing covers. */
export type MediaScope = 'anywhere' | 'unassigned';

/**
 * Which media a listing shows: the active ones, or the bin. The backend lists
 * both when the parameter is absent, so every listing sends it.
 */
export type MediaVisibility = 'active' | 'deleted';

/**
 * Lists the media of a folder, optionally filtered by a text query.
 *
 * @param connection - The live connection.
 * @param folderId - The folder id.
 * @param page - The page to fetch.
 * @param q - The text query; every media of the folder when omitted.
 * @param visibility - The active media when omitted; `deleted` lists the bin.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns The media of the page.
 */
export function listFolderMedia(
  connection: Connection,
  folderId: string,
  page: MediaPage = {},
  q?: string,
  visibility: MediaVisibility = 'active',
  fetchFn: FetchLike = fetch,
): Promise<Media[]> {
  return apiRequest<Media[]>(
    connection,
    `/v1/folder/${encodeURIComponent(folderId)}/media`,
    { query: { ...queryOf(page), q: textOf(q), visibility } },
    fetchFn,
  );
}

/**
 * Lists media, optionally filtered by a text query and limited to the media
 * assigned to no folder.
 *
 * @param connection - The live connection.
 * @param page - The page to fetch.
 * @param q - The text query; every media when omitted.
 * @param scope - The media covered; every media when omitted.
 * @param visibility - The active media when omitted; `deleted` lists the bin.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns The media of the page.
 */
export function listMedia(
  connection: Connection,
  page: MediaPage = {},
  q?: string,
  scope: MediaScope = 'anywhere',
  visibility: MediaVisibility = 'active',
  fetchFn: FetchLike = fetch,
): Promise<Media[]> {
  const query = {
    ...queryOf(page),
    q: textOf(q),
    scope: scope === 'anywhere' ? undefined : scope,
    visibility,
  };
  return apiRequest<Media[]>(connection, '/v1/media', { query }, fetchFn);
}

/**
 * Fetches one media.
 *
 * @param connection - The live connection.
 * @param id - The media id.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns The media.
 */
export function getMedia(
  connection: Connection,
  id: string,
  fetchFn: FetchLike = fetch,
): Promise<Media> {
  return apiRequest<Media>(
    connection,
    `/v1/media/${encodeURIComponent(id)}`,
    {},
    fetchFn,
  );
}

/**
 * Turns a text query into its parameter.
 *
 * @param q - The text query.
 * @returns The trimmed query, or undefined when blank.
 */
function textOf(q: string | undefined): string | undefined {
  const trimmed = q?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

/**
 * Turns a page into query parameters.
 *
 * @param page - The page.
 * @returns The `limit` and `offset` parameters.
 */
function queryOf(page: MediaPage): Record<string, number> {
  return { limit: page.limit ?? DEFAULT_LIMIT, offset: page.offset ?? 0 };
}
