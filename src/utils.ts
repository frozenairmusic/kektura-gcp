// ─── Shared utilities ─────────────────────────────────────────────────────────

/** Extract a human-readable message from any thrown value. */
export function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : `${err}`;
}
