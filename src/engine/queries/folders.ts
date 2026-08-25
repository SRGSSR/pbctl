// Folder queries.

import { apiRequest } from '../connection/client';
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
