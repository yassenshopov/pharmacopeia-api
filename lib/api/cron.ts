/**
 * Shared gate for /api/cron/* routes.
 *
 * Vercel cron invokes scheduled paths with
 * `Authorization: Bearer <CRON_SECRET>`; manual triggers must present
 * the same header. Routes refuse to run when CRON_SECRET is unset
 * rather than being silently public, and refuse without a Postgres
 * backend because scheduled ingest writes to the database by
 * definition.
 *
 * Returns a Response to short-circuit with, or null when the request
 * is allowed to proceed.
 */
export function requireCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      {
        error: {
          code: "NOT_CONFIGURED",
          message: "CRON_SECRET is not set; refusing to run unauthenticated",
        },
      },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or missing cron secret",
        },
      },
      { status: 401 },
    );
  }
  if (!process.env.DATABASE_URL) {
    return Response.json(
      {
        error: {
          code: "NOT_CONFIGURED",
          message:
            "Scheduled ingest requires the Postgres backend (DATABASE_URL)",
        },
      },
      { status: 503 },
    );
  }
  return null;
}
