// Folder commands: create, rename, delete, assign and unassign media.

import { apiRequest } from '../connection/client';
import type { Connection } from '../connection/connection';
import type { FetchLike } from '../connection/detect';
import type { Folder } from '../queries/folders';

/**
 * Creates a folder.
 *
 * @param connection - The live connection.
 * @param name - The folder name.
 * @param parentId - The parent folder id; a root folder when omitted.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns The created folder.
 */
export function createFolder(
  connection: Connection,
  name: string,
  parentId?: string,
  fetchFn: FetchLike = fetch,
): Promise<Folder> {
  return apiRequest<Folder>(
    connection,
    '/v1/folder',
    { method: 'POST', body: { name, parentId } },
    fetchFn,
  );
}

/**
 * Renames a folder. The parent is sent again, as the backend replaces both.
 *
 * @param connection - The live connection.
 * @param folder - The folder to rename.
 * @param name - The new name.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns The updated folder.
 */
export function renameFolder(
  connection: Connection,
  folder: Folder,
  name: string,
  fetchFn: FetchLike = fetch,
): Promise<Folder> {
  return apiRequest<Folder>(
    connection,
    `/v1/folder/${encodeURIComponent(folder.id)}`,
    { method: 'PATCH', body: { name, parentId: folder.parentId } },
    fetchFn,
  );
}

/**
 * Deletes a folder.
 *
 * @param connection - The live connection.
 * @param id - The folder id.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns Nothing.
 */
export async function deleteFolder(
  connection: Connection,
  id: string,
  fetchFn: FetchLike = fetch,
): Promise<void> {
  await apiRequest<undefined>(
    connection,
    `/v1/folder/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    fetchFn,
  );
}

/**
 * Assigns a media to a folder.
 *
 * @param connection - The live connection.
 * @param folderId - The folder id.
 * @param mediaId - The media id.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns Nothing.
 */
export async function assignMedia(
  connection: Connection,
  folderId: string,
  mediaId: string,
  fetchFn: FetchLike = fetch,
): Promise<void> {
  await apiRequest<unknown>(
    connection,
    `/v1/folder/${encodeURIComponent(folderId)}/media`,
    { method: 'POST', body: { mediaId } },
    fetchFn,
  );
}

/**
 * Removes a media from a folder. The media itself is kept.
 *
 * @param connection - The live connection.
 * @param folderId - The folder id.
 * @param mediaId - The media id.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns Nothing.
 */
export async function unassignMedia(
  connection: Connection,
  folderId: string,
  mediaId: string,
  fetchFn: FetchLike = fetch,
): Promise<void> {
  await apiRequest<undefined>(
    connection,
    `/v1/folder/${encodeURIComponent(folderId)}/media/${encodeURIComponent(mediaId)}`,
    { method: 'DELETE' },
    fetchFn,
  );
}
