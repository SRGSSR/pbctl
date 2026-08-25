import { expect, test } from 'bun:test';
import type { FetchLike } from './detect';
import {
  type DeviceAuthorization,
  type Discovery,
  fetchDiscovery,
  pollForToken,
  refreshTokens,
  requestDeviceCode,
} from './oidc';

const DISCOVERY: Discovery = {
  issuer: 'http://idp/realms/pillarbox',
  deviceAuthorizationEndpoint: 'http://idp/device',
  tokenEndpoint: 'http://idp/token',
};

const AUTH: DeviceAuthorization = {
  deviceCode: 'dev',
  userCode: 'ABCD-EFGH',
  verificationUri: 'http://idp/verify',
  expiresIn: 600,
  interval: 5,
};

/**
 * Builds a fetch stub answering JSON bodies in order, then repeating the last.
 *
 * @param answers - The bodies to answer, with their statuses.
 * @returns The stub and the requests it saw.
 */
function jsonStub(answers: { status: number; body: unknown }[]): {
  fetchFn: FetchLike;
  requests: { url: string; body: string }[];
} {
  const requests: { url: string; body: string }[] = [];
  const fetchFn: FetchLike = (url, init) => {
    requests.push({ url, body: String(init?.body ?? '') });
    const answer = answers[Math.min(requests.length, answers.length) - 1];
    return Promise.resolve(
      new Response(JSON.stringify(answer?.body), { status: answer?.status }),
    );
  };
  return { fetchFn, requests };
}

/** A sleep that never waits and records the requested delays. */
function instantSleep(): {
  sleep: (ms: number) => Promise<void>;
  delays: number[];
} {
  const delays: number[] = [];
  return {
    sleep: (ms) => {
      delays.push(ms);
      return Promise.resolve();
    },
    delays,
  };
}

test('fetchDiscovery reads the endpoints from the well-known document', async () => {
  const { fetchFn, requests } = jsonStub([
    {
      status: 200,
      body: {
        issuer: 'http://idp/realms/pillarbox',
        token_endpoint: 'http://idp/token',
        device_authorization_endpoint: 'http://idp/device',
      },
    },
  ]);
  expect(await fetchDiscovery('http://idp/realms/pillarbox/', fetchFn)).toEqual(
    DISCOVERY,
  );
  expect(requests[0]?.url).toBe(
    'http://idp/realms/pillarbox/.well-known/openid-configuration',
  );
});

test('fetchDiscovery rejects providers without the device grant', async () => {
  const { fetchFn } = jsonStub([
    { status: 200, body: { token_endpoint: 'http://idp/token' } },
  ]);
  await expect(fetchDiscovery('http://idp', fetchFn)).rejects.toThrow(
    'device authorization grant',
  );
});

test('fetchDiscovery reports HTTP failures', async () => {
  const { fetchFn } = jsonStub([{ status: 404, body: {} }]);
  await expect(fetchDiscovery('http://idp', fetchFn)).rejects.toThrow(
    'HTTP 404',
  );
});

test('requestDeviceCode posts the client and scopes and reads the codes', async () => {
  const { fetchFn, requests } = jsonStub([
    {
      status: 200,
      body: {
        device_code: 'dev',
        user_code: 'ABCD-EFGH',
        verification_uri: 'http://idp/verify',
        verification_uri_complete: 'http://idp/verify?user_code=ABCD-EFGH',
        expires_in: 600,
        interval: 5,
      },
    },
  ]);
  const auth = await requestDeviceCode(
    DISCOVERY,
    'pbctl',
    ['openid', 'profile'],
    fetchFn,
  );
  expect(auth).toEqual({
    ...AUTH,
    verificationUriComplete: 'http://idp/verify?user_code=ABCD-EFGH',
  });
  expect(requests[0]?.body).toBe('client_id=pbctl&scope=openid+profile');
});

test('requestDeviceCode surfaces the provider error', async () => {
  const { fetchFn } = jsonStub([
    {
      status: 400,
      body: { error: 'unauthorized_client', error_description: 'disabled' },
    },
  ]);
  await expect(
    requestDeviceCode(DISCOVERY, 'pbctl', [], fetchFn),
  ).rejects.toThrow('unauthorized_client: disabled');
});

test('pollForToken waits through pending and slow_down, then returns tokens', async () => {
  const { fetchFn, requests } = jsonStub([
    { status: 400, body: { error: 'authorization_pending' } },
    { status: 400, body: { error: 'slow_down' } },
    {
      status: 200,
      body: { access_token: 'at', refresh_token: 'rt', expires_in: 60 },
    },
  ]);
  const { sleep, delays } = instantSleep();
  const before = Date.now();
  const tokens = await pollForToken(DISCOVERY, 'pbctl', AUTH, {
    fetchFn,
    sleep,
  });
  expect(tokens.accessToken).toBe('at');
  expect(tokens.refreshToken).toBe('rt');
  expect(tokens.expiresAt).toBeGreaterThanOrEqual(before + 60_000);
  expect(delays).toEqual([5000, 5000, 10_000]);
  expect(requests[2]?.body).toContain('device_code=dev');
});

test('pollForToken fails on a denied login', async () => {
  const { fetchFn } = jsonStub([
    { status: 400, body: { error: 'access_denied' } },
  ]);
  const { sleep } = instantSleep();
  await expect(
    pollForToken(DISCOVERY, 'pbctl', AUTH, { fetchFn, sleep }),
  ).rejects.toThrow('access_denied');
});

test('pollForToken fails when the codes expire', async () => {
  const { fetchFn } = jsonStub([
    { status: 400, body: { error: 'authorization_pending' } },
  ]);
  const { sleep } = instantSleep();
  await expect(
    pollForToken(
      DISCOVERY,
      'pbctl',
      { ...AUTH, expiresIn: 0 },
      { fetchFn, sleep },
    ),
  ).rejects.toThrow('expired');
});

test('pollForToken stops when the signal aborts', async () => {
  const { fetchFn, requests } = jsonStub([
    { status: 400, body: { error: 'authorization_pending' } },
  ]);
  const controller = new AbortController();
  controller.abort();
  await expect(
    pollForToken(DISCOVERY, 'pbctl', AUTH, {
      fetchFn,
      signal: controller.signal,
    }),
  ).rejects.toThrow('Login cancelled.');
  expect(requests).toHaveLength(0);
});

test('refreshTokens keeps the old refresh token when none is issued', async () => {
  const { fetchFn, requests } = jsonStub([
    { status: 200, body: { access_token: 'at2', expires_in: 60 } },
  ]);
  const tokens = await refreshTokens(DISCOVERY, 'pbctl', 'rt', fetchFn);
  expect(tokens.accessToken).toBe('at2');
  expect(tokens.refreshToken).toBe('rt');
  expect(requests[0]?.body).toBe(
    'grant_type=refresh_token&client_id=pbctl&refresh_token=rt',
  );
});
