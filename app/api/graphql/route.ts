import { createYoga } from "graphql-yoga";
import { schema } from "@/lib/graphql/schema";

/**
 * Thin GraphQL surface over the same `PharmacopeiaRepository` that
 * backs the REST API. Single endpoint:
 *   - GET  → GraphiQL IDE (when the Accept header asks for HTML)
 *           or a query via the `query` search param.
 *   - POST → GraphQL request body.
 *   - OPTIONS → CORS preflight.
 *
 * No persisted queries, no subscriptions, no auth: this is the same
 * public read surface as `/api/v1/*`, just field-selected by the
 * caller. The Zod schemas in `lib/schemas/` remain the source of
 * truth for the underlying data shape.
 */

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response: globalThis.Response },
  graphiql: {
    title: "pharmacopeia — GraphQL",
    defaultQuery: `# Welcome to the pharmacopeia GraphQL playground.
#
# A thin field-selection layer over the same data the REST API
# exposes under /api/v1/*. One round-trip can pull a drug, its
# mechanism, its interactions, and its structural analogs.

query MetforminWithAnalogs {
  drug(slug: "metformin") {
    name
    shortDescription
    mechanism { summary targets }
    identifiers { rxcui atc }
    similar { slug name score className }
    interactions {
      drugB severity description
    }
  }
}`,
  },
});

// Yoga's context shape differs from Next.js Route Handlers (which now
// pass `params: Promise<{}>`), so we wrap the callable yoga instance
// in standard Web-Fetch handlers. This route has no dynamic segments,
// so the context payload is discarded.
async function handle(request: Request): Promise<Response> {
  return yoga(request);
}

export { handle as GET, handle as POST, handle as OPTIONS };
