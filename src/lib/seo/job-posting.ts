// JobPosting JSON-LD (Google for Jobs) pour une offre d'emploi DB.
// Crée ex nihilo (le JobPosting de /devenir-commercial-ia est inline, multi-lieux
// et 100% commission — non réutilisable pour une offre single-location salariée).
// Gère : remote→TELECOMMUTE vs Place ; baseSalary vs incentiveCompensation ;
// validThrough déterministe ; garde-fou published & !filled.
import { SITE_URL } from "@/lib/seo";
import { sanitizeContentGenHtml } from "@/server/content-gen/shared/html-sanitizer";
import { careerImage } from "@/content/careers/careers-images";
import { applicantCountryLabel, normalizeApplicantCountries } from "@/lib/careers/format";
import type { JobOffer } from "../../../prisma/generated/client";

// Aligné sur le nœud Organization canonique (`seo.ts` `#organization`) : même
// `@id` (résolution d'entité Google/LLM), même `name`, `logo` (affiché dans la
// fiche Google for Jobs) et `sameAs` autoritatif (profil externe réel, pas la home).
const HIRING_ORG = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "Axion-IA",
  url: SITE_URL,
  logo: `${SITE_URL}/opengraph-image`,
  sameAs: ["https://www.linkedin.com/company/axion-ia-france"],
} as const;

/**
 * `applicantLocationRequirements` — pays depuis lesquels on accepte les
 * candidatures. Google for Jobs s'en sert pour filtrer les offres TELECOMMUTE
 * sur le pays du chercheur : sans ce champ (ou avec la seule France, l'ancien
 * comportement en dur), une mission 100 % à distance ouverte à la francophonie
 * n'apparaît jamais à un candidat qui cherche depuis Casablanca ou Dakar.
 *
 * Un seul pays → objet ; plusieurs → tableau (schema.org accepte les deux).
 * Aucun pays déclaré → France, pour ne rien changer aux offres existantes.
 */
function applicantLocationRequirements(
  offer: Pick<JobOffer, "applicantCountries">,
  isFr: boolean,
): Record<string, unknown> | Array<Record<string, unknown>> {
  const codes = normalizeApplicantCountries(offer.applicantCountries);
  if (codes.length === 0) return { "@type": "Country", name: "France" };
  const nodes = codes.map((code) => ({
    "@type": "Country",
    name: applicantCountryLabel(code, isFr),
    // `identifier` = code ISO 3166-1 alpha-2 : lève l'ambiguïté des noms
    // traduits pour Google et les moteurs de réponse.
    identifier: code,
  }));
  return nodes.length === 1 ? nodes[0]! : nodes;
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
  // Pas de date de fin automatique (décision Will 2026-07-03) : une offre reste
  // active et indexée tant qu'elle n'est PAS retirée manuellement (archive /
  // pourvue). On n'émet `validThrough` QUE si l'admin l'a explicitement renseignée
  // (sinon l'offre est permanente). Une `validThrough` passée (choix admin) la clôt.
  const explicitValidThrough = offer.validThrough;
  if (explicitValidThrough && explicitValidThrough.getTime() < Date.now()) return null;

  const isFr = locale === "fr";
  const title = isFr ? offer.titleFr : offer.titleEn;
  // Description sanitizée (whitelist) — le composant JsonLd n'échappe pas </script>.
  const description = sanitizeContentGenHtml(isFr ? offer.bodyFr : offer.bodyEn);
  const posted = offer.publishedAt ?? offer.datePosted;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title,
    description,
    identifier: {
      "@type": "PropertyValue",
      name: "Axion-IA",
      value: offer.slug,
    },
    datePosted: posted.toISOString(),
    // validThrough émis uniquement si explicitement fixé par l'admin (cf. supra).
    ...(explicitValidThrough ? { validThrough: explicitValidThrough.toISOString() } : {}),
    employmentType: offer.employmentType,
    hiringOrganization: HIRING_ORG,
    // Image de l'annonce (recommandée par Google for Jobs). URL absolue.
    image: careerImage(offer.slug).url,
    directApply: true,
    // `url` = page de l'ANNONCE (schema.org/JobPosting.url), pas le formulaire
    // `/postuler` : l'intention « postuler directement » reste portée par `directApply`.
    url: `${SITE_URL}/${locale}/carrieres/${offer.slug}`,
    industry: isFr
      ? "Intelligence artificielle · Services aux entreprises"
      : "Artificial intelligence · Business services",
  };

  // jobBenefits depuis les perks pilotés en console (si présents).
  if (Array.isArray(offer.perks)) {
    const benefits = (offer.perks as Array<{ labelFr?: string; labelEn?: string }>)
      .map((p) => (isFr ? p.labelFr : p.labelEn) ?? p.labelFr ?? p.labelEn)
      .filter((x): x is string => Boolean(x));
    if (benefits.length > 0) jsonLd.jobBenefits = benefits.join(", ");
  }

  // Lieu : multi-villes (itinérant/territorial) → tableau de Place (Google for Jobs
  // affiche l'offre dans toutes ces villes, 1 seule annonce, zéro page dupliquée) ;
  // sinon remote → TELECOMMUTE ; sinon Place si ville ; sinon France.
  const multiLocations = Array.isArray(offer.jobLocations)
    ? (offer.jobLocations as Array<{ city?: string; region?: string }>).filter((l) => l.city)
    : [];
  if (multiLocations.length > 0) {
    jsonLd.jobLocation = multiLocations.map((l) => ({
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: l.city,
        ...(l.region ? { addressRegion: l.region } : {}),
        addressCountry: offer.country,
      },
    }));
  } else if (offer.workMode === "remote") {
    jsonLd.jobLocationType = "TELECOMMUTE";
    jsonLd.applicantLocationRequirements = applicantLocationRequirements(offer, isFr);
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
    // Hybride = présentiel + télétravail : signaler les DEUX à Google for Jobs
    // (Place ci-dessus + TELECOMMUTE), sinon Google ne remonte pas l'offre sur
    // les recherches « télétravail ».
    if (offer.workMode === "hybrid") {
      jsonLd.jobLocationType = "TELECOMMUTE";
      jsonLd.applicantLocationRequirements = applicantLocationRequirements(offer, isFr);
    }
  } else {
    jsonLd.applicantLocationRequirements = applicantLocationRequirements(offer, isFr);
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
