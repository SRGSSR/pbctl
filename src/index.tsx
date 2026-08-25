// pbctl entry point.

import { render } from 'ink';
import { Shell } from './frontend/shell/shell';

// The app owns the alternate screen: Ink enters it here, and the previous
// terminal content returns when the app exits. Ink quits on ctrl+c; the key
// bar offers q for the same.
render(<Shell />, { alternateScreen: true });
