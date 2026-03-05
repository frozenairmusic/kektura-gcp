/**
 * Extract a human-readable message from any thrown value.
 *
 * @param err - The thrown value to extract a message from.
 * @returns A string message describing the error.
 */
export function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : `${err}`;
}
