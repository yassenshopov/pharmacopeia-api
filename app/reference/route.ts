import { ApiReference } from "@scalar/nextjs-api-reference";

/**
 * /reference
 *
 * Browsable, "try it" reference rendered by Scalar over the live
 * `/api/v1/openapi.json` document. The spec itself is generated from
 * the same Zod schemas the route handlers validate against, so anything
 * shown here mirrors what `/api/v1/*` actually returns.
 */
export const GET = ApiReference({
  url: "/api/v1/openapi.json",
  metaData: {
    title: "API reference · pharmacopeia",
    description:
      "Interactive reference for the pharmacopeia v1 API, generated from the same Zod schemas the handlers validate against.",
  },
  hideClientButton: false,
  defaultOpenAllTags: true,
  hiddenClients: [],
});
