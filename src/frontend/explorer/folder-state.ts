// The folders of the explorer: the listing, the grants, and the tree.

import { Tree } from 'inkstand';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type Connection,
  type Folder,
  type FolderAccess,
  folderAccess,
  listFolders,
} from '../../engine/engine';
import { mapPool } from '../../utils/pool';
import { folderNodes, UNASSIGNED_ID } from './model';

/** The grant requests in flight at once. */
const ACCESS_REQUESTS = 6;

/** The folder listing. */
export interface FolderList {
  /** The folders as the backend returned them. */
  folders: Folder[];
  /** Whether the folders are loading. */
  loadingFolders: boolean;
  /** Reloads the folders. */
  reloadFolders: () => void;
}

/**
 * Loads the folders on connect and on demand.
 *
 * @param connection - The live connection.
 * @param fail - Receives a failure.
 * @returns The folder listing.
 */
export function useFolders(
  connection: Connection,
  fail: (error: unknown) => void,
): FolderList {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loadingFolders, setLoading] = useState(true);
  const reloadFolders = useCallback(() => {
    setLoading(true);
    listFolders(connection)
      .then(setFolders, fail)
      .finally(() => setLoading(false));
  }, [connection, fail]);
  useEffect(reloadFolders, [reloadFolders]);
  return { folders, loadingFolders, reloadFolders };
}

/**
 * Reads how the grants restrict each folder, one request per folder, again
 * after every folder reload. The backend refuses the grants to a user without
 * a write role, so nothing is asked and no folder is marked. A folder whose
 * request fails counts as unrestricted, since the tree is not the place to
 * report it.
 *
 * @param connection - The live connection.
 * @param folders - The folders from the backend.
 * @param writable - Whether the user holds a role that writes.
 * @returns The access of each folder, by folder id.
 */
export function useAccess(
  connection: Connection,
  folders: Folder[],
  writable: boolean,
): Record<string, FolderAccess> {
  const [access, setAccess] = useState<Record<string, FolderAccess>>({});
  useEffect(() => {
    const ids = writable ? folders.map((folder) => folder.id) : [];
    if (ids.length === 0) {
      setAccess({});
      return;
    }
    const guard = { stale: false };
    void probe(connection, ids).then((found) => {
      if (!guard.stale) {
        setAccess(found);
      }
    });
    return () => {
      guard.stale = true;
    };
  }, [connection, folders, writable]);
  return access;
}

/**
 * Asks the backend for the access of every folder, a few requests at a time.
 *
 * @param connection - The live connection.
 * @param ids - The folder ids.
 * @returns The access of each folder, by folder id.
 */
async function probe(
  connection: Connection,
  ids: string[],
): Promise<Record<string, FolderAccess>> {
  const entries = await mapPool(ids, ACCESS_REQUESTS, (id) =>
    folderAccess(connection, id).then(
      (access): [string, FolderAccess] => [id, access],
      (): [string, FolderAccess] => [id, 'open'],
    ),
  );
  return Object.fromEntries(entries);
}

/** The tree and its highlight. */
export interface TreeState {
  /** The folder tree. */
  tree: Tree;
  /** The highlighted tree row. */
  highlight: number;
  /** Moves the tree highlight. */
  setHighlight: (index: number) => void;
  /** Expands a folder. */
  expand: (id: string) => void;
  /** Collapses a folder. */
  collapse: (id: string) => void;
}

/**
 * Builds the tree from the folders and their grants, and keeps which nodes
 * are expanded across a reload.
 *
 * @param folders - The folders from the backend.
 * @param admin - Whether the tree shows the bin.
 * @param access - The access of each folder, by folder id.
 * @returns The tree state.
 */
export function useTree(
  folders: Folder[],
  admin: boolean,
  access: Record<string, FolderAccess>,
): TreeState {
  const [folds, setFolds] = useState(() => Tree.create([]));
  const tree = useMemo(
    () => folds.withNodes(folderNodes(folders, admin, access)),
    [folds, folders, admin, access],
  );
  const { highlight, setHighlight } = useHighlight(tree);
  return {
    tree,
    highlight,
    setHighlight,
    expand: (id) => setFolds(tree.expand(id)),
    collapse: (id) => setFolds(tree.collapse(id)),
  };
}

/**
 * Holds the tree highlight by folder id, so a reload that reorders or
 * removes rows keeps it on the same folder, or falls back to the root.
 *
 * @param tree - The folder tree.
 * @returns The highlighted row index and its setter.
 */
function useHighlight(tree: Tree): {
  highlight: number;
  setHighlight: (index: number) => void;
} {
  const [highlightId, setHighlightId] = useState(UNASSIGNED_ID);
  const highlight = Math.max(
    tree.rows.findIndex((row) => row.id === highlightId),
    0,
  );
  const setHighlight = (index: number): void =>
    setHighlightId(tree.rows[index]?.id ?? UNASSIGNED_ID);
  return { highlight, setHighlight };
}
