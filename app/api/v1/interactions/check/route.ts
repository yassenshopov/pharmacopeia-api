import { invalid, ok } from "@/lib/api/response";
import { getRepository } from "@/lib/data/repository";
import { InteractionCheckRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return invalid("Request body must be JSON");
  }

  const parsed = InteractionCheckRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return invalid(
      "Invalid request body",
      parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    );
  }

  const result = await getRepository().checkInteractions(parsed.data.drugs);
  return ok(result, { cacheControl: "public, s-maxage=300" });
}

export async function GET() {
  return invalid(
    "Use POST with JSON body { drugs: string[] } to check interactions",
  );
}
