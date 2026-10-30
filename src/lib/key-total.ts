/** Each checked client's scheduled visit contributes one key to its run. */
export function countRunKeys(entries: readonly { clients?: { key_no?: boolean | null } | null }[]): number {
  return entries.reduce((total, entry) => total + (entry.clients?.key_no === true ? 1 : 0), 0);
}