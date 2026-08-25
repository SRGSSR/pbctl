// Turns thrown values into one-line messages for the scrollback.

/**
 * Describes a thrown value.
 *
 * @param error - The thrown value.
 * @returns The error message, or the value as a string.
 */
export function failureMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.cause instanceof Error
      ? `${error.message} (${error.cause.message})`
      : error.message;
  }
  return String(error);
}
