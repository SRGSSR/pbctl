// The media list: rows with a highlight, arrows move, enter opens.

import { Box, type Key, Text, useInput } from 'ink';
import { listWindow } from 'inkstand';
import type { ReactElement } from 'react';

/** One list row. */
interface ListRow {
  /** The row id. Unique within the list. */
  id: string;
  /** The displayed text. */
  label: string;
}

/** One media list. */
export interface MediaListProps {
  /** The rows, in display order. */
  rows: ListRow[];
  /** The highlighted row index. */
  highlight: number;
  /** Called with the new row index when the highlight moves. */
  onHighlight: (index: number) => void;
  /** Called with the row id when enter opens a row. */
  onOpen?: (id: string) => void;
  /** Whether the list reads the keyboard. True when omitted. */
  isActive?: boolean;
  /** The rows shown at once; every row when omitted. */
  maxRows?: number;
  /** The text shown in place of an empty list. */
  empty: string;
  /** The Ink color of the highlighted row. White when omitted. */
  highlightColor?: string;
}

/**
 * Renders the rows with the highlighted one in color, each row cut at the
 * width. Controlled: the application holds the highlight.
 *
 * @param props - The component props.
 * @returns The list element.
 */
export function MediaList(props: MediaListProps): ReactElement {
  useInput((_input, key) => handleKey(key, props), {
    isActive: props.isActive !== false,
  });
  if (props.rows.length === 0) {
    return <Text dimColor>{props.empty}</Text>;
  }
  const window = listWindow(props.rows.length, props.highlight, props.maxRows);
  return (
    <Box flexDirection="column">
      {window.above > 0 && <Text dimColor>{`  ↑ ${window.above} more`}</Text>}
      {props.rows.slice(window.start, window.end).map((row, offset) => {
        const highlighted = window.start + offset === props.highlight;
        return (
          <Text
            bold={highlighted}
            color={highlighted ? (props.highlightColor ?? 'white') : undefined}
            dimColor={!highlighted}
            key={row.id}
            wrap="truncate"
          >
            {highlighted ? '❯ ' : '  '}
            {row.label}
          </Text>
        );
      })}
      {window.below > 0 && <Text dimColor>{`  ↓ ${window.below} more`}</Text>}
    </Box>
  );
}

/**
 * Applies one keystroke: arrows move the highlight, enter opens.
 *
 * @param key - The special-key flags.
 * @param props - The list props.
 * @returns Nothing.
 */
function handleKey(key: Key, props: MediaListProps): void {
  const count = props.rows.length;
  if (count === 0) {
    return;
  }
  if (key.upArrow) {
    props.onHighlight((props.highlight + count - 1) % count);
  } else if (key.downArrow) {
    props.onHighlight((props.highlight + 1) % count);
  } else if (key.return) {
    const row = props.rows[props.highlight];
    if (row !== undefined) {
      props.onOpen?.(row.id);
    }
  }
}
