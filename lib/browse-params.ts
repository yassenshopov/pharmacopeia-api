/**
 * Shared `?q=&page=` parsing for the server-paginated browse pages.
 * Pages pass the resolved values straight into the repository's list
 * methods, so filtering and paging always happen server-side.
 */

export interface BrowseSearchParams {
  q?: string;
  page?: string;
}

export function parseBrowseParams(
  sp: BrowseSearchParams,
  pageSize: number,
): { query: string; page: number; limit: number; offset: number } {
  const query = (sp.q ?? "").trim();
  const page = Math.max(Number.parseInt(sp.page ?? "1", 10) || 1, 1);
  return { query, page, limit: pageSize, offset: (page - 1) * pageSize };
}
