// Certificate verification, the setting a profile carries as tlsVerify.

/** The variable both Node and Bun read before each TLS handshake. */
const REJECT_UNAUTHORIZED = 'NODE_TLS_REJECT_UNAUTHORIZED';

/**
 * Turns certificate verification on or off for the process.
 *
 * Neither Node's fetch nor Bun's takes a per-request certificate option, so
 * the switch is process wide. pbctl connects to one profile per run, which
 * makes the profile its owner: the login flow applies the setting before the
 * first request, and the wizard before it probes a backend.
 *
 * @param verify - Whether certificates are verified.
 * @returns Nothing.
 */
export function setTlsVerification(verify: boolean): void {
  process.env[REJECT_UNAUTHORIZED] = verify ? '1' : '0';
  if (!verify) {
    silenceWarnings();
  }
}

/**
 * Drops Node's warning printer. Node warns on stderr that verification is
 * off, which would land in the middle of the rendered screen. The shell
 * states the same thing in the login frame and the status bar.
 *
 * @returns Nothing.
 */
function silenceWarnings(): void {
  process.removeAllListeners('warning');
}
