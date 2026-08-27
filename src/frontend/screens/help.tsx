// The key overlay: every explorer key, in place of the media pane.

import { Box, Text, useInput } from 'ink';
import { Pane } from 'inkstand';
import type { ReactElement } from 'react';

/** One group of keys. */
interface Group {
  /** The group title. */
  title: string;
  /** The keys, each with what it does. */
  keys: { key: string; label: string }[];
}

/** The width of the key column, in cells. */
const KEY_WIDTH = 4;

/** The width of the left column, in cells. */
const LEFT_WIDTH = 24;

/** The groups of the left column. */
const LEFT: Group[] = [
  {
    title: 'Move',
    keys: [
      { key: '↑ ↓', label: 'the highlight' },
      { key: '← →', label: 'fold, or the pane' },
      { key: 'tab', label: 'the key bar' },
    ],
  },
  {
    title: 'Anywhere',
    keys: [
      { key: '/', label: 'search' },
      { key: 'c', label: 'clear the search' },
      { key: 'r', label: 'reload' },
      { key: 'q', label: 'quit' },
      { key: '?', label: 'these keys' },
    ],
  },
];

/** The groups of the right column. */
const RIGHT: Group[] = [
  {
    title: 'Folders',
    keys: [
      { key: 'n', label: 'new folder' },
      { key: 'm', label: 'new media' },
      { key: 'e', label: 'rename' },
      { key: 'd', label: 'delete' },
      { key: 'P', label: 'move the marked' },
    ],
  },
  {
    title: 'Media',
    keys: [
      { key: '↵', label: 'edit' },
      { key: 'm', label: 'new media' },
      { key: 'v', label: 'mark for a move' },
      { key: 'x', label: 'unassign' },
      { key: 'd', label: 'delete' },
      { key: 'u', label: 'restore (bin)' },
    ],
  },
];

/**
 * Renders every key of the explorer in two columns, then the folder glyphs.
 * Any key closes it.
 *
 * @param props - The component props.
 * @param props.onClose - Called on the first keystroke.
 * @returns The overlay element.
 */
export function HelpScreen(props: { onClose: () => void }): ReactElement {
  useInput(() => props.onClose());
  return (
    <Pane detail="any key closes" focusColor="cyan" focused grow title="Keys">
      <Box columnGap={2}>
        <Column groups={LEFT} width={LEFT_WIDTH} />
        <Column groups={RIGHT} />
      </Box>
      <Text dimColor wrap="truncate">
        🔒 restricted · 🔓 restricted, you may write
      </Text>
    </Pane>
  );
}

/**
 * Renders one column of groups.
 *
 * @param props - The component props.
 * @param props.groups - The groups, in display order.
 * @param props.width - The column width in cells; the free space when
 * omitted.
 * @returns The column element.
 */
function Column(props: { groups: Group[]; width?: number }): ReactElement {
  return (
    <Box
      flexBasis={props.width}
      flexDirection="column"
      flexGrow={props.width === undefined ? 1 : 0}
      flexShrink={0}
    >
      {props.groups.map((group) => (
        <Box flexDirection="column" flexShrink={0} key={group.title}>
          <Text bold>{group.title}</Text>
          {group.keys.map((entry) => (
            <Text dimColor key={`${group.title}:${entry.key}`} wrap="truncate">
              <Text bold>{entry.key.padStart(KEY_WIDTH)}</Text> {entry.label}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}
