// Folder queries.

import { ApiError, apiRequest } from '../connection/client';
import type { Connection } from '../connection/connection';
import type { FetchLike } from '../connection/detect';

/** A folder as the backend returns it. */
export interface Folder {
  /** The folder id. */
  id: string;
  /** The folder name. */
  name: string;
  /** The parent folder id; a root folder when omitted. */
  parentId?: string;
  /** When the folder was created, ISO 8601. */
  createdAt: string;
  /** When the folder was last updated, ISO 8601. */
  updatedAt: string;
  /** The active media in the folder and all of its subfolders. */
  mediaCount: number;
}

/** The rows fetched per page. */
const PAGE = 100;

/**
 * Lists every folder, page by page.
 *
 * @param connection - The live connection.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns The folders, in the backend's order.
 */
export async function listFolders(
  connection: Connection,
  fetchFn: FetchLike = fetch,
): Promise<Folder[]> {
  const folders: Folder[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await apiRequest<Folder[]>(
      connection,
      '/v1/folder',
      { query: { limit: PAGE, offset } },
      fetchFn,
    );
    folders.push(...page);
    if (page.length < PAGE) {
      return folders;
    }
  }
}

/** An access grant on a folder, as the backend returns it. */
interface FolderPermission {
  /** The grant id. */
  id: string;
  /** The folder the grant is attached to, an ancestor when inherited. */
  folderId: string;
  /** Whether the grant lets its subject write the folder. */
  canWrite: boolean;
}

/** How the grants of a folder apply to the user. */
export type FolderAccess = 'open' | 'granted' | 'denied';

/**
 * Reads how a folder is restricted. The backend answers the grants of the
 * folder and of its ancestors, and refuses the request when the user may not
 * write the folder, so the refusal is an answer in itself.
 *
 * @param connection - The live connection.
 * @param id - The folder id.
 * @param fetchFn - The fetch implementation, the global one when omitted.
 * @returns `open` for a folder without grants, `granted` when the grants
 * include the user, `denied` when they exclude them.
 */
export async function folderAccess(
  connection: Connection,
  id: string,
  fetchFn: FetchLike = fetch,
): Promise<FolderAccess> {
  try {
    const grants = await apiRequest<FolderPermission[]>(
      connection,
      `/v1/folder/${encodeURIComponent(id)}/permission`,
      {},
      fetchFn,
    );
    return grants.length === 0 ? 'open' : 'granted';
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return 'denied';
    }
    throw error;
  }
}
