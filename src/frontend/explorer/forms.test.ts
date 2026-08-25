import { expect, test } from 'bun:test';
import { mediaTemplate, parseDocument } from './forms';

test('mediaTemplate proposes a fresh urn id and blank fields', () => {
  const template = mediaTemplate();
  expect(template.id).toMatch(/^urn:pbctl:media:[0-9a-f-]{36}$/);
  expect(template.metadata.title).toBe('');
  expect(template.sources[0]?.mimeType).toBe('application/x-mpegURL');
  expect(mediaTemplate().id).not.toBe(template.id);
});

test('parseDocument ignores comment lines and rejects a missing id', () => {
  expect(
    parseDocument(
      '// note\n{"id":"urn:1","tags":[],"sources":[],"metadata":{}}',
    ),
  ).toEqual({
    document: { id: 'urn:1', tags: [], sources: [], metadata: {} },
  });
  expect(parseDocument('{"tags":[]}')).toEqual({
    error: 'The document has no id.',
  });
  expect(parseDocument('{ nope')).toHaveProperty('error');
});
