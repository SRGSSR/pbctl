// The explorer screen: the folder tree, the media list, the inspector, the keys.

import { Box, type Key, Text, useInput } from 'ink';
import {
  type EditorResult,
  type EditTextRequest,
  type KeyAction,
  KeyBar,
  type Open,
  Pane,
  StatusBar,
  type StatusSegment,
  TreeView,
  treeAction,
} from 'inkstand';
import type { ReactElement, ReactNode } from 'react';
import { useRef, useState } from 'react';
import packageJson from '../../../package.json';
import type { Connection, Media } from '../../engine/engine';
import {
  type ActionContext,
  type Pane as ActionPane,
  actionsOf,
  runAction,
} from './actions';
import { MediaList } from './media-list';
import { folderDetail, inspectorLines, mediaDetail, mediaRow } from './model';
import { type ExplorerState, type Report, useExplorer } from './use-explorer';

/** The explorer contract. */
export interface ExplorerProps {
  /** The live connection. */
  connection: Connection;
  /** The terminal rows. */
  rows: number;
  /** The terminal columns. */
  columns: number;
  /** The last message from the shell, shown in the status bar. */
  notice?: ReactNode;
  /** A screen that takes the place of the media pane. */
  screen?: ReactNode;
  /** Opens a screen. */
  open: Open;
  /** Opens a text in the user's editor. */
  edit: (request: EditTextRequest) => Promise<EditorResult>;
  /** Reports a message to the shell. */
  report: Report;
  /** Quits the application. */
  onQuit: () => void;
}

/** The parts that read the keyboard. */
type Part = ActionPane | 'keys';

/**
 * The rows around a list: the title, the inspector, the keys, and the status
 * bar (7), the pane's title and borders (3), and the two "more" lines (2).
 */
const CHROME_ROWS = 12;

/** The share of the width the folder pane takes. */
const TREE_SHARE = 0.35;

/** The folder icons: closed, open, and a folder without subfolders. */
const FOLDER_GLYPHS = { collapsed: '📁 ', expanded: '📂 ', leaf: '📁 ' };

/** What the panes and the key bar need. */
interface Frame {
  /** The explorer state. */
  state: ExplorerState;
  /** The focused part; undefined while a screen holds the keyboard. */
  focused?: Part;
  /** Moves the focus. */
  focus: (part: Part) => void;
  /** The rows a list may show. */
  listRows: number;
  /** The width of a media row. */
  listWidth: number;
  /** The key bar actions. */
  actions: KeyAction[];
  /** Runs an action. */
  run: (action: KeyAction) => void;
}

/**
 * Renders the explorer.
 *
 * @param props - The component props.
 * @returns The explorer element.
 */
export function Explorer(props: ExplorerProps): ReactElement {
  const frame = useFrame(props);
  return (
    <Box flexDirection="column" height={props.rows} width={props.columns}>
      <Title connection={props.connection} />
      <Box flexGrow={1}>
        <FoldersPane frame={frame} />
        {props.screen ?? <MediaPane frame={frame} />}
      </Box>
      <Bottom frame={frame} />
      <StatusBar
        right={<Box height={1}>{props.notice}</Box>}
        segments={segments(props.connection)}
      />
    </Box>
  );
}

/**
 * Builds the status bar segments: the profile, who is logged in, the backend,
 * and a warning when the profile skips certificate verification.
 *
 * @param connection - The live connection.
 * @returns The segments.
 */
function segments(connection: Connection): StatusSegment[] {
  const bar: StatusSegment[] = [
    { text: connection.profile.name, color: 'cyan' },
    { text: connection.identity.name, color: 'green' },
    { text: connection.profile.backend, dim: true },
  ];
  if (!connection.profile.tlsVerify) {
    bar.push({ text: 'TLS off', color: 'yellow' });
  }
  return bar;
}

/**
 * Owns the focus, the state, and the single keys.
 *
 * @param props - The explorer props.
 * @returns The frame.
 */
function useFrame(props: ExplorerProps): Frame {
  const active = props.screen === undefined;
  const { focused, pane, focus } = useFocus(active);
  const state = useExplorer(props.connection, props.report);
  const actions = actionsOf(pane, state);
  const context: ActionContext = {
    ...props,
    state,
    pane,
    focus,
    diffRows: props.rows - CHROME_ROWS - 3,
  };
  const run = (action: KeyAction): void => runAction(action, context);
  useKeys({ actions, run, state, focused, focus }, active);
  return {
    state,
    focused: active ? focused : undefined,
    focus,
    listRows: props.rows - CHROME_ROWS,
    listWidth: Math.max(
      props.columns - Math.floor(props.columns * TREE_SHARE) - 7,
      20,
    ),
    actions,
    run,
  };
}

/**
 * Holds which part reads the keyboard. Tab moves between the key bar and
 * the pane focused before it.
 *
 * @param active - Whether the keys apply.
 * @returns The focused part, the pane the actions belong to, and the setter.
 */
function useFocus(active: boolean): {
  focused: Part;
  pane: ActionPane;
  focus: (part: Part) => void;
} {
  const [focused, setFocused] = useState<Part>('tree');
  const pane = useRef<ActionPane>('tree');
  if (focused !== 'keys') {
    pane.current = focused;
  }
  useInput(
    (_input, key) => {
      if (key.tab) {
        setFocused(focused === 'keys' ? pane.current : 'keys');
      }
    },
    { isActive: active },
  );
  return { focused, pane: pane.current, focus: setFocused };
}

/** What the single keys act on. */
interface Keys {
  /** The actions of the moment. */
  actions: KeyAction[];
  /** Runs an action. */
  run: (action: KeyAction) => void;
  /** The explorer state. */
  state: ExplorerState;
  /** The focused part. */
  focused: Part;
  /** Moves the focus. */
  focus: (part: Part) => void;
}

/**
 * Reads the single keys: right on the tree moves to the list once the
 * folder has nothing to expand, left on the list moves to the tree, and the
 * action keys run their action.
 *
 * @param keys - What the keys act on.
 * @param active - Whether the keys apply.
 * @returns Nothing.
 */
function useKeys(keys: Keys, active: boolean): void {
  useInput(
    (input, key) => {
      if (movesFocus(keys, key)) {
        keys.focus(keys.focused === 'tree' ? 'list' : 'tree');
        return;
      }
      const action = keys.actions.find((candidate) => candidate.key === input);
      if (action !== undefined && action.disabled !== true) {
        keys.run(action);
      }
    },
    { isActive: active },
  );
}

/**
 * Reports whether an arrow key switches the pane.
 *
 * @param keys - What the keys act on.
 * @param key - The special-key flags.
 * @returns Whether the focus moves to the other pane.
 */
function movesFocus(keys: Keys, key: Key): boolean {
  if (keys.focused === 'list') {
    return key.leftArrow;
  }
  if (keys.focused === 'tree' && key.rightArrow) {
    const { tree, highlight } = keys.state;
    return treeAction(tree.rows, highlight, key).kind === 'none';
  }
  return false;
}

/**
 * Renders the title row.
 *
 * @param props - The component props.
 * @param props.connection - The live connection.
 * @returns The title element.
 */
function Title(props: { connection: Connection }): ReactElement {
  const roles = props.connection.identity.roles.join(', ');
  return (
    <Box justifyContent="space-between" paddingX={1}>
      <Text>
        <Text bold color="cyan">
          pbctl
        </Text>
        <Text dimColor> v{packageJson.version}</Text>
      </Text>
      <Text dimColor>{roles === '' ? 'no roles' : roles}</Text>
    </Box>
  );
}

/**
 * Renders the folder tree pane.
 *
 * @param props - The component props.
 * @param props.frame - The frame.
 * @returns The pane element.
 */
function FoldersPane(props: { frame: Frame }): ReactElement {
  const { state, focused, listRows } = props.frame;
  return (
    <Pane
      detail={folderDetail(state)}
      focusColor="cyan"
      focused={focused === 'tree'}
      title="Folders"
      width={`${TREE_SHARE * 100}%`}
    >
      <TreeView
        glyphs={FOLDER_GLYPHS}
        highlight={state.highlight}
        highlightColor={focused === 'tree' ? 'cyan' : 'white'}
        isActive={focused === 'tree'}
        maxRows={listRows}
        onCollapse={state.collapse}
        onExpand={state.expand}
        onHighlight={state.setHighlight}
        rows={state.tree.rows}
      />
    </Pane>
  );
}

/**
 * Renders the media list pane of the highlighted folder.
 *
 * @param props - The component props.
 * @param props.frame - The frame.
 * @returns The pane element.
 */
function MediaPane(props: { frame: Frame }): ReactElement {
  const { state, focused, listRows, listWidth, run, actions } = props.frame;
  const query = state.query === '' ? '' : ` · "${state.query}"`;
  const edit = actions.find((action) => action.key === '↵');
  return (
    <Pane
      detail={mediaDetail(state)}
      focusColor="cyan"
      focused={focused === 'list'}
      grow
      title={`${state.folder?.label ?? 'Media'}${query}`}
    >
      <MediaList
        empty={state.loadingMedia ? 'Loading…' : 'No media.'}
        highlight={state.mediaHighlight}
        highlightColor={focused === 'list' ? 'cyan' : 'white'}
        isActive={focused === 'list'}
        maxRows={listRows}
        onHighlight={state.setMediaHighlight}
        onOpen={() => edit !== undefined && run(edit)}
        rows={state.media.map((item) => ({
          id: item.id,
          label: mediaRow(item, listWidth, state.mark?.id === item.id),
        }))}
      />
    </Pane>
  );
}

/**
 * Renders the inspector and the key bar.
 *
 * @param props - The component props.
 * @param props.frame - The frame.
 * @returns The bottom element.
 */
function Bottom(props: { frame: Frame }): ReactElement {
  const { state, focused, focus, actions, run } = props.frame;
  return (
    <>
      <Inspector media={state.media[state.mediaHighlight]} />
      <KeyBar
        actions={actions}
        focused={focused === 'keys'}
        highlightColor="cyan"
        onBlur={() => focus('tree')}
        onPick={run}
      />
    </>
  );
}

/**
 * Renders the inspector: two lines about the highlighted media.
 *
 * @param props - The component props.
 * @param props.media - The highlighted media, if any.
 * @returns The inspector element.
 */
function Inspector(props: { media: Media | undefined }): ReactElement {
  const { media } = props;
  const lines =
    media === undefined ? ['Select a media.'] : inspectorLines(media);
  return (
    <Box
      borderDimColor
      borderStyle="round"
      flexDirection="column"
      flexShrink={0}
      height={4}
      paddingX={1}
    >
      {lines.map((line, index) => (
        <Text
          dimColor={media === undefined || index > 0}
          key={line}
          wrap="truncate"
        >
          {line}
        </Text>
      ))}
    </Box>
  );
}
