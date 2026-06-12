import {
  API_TAGS,
  DEFAULT_BASE_URL,
  OPERATIONS,
  type Operation,
} from "./manifest";

/**
 * Build a Postman Collection v2.1 from the shared operations manifest —
 * the same source the SDK clients and the OpenAPI document are built
 * from. Import-and-try in Postman / Insomnia therefore stays in lockstep
 * with the live API surface and can never drift: regenerating is one
 * `npm run codegen`, and a drift test fails the build if the committed
 * file falls behind.
 *
 * `{{baseUrl}}` already includes the `/api/v1` prefix; `{{apiKey}}` is a
 * collection variable consumers fill in for the key-gated operations.
 */

interface PostmanQueryParam {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface PostmanHeader {
  key: string;
  value: string;
}

interface PostmanItem {
  name: string;
  request: {
    method: string;
    header: PostmanHeader[];
    url: {
      raw: string;
      host: string[];
      path: string[];
      query?: PostmanQueryParam[];
      variable?: { key: string; value: string }[];
    };
    description?: string;
    body?: { mode: "raw"; raw: string; options: { raw: { language: "json" } } };
  };
}

interface PostmanFolder {
  name: string;
  description?: string;
  item: PostmanItem[];
}

interface PostmanCollection {
  info: {
    name: string;
    description: string;
    schema: string;
  };
  variable: { key: string; value: string }[];
  item: PostmanFolder[];
}

const POSTMAN_SCHEMA =
  "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

function pathSegments(path: string): string[] {
  return path
    .replace(/^\//, "")
    .split("/")
    .map((seg) => seg.replace(/^\{(.+)\}$/, ":$1"));
}

function toItem(op: Operation): PostmanItem {
  const segments = pathSegments(op.path);
  const header: PostmanHeader[] = [];
  if (op.requestSchema) {
    header.push({ key: "Content-Type", value: "application/json" });
  }
  if (op.auth) {
    header.push({ key: "Authorization", value: "Bearer {{apiKey}}" });
  }

  const url: PostmanItem["request"]["url"] = {
    raw: `{{baseUrl}}${op.path}`,
    host: ["{{baseUrl}}"],
    path: segments,
  };

  if (op.pathParams?.length) {
    url.variable = op.pathParams.map((name) => ({ key: name, value: "" }));
  }
  if (op.queryParams?.length) {
    url.query = op.queryParams.map((q) => ({
      key: q.name,
      value: "",
      description: q.description,
      // Required params stay enabled; optional ones start disabled so a
      // first send is a clean default request.
      disabled: !q.required,
    }));
  }

  const item: PostmanItem = {
    name: op.summary,
    request: {
      method: op.method,
      header,
      url,
      description: `\`${op.method} ${op.path}\`${op.auth ? " — requires an API key." : ""}`,
    },
  };

  if (op.requestSchema) {
    item.request.body = {
      mode: "raw",
      raw: "{}",
      options: { raw: { language: "json" } },
    };
  }

  return item;
}

export function buildPostman(): PostmanCollection {
  const folders: PostmanFolder[] = [];
  for (const tag of API_TAGS) {
    const ops = OPERATIONS.filter((op) => op.tag === tag.name);
    if (ops.length === 0) continue;
    folders.push({
      name: tag.name,
      description: tag.description,
      item: ops.map(toItem),
    });
  }

  return {
    info: {
      name: "pharmacopeia API",
      description:
        "Developer-first reference API for medications. Educational / informational use only. " +
        "Set the `baseUrl` collection variable to your host (default is production) and `apiKey` for the key-gated operations.",
      schema: POSTMAN_SCHEMA,
    },
    variable: [
      { key: "baseUrl", value: DEFAULT_BASE_URL },
      { key: "apiKey", value: "" },
    ],
    item: folders,
  };
}

export function emitPostman(): string {
  return `${JSON.stringify(buildPostman(), null, 2)}\n`;
}
