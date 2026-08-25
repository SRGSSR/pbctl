// Push helpers: styled lines for the scrollback.

import { Text } from 'ink';
import type { ShellContext } from './context';

/** The style of a pushed line. */
type LineTone = 'green' | 'yellow' | 'red' | 'dim' | 'plain';

/**
 * Pushes a single styled line.
 *
 * @param target - Anything that can push to the scrollback.
 * @param text - The line to push.
 * @param tone - The line style; plain when omitted.
 * @returns Nothing.
 */
export function pushLine(
  target: Pick<ShellContext, 'push'>,
  text: string,
  tone: LineTone = 'plain',
): void {
  const colored = tone !== 'dim' && tone !== 'plain';
  target.push(
    <Text color={colored ? tone : undefined} dimColor={tone === 'dim'}>
      {text}
    </Text>,
  );
}
