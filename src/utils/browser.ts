// Opens a URL in the default browser.

import { spawn } from 'node:child_process';

/**
 * Opens the URL in the default browser without waiting for it. A missing
 * launcher fails silently, so callers always print the URL as well.
 *
 * @param url - The URL to open.
 * @returns Whether a launcher process was started.
 */
export function openBrowser(url: string): boolean {
  const [command, args] = launcher(url);
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => undefined);
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/**
 * Picks the platform's URL launcher.
 *
 * @param url - The URL to open.
 * @returns The command and its arguments.
 */
function launcher(url: string): [string, string[]] {
  switch (process.platform) {
    case 'darwin':
      return ['open', [url]];
    case 'win32':
      return ['cmd', ['/c', 'start', '', url]];
    default:
      return ['xdg-open', [url]];
  }
}
