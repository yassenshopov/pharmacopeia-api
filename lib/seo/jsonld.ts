import type { Drug } from "@/lib/schemas";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "./site";

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
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/favicon.ico"),
    },
    sameAs: ["https://github.com"],
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
