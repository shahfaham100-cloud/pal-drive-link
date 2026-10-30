// Client names are unique (case-insensitive, trimmed) — enforced by DB index clients_name_unique_ci.
export const normName = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function friendlyClientError(err: { code?: string; message: string }, name?: string) {
  if (err.code === "23505" || /clients_name_unique_ci/.test(err.message)) {
    return `A client named "${(name ?? "").trim()}" already exists. Please use a unique name (e.g. add the suburb or branch).`;
  }
  return err.message;
}
