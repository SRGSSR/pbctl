// The explorer actions: the key bar entries and the folder flows.

import type { KeyAction } from 'inkstand';
import {
  createFolder,
  deleteFolder,
  failureMessage,
  renameFolder,
} from '../../engine/engine';
import {
  type ActionContext,
  askText,
  confirm,
  currentFolder,
  type Pane,
} from './action-context';
import {
  deleteMediaFlow,
  editMedia,
  newMedia,
  restore,
  unassign,
} from './media-actions';
import { BIN_ID, UNASSIGNED_ID, VIRTUAL_IDS } from './model';
import type { ExplorerState } from './use-explorer';

export type { ActionContext, Pane } from './action-context';

/**
 * Lists the actions of a pane.
 *
 * @param pane - The pane.
 * @param state - The explorer state.
 * @returns The actions, the inapplicable ones disabled.
 */
export function actionsOf(pane: Pane, state: ExplorerState): KeyAction[] {
  const common: KeyAction[] = [
    { key: '/', label: 'search' },
    { key: 'c', label: 'clear', disabled: state.query === '' },
    { key: 'r', label: 'reload' },
    { key: 'p', label: 'profiles' },
    { key: 'q', label: 'quit' },
  ];
  const own = pane === 'tree' ? treeActions(state) : listActions(state);
  return [...own, ...common];
}

/**
 * Lists the actions of the tree.
 *
 * @param state - The explorer state.
 * @returns The actions.
 */
function treeActions(state: ExplorerState): KeyAction[] {
  const real =
    state.folder !== undefined && !VIRTUAL_IDS.includes(state.folder.id);
  return [
    { key: 'n', label: 'new folder' },
    { key: 'm', label: 'new media' },
    { key: 'e', label: 'rename', disabled: !real },
    { key: 'd', label: 'delete', disabled: !real },
  ];
}

/**
 * Lists the actions of the media list.
 *
 * @param state - The explorer state.
 * @returns The actions.
 */
function listActions(state: ExplorerState): KeyAction[] {
  const media = state.media[state.mediaHighlight] !== undefined;
  const folder = state.folder?.id;
  if (folder === BIN_ID) {
    return [{ key: 'u', label: 'restore', disabled: !media }];
  }
  const real = folder !== undefined && !VIRTUAL_IDS.includes(folder);
  return [
    { key: '↵', label: 'edit', disabled: !media },
    { key: 'm', label: 'new media' },
    { key: 'x', label: 'unassign', disabled: !media || !real },
    { key: 'd', label: 'delete', disabled: !media },
  ];
}

/**
 * Runs an action. Failures are reported, never thrown.
 *
 * @param action - The action.
 * @param context - What the action acts on.
 * @returns Nothing.
 */
export function runAction(action: KeyAction, context: ActionContext): void {
  const flow = flowOf(action.key, context);
  if (flow !== undefined) {
    flow().catch((error: unknown) =>
      context.report(failureMessage(error), 'error'),
    );
  }
}

/**
 * Picks the flow of a key.
 *
 * @param key - The action key.
 * @param context - What the action acts on.
 * @returns The flow, or undefined for a key without one.
 */
function flowOf(
  key: string,
  context: ActionContext,
): (() => Promise<void>) | undefined {
  const tree = context.pane === 'tree';
  const flows: Record<string, () => Promise<void>> = {
    '↵': async () => (tree ? undefined : editMedia(context)),
    n: () => newFolder(context),
    m: () => newMedia(context),
    e: async () => (tree ? renameFolderFlow(context) : undefined),
    x: () => unassign(context),
    u: () => restore(context),
    d: () => (tree ? deleteFolderFlow(context) : deleteMediaFlow(context)),
    '/': () => search(context),
    c: async () => context.state.setQuery(''),
    r: async () => reload(context),
    p: async () => context.onProfiles(),
    q: async () => context.onQuit(),
  };
  return flows[key];
}

/**
 * Reloads the folders and the media.
 *
 * @param context - What the action acts on.
 * @returns Nothing.
 */
function reload(context: ActionContext): void {
  context.state.reload();
  context.report('Reloaded.', 'info');
}

/**
 * Creates a folder under the highlighted one.
 *
 * @param context - What the action acts on.
 * @returns Nothing.
 */
async function newFolder(context: ActionContext): Promise<void> {
  const parent = context.state.folder;
  const under =
    parent === undefined || parent.id === UNASSIGNED_ID ? undefined : parent;
  const title =
    under === undefined ? 'New root folder' : `New folder in ${under.label}`;
  const name = await askText(context, title, 'Name');
  if (name === undefined || name === '') {
    return;
  }
  const folder = await createFolder(context.connection, name, under?.id);
  if (under !== undefined) {
    context.state.expand(under.id);
  }
  context.state.reload();
  context.report(`✔ Folder "${folder.name}" created.`, 'info');
}

/**
 * Renames the highlighted folder.
 *
 * @param context - What the action acts on.
 * @returns Nothing.
 */
async function renameFolderFlow(context: ActionContext): Promise<void> {
  const folder = currentFolder(context);
  if (folder === undefined) {
    return;
  }
  const name = await askText(
    context,
    `Rename ${folder.name}`,
    'Name',
    folder.name,
  );
  if (name === undefined || name === '' || name === folder.name) {
    return;
  }
  await renameFolder(context.connection, folder, name);
  context.state.reload();
  context.report(`✔ Folder renamed to "${name}".`, 'info');
}

/**
 * Deletes the highlighted folder after confirmation.
 *
 * @param context - What the action acts on.
 * @returns Nothing.
 */
async function deleteFolderFlow(context: ActionContext): Promise<void> {
  const folder = currentFolder(context);
  if (folder === undefined) {
    return;
  }
  const question = `Delete folder "${folder.name}"?`;
  if (!(await confirm(context, question, 'yes, delete'))) {
    return;
  }
  await deleteFolder(context.connection, folder.id);
  context.state.setHighlight(0);
  context.state.reload();
  context.report(`✔ Folder "${folder.name}" deleted.`, 'info');
}

/**
 * Names the search form after the folder.
 *
 * @param folderId - The highlighted folder id.
 * @returns The form title.
 */
function searchTitle(folderId: string | undefined): string {
  if (folderId === UNASSIGNED_ID) {
    return 'Search the unassigned media';
  }
  return folderId === BIN_ID ? 'Search the bin' : 'Search this folder';
}

/**
 * Sets the search query.
 *
 * @param context - What the action acts on.
 * @returns Nothing.
 */
async function search(context: ActionContext): Promise<void> {
  const text = await askText(
    context,
    searchTitle(context.state.folder?.id),
    'Text',
    context.state.query,
  );
  if (text !== undefined) {
    context.state.setQuery(text);
  }
}
