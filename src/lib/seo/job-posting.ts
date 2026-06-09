// JobPosting JSON-LD (Google for Jobs) pour une offre d'emploi DB.
// Crée ex nihilo (le JobPosting de /devenir-commercial-ia est inline, multi-lieux
// et 100% commission — non réutilisable pour une offre single-location salariée).
// Gère : remote→TELECOMMUTE vs Place ; baseSalary vs incentiveCompensation ;
// validThrough déterministe ; garde-fou published & !filled.
import { SITE_URL } from "@/lib/seo";
import { sanitizeContentGenHtml } from "@/server/content-gen/shared/html-sanitizer";
import type { JobOffer } from "../../../prisma/generated/client";

const HIRING_ORG = {
  "@type": "Organization",
  name: "Axion-IA",
  url: SITE_URL,
  sameAs: SITE_URL,
} as const;

/** validThrough : offer.validThrough sinon date de publication + 1 an (déterministe). */
function resolveValidThrough(validThrough: Date | null, posted: Date): string {
  if (validThrough) return validThrough.toISOString();
  const d = new Date(posted);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString();
}

/**
 * Construit le JobPosting d'une offre. Renvoie `null` si l'offre ne doit PAS
 * exposer de JobPosting (non publiée ou pourvue) — évite les offres fantômes
 * dans Google for Jobs.
 */
export function buildJobPostingJsonLd(
  offer: JobOffer,
  locale: "fr" | "en" = "fr",
): Record<string, unknown> | null {
  // Garde-fou cohérent avec l'indexabilité : pas de JobPosting si non-publiée,
  // pourvue, noindex (tier≠1) ou expirée (sinon Google for Jobs indexe une offre
  // qu'on a voulu cacher/clôturer).
  if (offer.status !== "published" || offer.filledAt) return null;
  if (offer.indexationTier !== "tier_1_indexable") return null;
  if (offer.validThrough && offer.validThrough.getTime() < Date.now()) return null;

  const isFr = locale === "fr";
  const title = isFr ? offer.titleFr : offer.titleEn;
  // Description sanitizée (whitelist) — le composant JsonLd n'échappe pas </script>.
  const description = sanitizeContentGenHtml(isFr ? offer.bodyFr : offer.bodyEn);
  const posted = offer.publishedAt ?? offer.datePosted;
  const applyUrl = `${SITE_URL}/${locale}/carrieres/${offer.slug}/postuler`;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title,
    description,
    datePosted: posted.toISOString(),
    validThrough: resolveValidThrough(offer.validThrough, posted),
    employmentType: offer.employmentType,
    hiringOrganization: HIRING_ORG,
    directApply: true,
    url: applyUrl,
    industry: isFr
      ? "Intelligence artificielle · Services aux entreprises"
      : "Artificial intelligence · Business services",
  };

  // Lieu : remote → TELECOMMUTE ; sinon Place si ville ; sinon France.
  if (offer.workMode === "remote") {
    jsonLd.jobLocationType = "TELECOMMUTE";
    jsonLd.applicantLocationRequirements = { "@type": "Country", name: "France" };
  } else if (offer.city) {
    jsonLd.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: offer.city,
        ...(offer.region ? { addressRegion: offer.region } : {}),
        addressCountry: offer.country,
      },
    };
  } else {
    jsonLd.applicantLocationRequirements = { "@type": "Country", name: "France" };
  }

  // Rémunération : commission → incentiveCompensation ; sinon baseSalary
  // (uniquement si fourchette renseignée ET affichée publiquement).
  if (offer.isCommission) {
    jsonLd.incentiveCompensation = isFr
      ? "Rémunération à la commission, déplafonnée."
      : "Uncapped commission-based pay.";
  } else if (offer.salaryVisible && (offer.salaryMin != null || offer.salaryMax != null)) {
    jsonLd.baseSalary = {
      "@type": "MonetaryAmount",
      currency: offer.salaryCurrency,
      value: {
        "@type": "QuantitativeValue",
        ...(offer.salaryMin != null ? { minValue: offer.salaryMin } : {}),
        ...(offer.salaryMax != null ? { maxValue: offer.salaryMax } : {}),
        unitText: offer.salaryPeriod,
      },
    };
  }

  return jsonLd;
}
