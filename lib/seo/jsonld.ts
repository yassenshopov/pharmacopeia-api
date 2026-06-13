import type { Drug } from "@/lib/schemas";
import {
  absoluteUrl,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SAME_AS,
  SITE_URL,
} from "./site";

/**
 * Typed JSON-LD builders. Every helper returns a plain object that is
 * serialised inline with `dangerouslySetInnerHTML`. Keep the surface
 * small and predictable — search engines reject malformed schema.
 */

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export type JsonLd = Record<string, unknown>;

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    logo: {
      "@type": "ImageObject",
      "@id": `${SITE_URL}/#logo`,
      url: absoluteUrl("/icon.svg"),
      contentUrl: absoluteUrl("/icon.svg"),
      width: 512,
      height: 512,
      caption: SITE_NAME,
    },
    image: { "@id": `${SITE_URL}/#logo` },
    sameAs: [...SITE_SAME_AS],
  };
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}

export function drugJsonLd(drug: Drug): JsonLd {
  const codes: JsonLd[] = [];
  if (drug.identifiers.rxcui) {
    codes.push({
      "@type": "MedicalCode",
      codingSystem: "RxNorm",
      codeValue: drug.identifiers.rxcui,
    });
  }
  for (const atc of drug.identifiers.atc) {
    codes.push({
      "@type": "MedicalCode",
      codingSystem: "ATC",
      codeValue: atc,
    });
  }
  if (drug.identifiers.drugbank) {
    codes.push({
      "@type": "MedicalCode",
      codingSystem: "DrugBank",
      codeValue: drug.identifiers.drugbank,
    });
  }
  if (drug.identifiers.unii) {
    codes.push({
      "@type": "MedicalCode",
      codingSystem: "UNII",
      codeValue: drug.identifiers.unii,
    });
  }

  const description =
    drug.shortDescription ??
    drug.mechanism?.summary ??
    `${drug.name} reference record on ${SITE_NAME}.`;

  return {
    "@context": "https://schema.org",
    "@type": "Drug",
    "@id": absoluteUrl(`/drugs/${drug.slug}#drug`),
    name: drug.name,
    alternateName: [...drug.synonyms, ...drug.brands],
    description,
    url: absoluteUrl(`/drugs/${drug.slug}`),
    activeIngredient: drug.ingredients.map((i) => i.name),
    drugClass: drug.classes.map((c) => c.name),
    ...(drug.mechanism
      ? {
          mechanismOfAction: drug.mechanism.summary,
          clinicalPharmacology: drug.mechanism.summary,
        }
      : {}),
    ...(codes.length ? { code: codes } : {}),
    isProprietary: drug.brands.length > 0,
    legalStatus: drug.jurisdiction,
  };
}

/**
 * Page-level wrapper for a drug record. `schema.org/Drug` describes the
 * substance; `MedicalWebPage` describes *this page about it* and carries
 * the YMYL trust signals Google's medical systems look for —
 * `lastReviewed`, `reviewedBy`, `medicalAudience`, and a `citation` back
 * to the authoritative source. The framing stays strictly reference: the
 * audience is described, never advised.
 */
export function medicalWebPageJsonLd(params: {
  name: string;
  description: string;
  url: string;
  lastReviewed?: string;
  datePublished?: string;
  citationUrl?: string;
  about?: { "@id": string };
}): JsonLd {
  const url = absoluteUrl(params.url);
  return {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    "@id": `${url}#webpage`,
    name: params.name,
    description: params.description,
    url,
    inLanguage: "en",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    medicalAudience: [
      { "@type": "MedicalAudience", audienceType: "Clinician" },
      { "@type": "MedicalAudience", audienceType: "Researcher" },
    ],
    reviewedBy: { "@id": `${SITE_URL}/#organization` },
    ...(params.about ? { mainEntity: params.about } : {}),
    ...(params.lastReviewed ? { lastReviewed: params.lastReviewed } : {}),
    ...(params.datePublished
      ? { datePublished: params.datePublished }
      : {}),
    ...(params.lastReviewed ? { dateModified: params.lastReviewed } : {}),
    ...(params.citationUrl
      ? { citation: { "@type": "CreativeWork", url: params.citationUrl } }
      : {}),
  };
}

/**
 * Derive a small, self-contained FAQ from a drug record. Every answer is
 * lifted verbatim or near-verbatim from the structured record so the
 * `FAQPage` schema never asserts anything the page itself doesn't show.
 * These match real long-tail queries ("what is X used for", "what class
 * is X") where the structured data is the differentiator.
 */
export function drugFaqItems(
  drug: Drug,
): { question: string; answer: string }[] {
  const items: { question: string; answer: string }[] = [];
  const className = drug.classes[0]?.name;

  if (drug.mechanism?.summary) {
    items.push({
      question: `How does ${drug.name} work?`,
      answer: drug.mechanism.summary,
    });
  }
  if (drug.indications.length > 0) {
    const uses = drug.indications.map((i) => i.text).slice(0, 4).join("; ");
    items.push({
      question: `What is ${drug.name} used for?`,
      answer: `According to FDA labeling, ${drug.name} carries indications including: ${uses}. This is a reference summary of labeled uses, not medical advice or a treatment recommendation.`,
    });
  }
  if (className) {
    items.push({
      question: `What class of drug is ${drug.name}?`,
      answer: `${drug.name} is classified as ${drug.classes
        .map((c) => c.name)
        .join(", ")}.`,
    });
  }
  if (drug.brands.length > 0) {
    items.push({
      question: `What are the brand names for ${drug.name}?`,
      answer: `${drug.name} is marketed under brand names including ${drug.brands
        .slice(0, 8)
        .join(", ")}.`,
    });
  }
  if (drug.contraindications.length > 0) {
    items.push({
      question: `What are the contraindications for ${drug.name}?`,
      answer: `${drug.name} labeling lists contraindications including: ${drug.contraindications
        .map((c) => c.text)
        .slice(0, 4)
        .join("; ")}. Always consult the full prescribing information and a clinician.`,
    });
  }
  return items;
}

/**
 * A `CollectionPage` wrapping an ordered `ItemList`. Used for hub pages
 * (drugs in a class, drugs for a condition) so the list relationship is
 * machine-readable and the members can surface as sitelinks.
 */
export function collectionPageJsonLd(params: {
  name: string;
  description: string;
  url: string;
  items: { name: string; url: string }[];
}): JsonLd {
  const url = absoluteUrl(params.url);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#webpage`,
    name: params.name,
    description: params.description,
    url,
    inLanguage: "en",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: params.items.length,
      itemListElement: params.items.map((item, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        name: item.name,
        url: absoluteUrl(item.url),
      })),
    },
  };
}

/**
 * Describes the whole dataset as a `Dataset` entity (Google Dataset
 * Search + AI ingestion). Points at the machine-readable surfaces and
 * the open licence so the corpus is discoverable as data, not just pages.
 */
export function datasetJsonLd(params: {
  drugs: number;
  classes: number;
  ingredients: number;
  version: string;
  updatedAt: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${SITE_URL}/#dataset`,
    name: `${SITE_NAME} — open medication reference dataset`,
    description: `Structured, versioned reference data for ${params.drugs} medications, ${params.classes} pharmacological classes, and ${params.ingredients} active ingredients, with per-record provenance. Snapshot ${params.version}.`,
    url: absoluteUrl("/data"),
    sameAs: absoluteUrl("/data"),
    version: params.version,
    dateModified: params.updatedAt,
    inLanguage: "en",
    isAccessibleForFree: true,
    creator: { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    keywords: [
      "medications",
      "drugs",
      "drug classes",
      "drug interactions",
      "RxNorm",
      "ATC",
      "openFDA",
      "pharmacology",
    ],
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: absoluteUrl("/api/v1/openapi.json"),
        name: "OpenAPI 3.1 document",
      },
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: absoluteUrl("/api/v1/drugs"),
        name: "Drugs collection (paginated JSON)",
      },
    ],
  };
}

export function articleJsonLd(params: {
  title: string;
  description: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: params.title,
    description: params.description,
    url: absoluteUrl(params.url),
    inLanguage: "en",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    ...(params.datePublished ? { datePublished: params.datePublished } : {}),
    ...(params.dateModified ? { dateModified: params.dateModified } : {}),
    mainEntityOfPage: absoluteUrl(params.url),
  };
}

export function faqPageJsonLd(
  items: { question: string; answer: string }[],
  url: string,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: absoluteUrl(url),
    isPartOf: { "@id": `${SITE_URL}/#website` },
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function definedTermSetJsonLd(params: {
  name: string;
  description: string;
  url: string;
  terms: { term: string; definition: string; slug: string }[];
}): JsonLd {
  const setUrl = absoluteUrl(params.url);
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": `${setUrl}#glossary`,
    name: params.name,
    description: params.description,
    url: setUrl,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    hasDefinedTerm: params.terms.map((t) => ({
      "@type": "DefinedTerm",
      "@id": `${setUrl}#${t.slug}`,
      name: t.term,
      description: t.definition,
      inDefinedTermSet: `${setUrl}#glossary`,
      url: `${setUrl}#${t.slug}`,
    })),
  };
}

export function jsonLdScriptProps(obj: JsonLd | JsonLd[]) {
  return {
    type: "application/ld+json" as const,
    dangerouslySetInnerHTML: { __html: JSON.stringify(obj) },
  };
}
