// The shell: the terminal size, the login frame, then the explorer.

import {
  Box,
  type SuspendTerminal,
  Text,
  useApp,
  useInput,
  useWindowSize,
} from 'ink';
import {
  type EditorResult,
  type EditTextRequest,
  editText,
  type Open,
  StatusBar,
  useScreenSlot,
} from 'inkstand';
import type { ReactElement, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import packageJson from '../../../package.json';
import {
  type Connection,
  detectIdentityProvider,
  failureMessage,
  type Profile,
  ProfileStore,
} from '../../engine/engine';
import { Header } from '../components/header';
import { Explorer } from '../explorer/explorer';
import { ProfilesScreen } from '../screens/profiles';
import type { ShellContext } from './context';
import { login } from './login';
import { pushLine } from './output';

/** The messages kept for the login frame. */
const NOTICE_COUNT = 8;

/** One pushed message. */
interface Notice {
  /** The message id, for the list key. */
  id: number;
  /** The message. */
  node: ReactNode;
}

/** What the shell renders from. */
interface ShellState {
  /** The terminal rows. */
  rows: number;
  /** The terminal columns. */
  columns: number;
  /** The active screen, if any. */
  screen?: ReactNode;
  /** Opens a screen. */
  open: Open;
  /** Opens a text in the user's editor. */
  edit: (request: EditTextRequest) => Promise<EditorResult>;
  /** The live connection, when logged in. */
  connection?: Connection;
  /** The pushed messages. */
  notices: Notice[];
  /** Opens the profile screen. */
  profiles: () => void;
  /** Reports a message from the explorer. */
  report: (message: string, tone: 'error' | 'info') => void;
  /** Quits the application. */
  exit: () => void;
}

/**
 * Renders the shell.
 *
 * @returns The root element of the frontend.
 */
export function Shell(): ReactElement {
  const shell = useShell();
  if (shell.connection === undefined) {
    return <LoginFrame shell={shell} />;
  }
  return (
    <Explorer
      columns={shell.columns}
      connection={shell.connection}
      edit={shell.edit}
      notice={shell.notices[shell.notices.length - 1]?.node}
      onProfiles={shell.profiles}
      open={shell.open}
      onQuit={shell.exit}
      report={shell.report}
      rows={shell.rows}
      screen={shell.screen}
    />
  );
}

/**
 * Owns the shell: the screen, the session, the messages, and the flows.
 *
 * @returns The shell state.
 */
function useShell(): ShellState {
  const base = useBase();
  const flows = useFlows(base);
  const edit = useEditor(base.suspend);
  return { ...base, ...flows, edit };
}

/** The shell primitives: the screen, the session, the messages. */
interface Base {
  /** The terminal rows. */
  rows: number;
  /** The terminal columns. */
  columns: number;
  /** Ink's `suspendTerminal`: it leaves the alternate screen for a handover. */
  suspend: SuspendTerminal;
  /** The active screen, if any. */
  screen?: ReactNode;
  /** Opens a screen. */
  open: Open;
  /** Quits the application. */
  exit: () => void;
  /** The live connection, when logged in. */
  connection?: Connection;
  /** Replaces the live connection. */
  setConnection: (connection: Connection | undefined) => void;
  /** The pushed messages. */
  notices: Notice[];
  /** Appends a message. */
  push: (node: ReactNode) => void;
}

/**
 * Owns the shell primitives.
 *
 * @returns The primitives.
 */
function useBase(): Base {
  const { exit, suspendTerminal } = useApp();
  const { rows, columns } = useWindowSize();
  const { screen, open } = useScreenSlot();
  const [connection, setConnection] = useState<Connection | undefined>();
  const { notices, push } = useNotices();
  return {
    rows,
    columns,
    suspend: suspendTerminal,
    screen,
    open,
    exit,
    connection,
    setConnection,
    notices,
    push,
  };
}

/**
 * Runs the flows over the primitives: the profile screen, the login frame,
 * and the reporter.
 *
 * @param base - The primitives.
 * @returns The profile screen opener and the reporter.
 */
function useFlows(base: Base): Pick<ShellState, 'profiles' | 'report'> {
  const context: ShellContext = {
    push: base.push,
    open: base.open,
    exit: base.exit,
    session: { connection: base.connection, setConnection: base.setConnection },
  };
  const profiles = useProfiles(context);
  const idle = base.connection === undefined && base.screen === undefined;
  useLoginFrame(context, profiles, idle);
  const report = (message: string, tone: 'error' | 'info'): void =>
    pushLine(context, message, tone === 'error' ? 'red' : 'dim');
  return { profiles, report };
}

/**
 * Builds the editor hand-off: leaves the screen for the editor, then repaints.
 *
 * @param suspend - Ink's `suspendTerminal`.
 * @returns The edit function.
 */
function useEditor(
  suspend: SuspendTerminal,
): (request: EditTextRequest) => Promise<EditorResult> {
  const [, setRepaint] = useState(0);
  return useCallback(
    (request: EditTextRequest) =>
      editText(request, {
        suspend,
        redraw: () => setRepaint((value) => value + 1),
      }),
    [suspend],
  );
}

/**
 * Owns the pushed messages, keeping the last few.
 *
 * @returns The messages and the push function.
 */
function useNotices(): {
  notices: Notice[];
  push: (node: ReactNode) => void;
} {
  const [notices, setNotices] = useState<Notice[]>([]);
  const counter = useRef(0);
  const push = useCallback((node: ReactNode) => {
    counter.current += 1;
    const notice = { id: counter.current, node };
    setNotices((current) => [...current.slice(1 - NOTICE_COUNT), notice]);
  }, []);
  return { notices, push };
}

/**
 * Builds the function that opens the profile screen and logs in to the
 * picked profile.
 *
 * @param context - What the flow acts on; the latest one is used.
 * @returns The function.
 */
function useProfiles(context: ShellContext): () => void {
  const latest = useRef(context);
  latest.current = context;
  return useCallback(() => {
    void latest.current
      .open<Profile>((done, cancel) => (
        <ProfilesScreen
          detect={detectIdentityProvider}
          onCancel={cancel}
          onLogin={done}
        />
      ))
      .then((profile) => {
        if (profile !== undefined) {
          return login(profile, latest.current);
        }
      })
      .catch((error: unknown) => fail(latest.current, error));
  }, []);
}

/**
 * Runs the login frame: logs in to the default profile once at startup, or
 * opens the profile screen; then reads its keys, `p` for the profile screen
 * and `q` to quit. Ink quits on ctrl+c.
 *
 * @param context - What the flows act on; the latest one is used.
 * @param profiles - Opens the profile screen.
 * @param active - Whether the keys apply.
 * @returns Nothing.
 */
function useLoginFrame(
  context: ShellContext,
  profiles: () => void,
  active: boolean,
): void {
  const latest = useRef({ context, profiles });
  latest.current = { context, profiles };
  useEffect(() => {
    const profile = new ProfileStore().defaultProfile();
    if (profile === undefined) {
      latest.current.profiles();
      return;
    }
    login(profile, latest.current.context).catch((error: unknown) =>
      fail(latest.current.context, error),
    );
  }, []);
  useInput(
    (input) => {
      if (input === 'p') {
        latest.current.profiles();
      } else if (input === 'q') {
        latest.current.context.exit();
      }
    },
    { isActive: active },
  );
}

/**
 * Reports a failure of a login flow.
 *
 * @param context - Where the message goes.
 * @param error - The thrown value.
 * @returns Nothing.
 */
function fail(context: ShellContext, error: unknown): void {
  pushLine(context, `✖ Login failed: ${failureMessage(error)}`, 'red');
}

/**
 * Renders the frame shown until a login completes: the logo, the messages,
 * and the active screen.
 *
 * @param props - The component props.
 * @param props.shell - The shell state.
 * @returns The frame element.
 */
function LoginFrame(props: { shell: ShellState }): ReactElement {
  const { shell } = props;
  return (
    <Box
      flexDirection="column"
      height={shell.rows}
      paddingX={1}
      width={shell.columns}
    >
      <Header version={packageJson.version} />
      <Box flexDirection="column" flexGrow={1}>
        {shell.notices.map((notice) => (
          <Box key={notice.id}>{notice.node}</Box>
        ))}
        {shell.screen ?? <Text dimColor>p opens the profiles, q quits.</Text>}
      </Box>
      <StatusBar
        segments={[
          { text: 'pbctl', color: 'white' },
          { text: 'not logged in', dim: true },
        ]}
      />
    </Box>
  );
}
