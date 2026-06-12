/**
 * Global test setup.
 *
 * Tests run against the static seed repository unless a suite
 * explicitly opts into Postgres via TEST_DATABASE_URL. Deleting
 * DATABASE_URL here (before any test imports the repository module)
 * guarantees getRepository() can never silently pick the Prisma
 * backend because a developer's shell happened to have the var set.
 */
delete process.env.DATABASE_URL;
delete process.env.DIRECT_URL;
