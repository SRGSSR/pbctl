// The device login screen: shows the code and waits for the browser login.

import { Box, Text, useInput } from 'ink';
import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';
import {
  type DeviceAuthorization,
  failureMessage,
  type TokenSet,
} from '../../engine/engine';

/** How the login ended: with tokens, or with a message. */
export type LoginOutcome = { tokens: TokenSet } | { error: string };

/** The screen contract. */
export interface DeviceLoginProps {
  /** The pending device login. */
  auth: DeviceAuthorization;
  /** Whether a browser was launched with the verification URL. */
  opened: boolean;
  /** Polls the provider until the login completes; aborts with the signal. */
  poll: (signal: AbortSignal) => Promise<TokenSet>;
  /** Called with the outcome. */
  onDone: (outcome: LoginOutcome) => void;
  /** Called when the user cancels with escape. */
  onCancel: () => void;
}

/**
 * Renders the device login screen.
 *
 * @param props - The component props.
 * @returns The screen element.
 */
export function DeviceLoginScreen(props: DeviceLoginProps): ReactElement {
  usePoll(props);
  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      props.onCancel();
    }
  });
  const url = props.auth.verificationUriComplete ?? props.auth.verificationUri;
  return (
    <Box
      borderColor="cyan"
      borderStyle="round"
      flexDirection="column"
      paddingX={1}
    >
      <Text bold color="cyan">
        Log in with your browser (esc or ctrl+c to cancel)
      </Text>
      <Text>
        Open <Text underline>{url}</Text>
      </Text>
      <Text>
        Code <Text bold>{props.auth.userCode}</Text>
      </Text>
      {!props.opened && (
        <Text color="yellow">
          No browser launcher found; open the URL yourself.
        </Text>
      )}
      <Text dimColor>Waiting for the login to complete…</Text>
    </Box>
  );
}

/**
 * Starts the polling once, and aborts it when the screen unmounts.
 *
 * @param props - The screen props; the latest ones are always used.
 * @returns Nothing.
 */
function usePoll(props: DeviceLoginProps): void {
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const controller = new AbortController();
    latest.current.poll(controller.signal).then(
      (tokens) => latest.current.onDone({ tokens }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          latest.current.onDone({ error: failureMessage(error) });
        }
      },
    );
    return () => controller.abort();
  }, []);
}
