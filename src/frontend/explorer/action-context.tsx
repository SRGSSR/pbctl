// What an explorer action acts on, and the questions every flow asks.

import type { EditorResult, EditTextRequest, Open } from 'inkstand';
import type { Connection, Folder, Media } from '../../engine/engine';
import { ConfirmScreen } from '../screens/dialogs';
import { FormScreen } from '../screens/form';
import type { ExplorerState, Report } from './use-explorer';

/** The pane an action list belongs to. */
export type Pane = 'tree' | 'list';

/** What an action can act on. */
export interface ActionContext {
  /** The live connection. */
  connection: Connection;
  /** The explorer state. */
  state: ExplorerState;
  /** The pane the actions belong to. */
  pane: Pane;
  /** Moves the focus to a pane. */
  focus: (pane: Pane) => void;
  /** Opens a screen in place of the media pane. */
  open: Open;
  /** Opens a text in the user's editor. */
  edit: (request: EditTextRequest) => Promise<EditorResult>;
  /** Reports a message to the shell. */
  report: Report;
  /** The diff lines a confirmation may show. */
  diffRows: number;
  /** Quits the application. */
  onQuit: () => void;
}

/**
 * Returns the highlighted media, reporting when there is none.
 *
 * @param context - What the action acts on.
 * @returns The media, or undefined.
 */
export function currentMedia(context: ActionContext): Media | undefined {
  const media = context.state.media[context.state.mediaHighlight];
  if (media === undefined) {
    context.report('No media highlighted.', 'info');
  }
  return media;
}

/**
 * Returns the highlighted real folder, reporting when there is none.
 *
 * @param context - What the action acts on.
 * @returns The folder, or undefined for the virtual root.
 */
export function currentFolder(context: ActionContext): Folder | undefined {
  const id = context.state.folder?.id;
  const folder = context.state.folders.find((candidate) => candidate.id === id);
  if (folder === undefined) {
    context.report('Pick a folder first.', 'info');
  }
  return folder;
}

/**
 * Asks one text and returns it.
 *
 * @param context - What the action acts on.
 * @param title - The form title.
 * @param label - The question label.
 * @param fallback - The value an empty answer takes.
 * @returns The answer, or undefined when cancelled.
 */
export async function askText(
  context: ActionContext,
  title: string,
  label: string,
  fallback?: string,
): Promise<string | undefined> {
  const answers = await context.open<Record<string, string>>((done, cancel) => (
    <FormScreen
      fields={[{ key: 'value', label, fallback, optional: true }]}
      onCancel={cancel}
      onSubmit={done}
      title={title}
    />
  ));
  return answers?.value;
}

/**
 * Asks a yes/no question.
 *
 * @param context - What the action acts on.
 * @param question - The question.
 * @param yes - The label of the yes item.
 * @returns Whether the user picked yes.
 */
export async function confirm(
  context: ActionContext,
  question: string,
  yes: string,
): Promise<boolean> {
  const answer = await context.open<boolean>((done, cancel) => (
    <ConfirmScreen
      onCancel={cancel}
      onConfirm={() => done(true)}
      question={question}
      yes={yes}
    />
  ));
  return answer === true;
}
