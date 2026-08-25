// The diff confirmation: the change as a line diff, then apply or cancel.

import { Box, Text, useInput } from 'ink';
import { type DiffLine, DiffView, diffLines, Select } from 'inkstand';
import type { ReactElement } from 'react';

/** The dialog contract. */
export interface DiffConfirmProps {
  /** The dialog title. */
  title: string;
  /** The text before the change. */
  before: string;
  /** The text after the change. */
  after: string;
  /** The diff lines shown at most; the rest is counted. */
  maxRows: number;
  /** Called when the user applies the change. */
  onConfirm: () => void;
  /** Called when the user cancels. */
  onCancel: () => void;
}

/**
 * Renders the diff and the apply question.
 *
 * @param props - The component props.
 * @returns The dialog element.
 */
export function DiffConfirm(props: DiffConfirmProps): ReactElement {
  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      props.onCancel();
    }
  });
  const lines = fit(diffLines(props.before, props.after), props.maxRows);
  return (
    <Box
      borderColor="cyan"
      borderStyle="round"
      flexDirection="column"
      paddingX={1}
    >
      <Text bold color="cyan">
        {props.title} (esc cancels)
      </Text>
      <DiffView lines={lines} />
      <Select
        highlightColor="cyan"
        items={[
          { label: 'apply', value: true },
          { label: 'cancel', value: false },
        ]}
        onSelect={(apply) => (apply ? props.onConfirm() : props.onCancel())}
      />
    </Box>
  );
}

/**
 * Keeps the changed lines and their context up to a row count.
 *
 * @param lines - The diff lines.
 * @param maxRows - The rows to keep.
 * @returns The lines, with a final `@` line counting what was cut.
 */
function fit(lines: DiffLine[], maxRows: number): DiffLine[] {
  const changed = lines.filter((line) => line.sign !== ' ');
  const kept =
    changed.length <= maxRows
      ? changed
      : changed.slice(0, Math.max(maxRows - 1, 1));
  const cut = changed.length - kept.length;
  return cut === 0
    ? kept
    : [...kept, { sign: '@', text: `… ${cut} more changed lines` }];
}
