import { afterEach, expect, test } from 'bun:test';
import { setTlsVerification } from './tls';

const variable = 'NODE_TLS_REJECT_UNAUTHORIZED';
const original = process.env[variable];

afterEach(() => {
  if (original === undefined) {
    delete process.env[variable];
  } else {
    process.env[variable] = original;
  }
});

test('verification off is what the runtime reads before a handshake', () => {
  setTlsVerification(false);
  expect(process.env[variable]).toBe('0');
});

test('verification on takes the setting back', () => {
  setTlsVerification(false);
  setTlsVerification(true);
  expect(process.env[variable]).toBe('1');
});
