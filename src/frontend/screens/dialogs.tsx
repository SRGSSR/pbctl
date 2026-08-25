// The confirm dialog.

import { Box, Text, useInput } from 'ink';
import { Select } from 'inkstand';
import type { ReactElement } from 'react';

/**
 * Handles the cancel keys of a dialog.
 *
 * @param onCancel - Called on escape or ctrl+c.
 * @returns Nothing.
 */
function useCancelKeys(onCancel: () => void): void {
  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      onCancel();
    }
  });
}

/**
 * Renders a yes/no question, with no highlighted first.
 *
 * @param props - The component props.
 * @param props.question - The question.
 * @param props.yes - The label of the yes item.
 * @param props.onConfirm - Called when the user picks yes.
 * @param props.onCancel - Called when the user picks no or cancels.
 * @returns The dialog element.
 */
export function ConfirmScreen(props: {
  question: string;
  yes: string;
  onConfirm: () => void;
  onCancel: () => void;
}): ReactElement {
  useCancelKeys(props.onCancel);
  return (
    <Box
      borderColor="red"
      borderStyle="round"
      flexDirection="column"
      paddingX={1}
    >
      <Text color="red">{props.question}</Text>
      <Select
        highlightColor="cyan"
        items={[
          { label: 'no', value: false },
          { label: props.yes, value: true },
        ]}
        onSelect={(confirmed) =>
          confirmed ? props.onConfirm() : props.onCancel()
        }
      />
    </Box>
  );
}
