import { invalid, notFound, ok } from "@/lib/api/response";
import { applyDrugSparseFields, parseDrugFields } from "@/lib/api/sparse";
import { getRepository } from "@/lib/data/repository";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const drug = await getRepository().getDrug(slug);
  if (!drug) return notFound(`Drug '${slug}' not found`);

  const url = new URL(request.url);

  // Dataset time-travel: `?asOf=<ISO>` pins the request to a past
  // instant. Records are stored as a single newest snapshot, so this
  // gates by extraction time — a record extracted after `asOf` did not
  // yet exist in the dataset at that instant and 404s. The full change
  // timeline lives at `/drug/{slug}/history`.
  const asOfParam = url.searchParams.get("asOf");
  if (asOfParam !== null) {
    const asOfMs = Date.parse(asOfParam);
    if (Number.isNaN(asOfMs)) {
      return invalid("Query parameter 'asOf' must be an ISO-8601 timestamp");
    }
    if (Date.parse(drug.provenance.extractedAt) > asOfMs) {
      return notFound(
        `Drug '${slug}' was not yet in the dataset as of ${new Date(asOfMs).toISOString()}`,
      );
    }
  }

  const fields = parseDrugFields(url.searchParams.get("fields"));
  return ok(applyDrugSparseFields(drug, fields), { request });
}
