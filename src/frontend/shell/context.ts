// The contract between the shell and the flows it runs.

import type { Open } from 'inkstand';
import type { ReactNode } from 'react';
import type { Connection } from '../../engine/engine';

/** The session state flows read and change. */
interface Session {
  /** The live connection, when logged in. */
  connection?: Connection;
  /** Replaces the live connection. */
  setConnection: (connection: Connection | undefined) => void;
}

/** What a flow can act on. */
export interface ShellContext {
  /** Appends a message to the shell. */
  push: (node: ReactNode) => void;
  /** Opens a screen and resolves with its result. */
  open: Open;
  /** Quits the application. */
  exit: () => void;
  /** The session state. */
  session: Session;
}
