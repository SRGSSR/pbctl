// pbctl entry point. Bootstrap scaffold: header only.

import { Box, render } from 'ink';
import { Header } from 'inkstand';
import type { ReactElement } from 'react';
import packageJson from '../package.json';

/**
 * Renders the application frame. For now that is only the inkstand header;
 * the scrollback, editor, and command router come later.
 *
 * @returns The root element.
 */
function App(): ReactElement {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Header
        name="pbctl"
        version={packageJson.version}
        tagline="a terminal client for pillarbox-demo-backend"
      />
    </Box>
  );
}

render(<App />);
