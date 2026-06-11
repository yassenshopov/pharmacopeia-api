/**
 * Embedding provider client for semantic search and grounded retrieval.
 *
 * Provider resolution, in order:
 *  1. `AI_GATEWAY_API_KEY` → Vercel AI Gateway (OpenAI-compatible
 *     `/v1/embeddings`, model namespaced as `openai/<model>`).
 *  2. `OPENAI_API_KEY`     → OpenAI directly.
 *  3. Neither              → embeddings unavailable; callers fall back
 *     to lexical scoring over the same passages.
 *
 * The model and dimension count are pinned here and nowhere else —
 * stored vectors are only comparable to queries embedded with the same
 * model, so changing either means re-running `npm run db:embed -- --all`.
 */

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 512;

interface EmbeddingProvider {
  url: string;
  apiKey: string;
  model: string;
}

function resolveProvider(): EmbeddingProvider | null {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  if (gatewayKey) {
    return {
      url: "https://ai-gateway.vercel.sh/v1/embeddings",
      apiKey: gatewayKey,
      model: `openai/${EMBEDDING_MODEL}`,
    };
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      url: "https://api.openai.com/v1/embeddings",
      apiKey: openaiKey,
      model: EMBEDDING_MODEL,
    };
  }
  return null;
}

export function embeddingsConfigured(): boolean {
  return resolveProvider() !== null;
}

/**
 * Embed a batch of texts. Throws when no provider is configured —
 * use {@link embedQueryOrNull} on request paths that should degrade
 * instead of fail.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const provider = resolveProvider();
  if (!provider) {
    throw new Error(
      "No embeddings provider configured; set AI_GATEWAY_API_KEY or OPENAI_API_KEY",
    );
  }
  const res = await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Embeddings request failed (${res.status}): ${detail.slice(0, 300)}`,
    );
  }
  const body = (await res.json()) as {
    data: Array<{ index: number; embedding: number[] }>;
  };
  // The API preserves input order, but sort by index defensively —
  // a misaligned vector silently poisons the whole store.
  const vectors = body.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
  if (vectors.length !== texts.length) {
    throw new Error(
      `Embeddings response count mismatch: sent ${texts.length}, got ${vectors.length}`,
    );
  }
  return vectors;
}

/** Embed one query, or null when no provider is configured. */
export async function embedQueryOrNull(
  text: string,
): Promise<number[] | null> {
  if (!embeddingsConfigured()) return null;
  const [vector] = await embedTexts([text]);
  return vector;
}

/** pgvector text literal (`[0.1,0.2,...]`) for raw SQL parameters. */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
