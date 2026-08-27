// The explorer state: the folder tree, the media of the highlighted folder.

import type { Tree, TreeRow } from 'inkstand';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type Connection,
  type Folder,
  failureMessage,
  listFolderMedia,
  listMedia,
  type Media,
} from '../../engine/engine';
import { useAccess, useFolders, useTree } from './folder-state';
import { BIN_ID, canWrite, isAdmin, UNASSIGNED_ID } from './model';

/** What the explorer reports to the shell. */
export type Report = (message: string, tone: 'error' | 'info') => void;

/** The media marked for a move. */
interface Mark {
  /** The media id. */
  id: string;
  /** The media title, for the messages. */
  title: string;
  /** The folder marked in; undefined outside a real folder. */
  folderId: string | undefined;
}

/** The explorer state and its actions. */
export interface ExplorerState {
  /** The folder tree. */
  tree: Tree;
  /** The folders as the backend returned them. */
  folders: Folder[];
  /** The highlighted tree row. */
  highlight: number;
  /** The highlighted tree row, or undefined before the folders loaded. */
  folder: TreeRow | undefined;
  /** Whether the folders are loading. */
  loadingFolders: boolean;
  /** The media of the highlighted folder that match the query. */
  media: Media[];
  /** The highlighted media row. */
  mediaHighlight: number;
  /** Whether the media are loading. */
  loadingMedia: boolean;
  /** The search query; empty when none. */
  query: string;
  /** The media marked for a move; undefined when none is. */
  mark: Mark | undefined;
  /** Moves the tree highlight. */
  setHighlight: (index: number) => void;
  /** Expands a folder. */
  expand: (id: string) => void;
  /** Collapses a folder. */
  collapse: (id: string) => void;
  /** Moves the media highlight. */
  setMediaHighlight: (index: number) => void;
  /** Sets the search query. */
  setQuery: (query: string) => void;
  /** Marks a media for a move, or clears the mark. */
  setMark: (mark: Mark | undefined) => void;
  /** Reloads the folders and the media. */
  reload: () => void;
  /** Reloads the media, keeping the highlight. */
  reloadMedia: () => void;
}

/**
 * Loads the folders on connect, their grants after them, and the media
 * whenever the highlighted folder or the query changes.
 *
 * @param connection - The live connection.
 * @param report - Reports failures to the shell.
 * @returns The explorer state.
 */
export function useExplorer(
  connection: Connection,
  report: Report,
): ExplorerState {
  const { identity } = connection;
  const fail = useFailure(report, 'Folders failed to load');
  const folders = useFolders(connection, fail);
  const access = useAccess(connection, folders.folders, canWrite(identity));
  const tree = useTree(folders.folders, isAdmin(identity), access);
  const [query, setQuery] = useState('');
  const [mark, setMark] = useState<Mark | undefined>();
  const folder = tree.tree.rows[tree.highlight];
  const media = useMedia(connection, folder?.id, query, report);
  const reload = (): void => {
    folders.reloadFolders();
    media.reloadMedia();
  };
  return {
    ...folders,
    ...tree,
    ...media,
    folder,
    query,
    setQuery,
    mark,
    setMark,
    reload,
  };
}

/**
 * Builds a stable failure reporter with a fixed prefix.
 *
 * @param report - The shell reporter; the latest one is used.
 * @param prefix - The text before the failure message.
 * @returns The reporter.
 */
function useFailure(report: Report, prefix: string): (error: unknown) => void {
  const latest = useRef(report);
  latest.current = report;
  return useCallback(
    (error: unknown) =>
      latest.current(`${prefix}: ${failureMessage(error)}`, 'error'),
    [prefix],
  );
}

/** The media half of the state. */
interface MediaState {
  media: Media[];
  mediaHighlight: number;
  loadingMedia: boolean;
  setMediaHighlight: (index: number) => void;
  reloadMedia: () => void;
}

/**
 * Loads the media of a folder whenever it or the query changes, the query
 * going to the backend. A load that a later change made stale is dropped.
 * The highlight resets on a folder change and is kept, clamped, on a reload.
 *
 * @param connection - The live connection.
 * @param folderId - The highlighted folder id, or undefined before any.
 * @param query - The search query.
 * @param report - Reports failures to the shell.
 * @returns The media state.
 */
function useMedia(
  connection: Connection,
  folderId: string | undefined,
  query: string,
  report: Report,
): MediaState {
  const [loaded, setLoaded] = useState<Media[]>([]);
  const [mediaHighlight, setMediaHighlight] = useState(0);
  const [loadingMedia, setLoading] = useState(false);
  const fail = useFailure(report, 'Media failed to load');
  const { target, reloadMedia } = useTarget(folderId, query);
  useEffect(() => {
    const { folderId: id, query: q } = target;
    if (id === undefined) {
      return;
    }
    const sinks = { apply: setLoaded, fail, setLoading };
    return loadMedia(connection, { folderId: id, query: q }, sinks);
  }, [connection, target, fail]);
  useResetOn(folderId, query, setMediaHighlight);
  const media = loaded;
  const clamped = Math.min(mediaHighlight, Math.max(media.length - 1, 0));
  return {
    media,
    mediaHighlight: clamped,
    loadingMedia,
    setMediaHighlight,
    reloadMedia,
  };
}

/**
 * Resets the media highlight when the folder or the query changes.
 *
 * @param folderId - The highlighted folder id.
 * @param query - The search query.
 * @param setMediaHighlight - Moves the media highlight.
 * @returns Nothing.
 */
function useResetOn(
  folderId: string | undefined,
  query: string,
  setMediaHighlight: (index: number) => void,
): void {
  const scope = `${folderId ?? ''}\u0000${query}`;
  useEffect(() => {
    if (scope !== undefined) {
      setMediaHighlight(0);
    }
  }, [scope, setMediaHighlight]);
}

/**
 * Builds the load target: the folder, the query, and a counter that a
 * reload bumps.
 *
 * @param folderId - The highlighted folder id.
 * @param query - The search query.
 * @returns The target and the reload function.
 */
function useTarget(
  folderId: string | undefined,
  query: string,
): {
  target: { folderId: string | undefined; query: string; generation: number };
  reloadMedia: () => void;
} {
  const [generation, setGeneration] = useState(0);
  const target = useMemo(
    () => ({ folderId, query, generation }),
    [folderId, query, generation],
  );
  const reloadMedia = useCallback(
    () => setGeneration((value) => value + 1),
    [],
  );
  return { target, reloadMedia };
}

/**
 * Picks the listing of a folder: the unassigned media, the bin, or a real
 * folder.
 *
 * @param connection - The live connection.
 * @param folderId - The folder id.
 * @param query - The text query, empty for none.
 * @returns The media.
 */
function listFor(
  connection: Connection,
  folderId: string,
  query: string,
): Promise<Media[]> {
  const page = { limit: 200 };
  if (folderId === UNASSIGNED_ID) {
    return listMedia(connection, page, query, 'unassigned');
  }
  if (folderId === BIN_ID) {
    return listMedia(connection, page, query, 'anywhere', 'deleted');
  }
  return listFolderMedia(connection, folderId, page, query, 'active');
}

/**
 * Starts a media load and returns the function that marks it stale, so a
 * load overtaken by a later change changes nothing.
 *
 * @param connection - The live connection.
 * @param target - The folder id and the query, empty for none.
 * @param sinks - Where the outcome goes.
 * @param sinks.apply - Receives the media.
 * @param sinks.fail - Receives a failure.
 * @param sinks.setLoading - Follows the loading flag.
 * @returns The function that marks the load stale.
 */
function loadMedia(
  connection: Connection,
  target: { folderId: string; query: string },
  sinks: {
    apply: (items: Media[]) => void;
    fail: (error: unknown) => void;
    setLoading: (loading: boolean) => void;
  },
): () => void {
  const guard = { stale: false };
  const live =
    <T>(fn: (value: T) => void) =>
    (value: T) => {
      if (!guard.stale) {
        fn(value);
      }
    };
  sinks.setLoading(true);
  const request = listFor(connection, target.folderId, target.query);
  request.then(live(sinks.apply), live(sinks.fail)).finally(() => {
    if (!guard.stale) {
      sinks.setLoading(false);
    }
  });
  return () => {
    guard.stale = true;
  };
}
