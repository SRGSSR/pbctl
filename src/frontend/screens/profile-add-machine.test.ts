import { expect, test } from 'bun:test';
import { ProfileAddMachine, toProfile } from './profile-add-machine';

test('the wizard walks name, backend, issuer, client id, scopes, tls', () => {
  let machine = ProfileAddMachine.start();
  const steps: string[] = [];
  for (const value of ['local', 'http://b', 'http://i', 'cid', 'openid']) {
    steps.push(machine.step);
    machine = machine.answer(value);
  }
  steps.push(machine.step);
  expect(steps).toEqual([
    'name',
    'backend',
    'issuer',
    'clientId',
    'scopes',
    'tls',
  ]);
  expect(machine.question.kind).toBe('select');
  expect(machine.result).toBe(undefined);
  const done = machine.answer(false);
  expect(done.result).toEqual({
    name: 'local',
    backend: 'http://b',
    issuer: 'http://i',
    clientId: 'cid',
    scopes: 'openid',
    tlsVerify: false,
  });
});

test('text questions carry their default as fallback', () => {
  const machine = ProfileAddMachine.start();
  expect(machine.question.fallback).toBe('default');
  expect(machine.answer('x').question.fallback).toBe('http://localhost:8080');
});

test('withAnswers turns detected values into fallbacks without moving', () => {
  const machine = ProfileAddMachine.start()
    .answer('local')
    .answer('http://b')
    .withAnswers({ issuer: 'http://detected', clientId: 'detected-client' });
  expect(machine.step).toBe('issuer');
  expect(machine.question.fallback).toBe('http://detected');
  expect(machine.answer('http://detected').question.fallback).toBe(
    'detected-client',
  );
});

test('initial answers become fallbacks', () => {
  expect(ProfileAddMachine.start({ name: 'prod' }).question.fallback).toBe(
    'prod',
  );
});

test('toProfile splits scopes and trims trailing slashes', () => {
  expect(
    toProfile({
      name: 'local',
      backend: 'http://b/',
      issuer: 'http://i//',
      clientId: 'cid',
      scopes: ' openid   profile ',
      tlsVerify: true,
    }),
  ).toEqual({
    name: 'local',
    backend: 'http://b',
    issuer: 'http://i',
    clientId: 'cid',
    scopes: ['openid', 'profile'],
    tlsVerify: true,
  });
});
