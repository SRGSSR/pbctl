// Pure helpers behind the explorer: the media template and its parsing.

import { randomUUID } from 'node:crypto';
import type { MediaDocument } from '../../engine/engine';

/** One form field. */
export interface Field {
  /** The field key in the answers. */
  key: string;
  /** The question label. */
  label: string;
  /** The value an empty answer falls back to. */
  fallback?: string;
  /** Whether an empty answer is accepted when there is no fallback. */
  optional?: boolean;
}

/**
 * Builds the document a new media starts from: a fresh id and the fields a
 * playable media needs, left blank.
 *
 * @returns The template.
 */
export function mediaTemplate(): MediaDocument {
  return {
    id: `urn:pbctl:media:${randomUUID()}`,
    tags: [],
    sources: [
      { url: '', type: 'ON-DEMAND', mimeType: 'application/x-mpegURL' },
    ],
    metadata: { title: '', subtitle: '', description: '' },
  };
}

/**
 * Parses an edited media document, ignoring `//` comment lines.
 *
 * @param text - The file content.
 * @returns The document, or the parse error message.
 */
export function parseDocument(
  text: string,
): { document: MediaDocument } | { error: string } {
  const json = text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
  try {
    const document = JSON.parse(json) as MediaDocument;
    if (typeof document.id !== 'string' || document.id === '') {
      return { error: 'The document has no id.' };
    }
    return { document };
  } catch (error) {
    return { error: (error as Error).message };
  }
}
