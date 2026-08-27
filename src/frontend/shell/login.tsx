// The login flow: device code, browser, polling, then the backend probe.

import { copyToClipboard } from 'inkstand';
import {
  type Connection,
  createConnection,
  type DeviceAuthorization,
  type Discovery,
  failureMessage,
  fetchDiscovery,
  type ProbeResult,
  type Profile,
  pollForToken,
  probeBackend,
  requestDeviceCode,
  setTlsVerification,
} from '../../engine/engine';
import { openBrowser } from '../../utils/browser';
import { DeviceLoginScreen, type LoginOutcome } from '../screens/device-login';
import type { ShellContext } from './context';
import { pushLine } from './output';

/** A device login ready to be completed in the browser. */
interface PendingLogin {
  /** The provider endpoints. */
  discovery: Discovery;
  /** The codes. */
  auth: DeviceAuthorization;
}

/**
 * Logs in to a profile with the device flow and makes it the live connection.
 * The profile's TLS setting applies from here on, to the identity provider
 * and to the backend.
 *
 * @param profile - The profile to log in to.
 * @param context - What the flow can act on.
 * @returns Whether the login completed.
 */
export async function login(
  profile: Profile,
  context: ShellContext,
): Promise<boolean> {
  announce(profile, context);
  const pending = await startLogin(profile, context);
  if (pending === undefined) {
    return false;
  }
  const outcome = await completeLogin(profile, pending, context);
  if (outcome === undefined) {
    pushLine(context, 'Login cancelled.', 'dim');
    return false;
  }
  if ('error' in outcome) {
    pushLine(context, `✖ Login failed: ${outcome.error}`, 'red');
    return false;
  }
  const connection = createConnection(
    profile,
    pending.discovery,
    outcome.tokens,
  );
  await report(connection, context);
  context.session.setConnection(connection);
  return true;
}

/**
 * Applies the profile's TLS setting and states what the login is about to do.
 *
 * @param profile - The profile to log in to.
 * @param context - Where the lines go.
 * @returns Nothing.
 */
function announce(profile: Profile, context: ShellContext): void {
  setTlsVerification(profile.tlsVerify);
  pushLine(
    context,
    `Logging in to "${profile.name}" (${profile.backend})…`,
    'dim',
  );
  if (!profile.tlsVerify) {
    pushLine(
      context,
      '⚠ TLS certificate verification is off for this profile.',
      'yellow',
    );
  }
}

/**
 * Fetches the discovery document and requests the device code.
 *
 * @param profile - The profile to log in to.
 * @param context - Where failures are reported.
 * @returns The pending login, or undefined after a reported failure.
 */
async function startLogin(
  profile: Profile,
  context: ShellContext,
): Promise<PendingLogin | undefined> {
  try {
    const discovery = await fetchDiscovery(profile.issuer);
    const auth = await requestDeviceCode(
      discovery,
      profile.clientId,
      profile.scopes,
    );
    return { discovery, auth };
  } catch (error) {
    pushLine(context, `✖ Login failed: ${failureMessage(error)}`, 'red');
    return undefined;
  }
}

/**
 * Opens the browser and the device login screen, and waits for the outcome.
 *
 * @param profile - The profile to log in to.
 * @param pending - The pending login.
 * @param context - What opens the screen.
 * @returns The outcome, or undefined when the user cancelled.
 */
function completeLogin(
  profile: Profile,
  pending: PendingLogin,
  context: ShellContext,
): Promise<LoginOutcome | undefined> {
  const url =
    pending.auth.verificationUriComplete ?? pending.auth.verificationUri;
  copyToClipboard(pending.auth.userCode);
  const opened = openBrowser(url);
  pushLine(context, `Open ${url} and enter the code ${pending.auth.userCode}.`);
  return context.open<LoginOutcome>((done, cancel) => (
    <DeviceLoginScreen
      auth={pending.auth}
      onCancel={cancel}
      onDone={done}
      opened={opened}
      poll={(signal) =>
        pollForToken(pending.discovery, profile.clientId, pending.auth, {
          signal,
        })
      }
    />
  ));
}

/**
 * Prints who logged in and whether the backend accepts the token.
 *
 * @param connection - The new connection.
 * @param context - Where the report is pushed.
 * @returns Nothing.
 */
async function report(
  connection: Connection,
  context: ShellContext,
): Promise<void> {
  const { identity, profile } = connection;
  const roles =
    identity.roles.length === 0 ? 'no roles' : identity.roles.join(', ');
  pushLine(context, `✔ Logged in as ${identity.name} (${roles}).`, 'green');
  const probe = await probeBackend(connection);
  pushLine(context, ...probeLine(probe, profile.backend));
}

/**
 * Formats the backend probe result.
 *
 * @param probe - The probe result.
 * @param backend - The backend URL, for the message.
 * @returns The line and its tone.
 */
function probeLine(
  probe: ProbeResult,
  backend: string,
): [string, 'green' | 'yellow'] {
  switch (probe.kind) {
    case 'ok':
      return [`✔ ${backend} accepts the token.`, 'green'];
    case 'rejected':
      return [
        `⚠ ${backend} rejected the token (HTTP ${probe.status}). Check the issuer and the client id.`,
        'yellow',
      ];
    default:
      return [`⚠ ${backend} is unreachable (${probe.message}).`, 'yellow'];
  }
}
