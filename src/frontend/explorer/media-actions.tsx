// The media flows: create and edit in the editor, unassign, delete, restore.

import type { EditorResult } from 'inkstand';
import {
  assignMedia,
  deleteMedia,
  type MediaDocument,
  restoreMedia,
  saveMedia,
  toDocument,
  unassignMedia,
} from '../../engine/engine';
import { DiffConfirm } from '../screens/diff-confirm';
import {
  type ActionContext,
  confirm,
  currentFolder,
  currentMedia,
} from './action-context';
import { mediaTemplate, parseDocument } from './forms';
import { mediaTitle, UNASSIGNED_ID } from './model';

/** The comment above the document in the editor. */
const HEADER =
  '// pbctl: edit the media, save, and quit. Quit without saving to abort.\n';

/**
 * Opens a document in the editor and returns the parsed result.
 *
 * @param context - What the action acts on.
 * @param slug - The temporary file name part.
 * @param document - The document to edit.
 * @returns The edited document, or undefined after a reported abort.
 */
async function editDocument(
  context: ActionContext,
  slug: string,
  document: MediaDocument,
): Promise<{ before: string; document: MediaDocument } | undefined> {
  const before = JSON.stringify(document, null, 2);
  const result = await context.edit({
    prefix: 'pbctl',
    slug: slug.replace(/[^a-z0-9]+/gi, '-'),
    body: before,
    extension: 'jsonc',
    header: HEADER,
  });
  const parsed = outcome(result);
  if ('message' in parsed) {
    context.report(parsed.message, parsed.tone);
    return undefined;
  }
  return { before, document: parsed.document };
}

/**
 * Reads an editor result.
 *
 * @param result - The editor result.
 * @returns The document, or the message to report.
 */
function outcome(
  result: EditorResult,
): { document: MediaDocument } | { message: string; tone: 'error' | 'info' } {
  if (result.error !== undefined) {
    return { message: `The editor failed: ${result.error}`, tone: 'error' };
  }
  if (!result.changed) {
    return { message: 'Nothing changed.', tone: 'info' };
  }
  const parsed = parseDocument(result.text);
  if ('error' in parsed) {
    return {
      message: `${parsed.error} Your text is in ${result.path}.`,
      tone: 'error',
    };
  }
  return parsed;
}

/**
 * Creates a media from the template edited in the editor, assigned to the
 * highlighted folder.
 *
 * @param context - What the action acts on.
 * @returns Nothing.
 */
export async function newMedia(context: ActionContext): Promise<void> {
  const edited = await editDocument(context, 'new-media', mediaTemplate());
  if (edited === undefined) {
    return;
  }
  const media = await saveMedia(context.connection, edited.document);
  const folder = context.state.folder;
  if (folder !== undefined && folder.id !== UNASSIGNED_ID) {
    await assignMedia(context.connection, folder.id, media.id);
  }
  context.state.reloadMedia();
  context.report(`✔ Media "${mediaTitle(media)}" created.`, 'info');
}

/**
 * Edits the highlighted media in the editor, with a diff to confirm.
 *
 * @param context - What the action acts on.
 * @returns Nothing.
 */
export async function editMedia(context: ActionContext): Promise<void> {
  const media = currentMedia(context);
  if (media === undefined) {
    return;
  }
  const edited = await editDocument(context, media.id, toDocument(media));
  if (edited === undefined) {
    return;
  }
  const after = JSON.stringify(edited.document, null, 2);
  const apply = await context.open<boolean>((done, cancel) => (
    <DiffConfirm
      after={after}
      before={edited.before}
      maxRows={context.diffRows}
      onCancel={cancel}
      onConfirm={() => done(true)}
      title={`Save ${mediaTitle(media)}?`}
    />
  ));
  if (apply !== true) {
    context.report('Edit cancelled.', 'info');
    return;
  }
  await saveMedia(context.connection, edited.document);
  context.state.reloadMedia();
  context.report(`✔ Media "${mediaTitle(media)}" saved.`, 'info');
}

/**
 * Removes the highlighted media from the highlighted folder.
 *
 * @param context - What the action acts on.
 * @returns Nothing.
 */
export async function unassign(context: ActionContext): Promise<void> {
  const media = currentMedia(context);
  const folder = currentFolder(context);
  if (media === undefined || folder === undefined) {
    return;
  }
  const question = `Remove "${mediaTitle(media)}" from ${folder.name}? The media is kept.`;
  if (!(await confirm(context, question, 'yes, remove'))) {
    return;
  }
  await unassignMedia(context.connection, folder.id, media.id);
  context.state.reloadMedia();
  context.report(`✔ Removed from ${folder.name}.`, 'info');
}

/**
 * Moves the highlighted media to the bin after confirmation.
 *
 * @param context - What the action acts on.
 * @returns Nothing.
 */
export async function deleteMediaFlow(context: ActionContext): Promise<void> {
  const media = currentMedia(context);
  if (media === undefined) {
    return;
  }
  const question = `Move "${mediaTitle(media)}" to the bin?`;
  if (!(await confirm(context, question, 'yes, delete'))) {
    return;
  }
  await deleteMedia(context.connection, media.id);
  context.state.reloadMedia();
  context.report(`✔ "${mediaTitle(media)}" moved to the bin.`, 'info');
}

/**
 * Restores the highlighted media from the bin.
 *
 * @param context - What the action acts on.
 * @returns Nothing.
 */
export async function restore(context: ActionContext): Promise<void> {
  const media = currentMedia(context);
  if (media === undefined) {
    return;
  }
  await restoreMedia(context.connection, media.id);
  context.state.reloadMedia();
  context.report(`✔ "${mediaTitle(media)}" restored.`, 'info');
}
