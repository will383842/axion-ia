// Helpers d'affichage partagés des offres d'emploi (hub /carrieres + widget
// embarquable). SSOT : libellés mode de travail, badge « Nouveau », fourchette
// salariale conforme directive UE 2023/970 (jamais de mention vague — on
// affiche une fourchette ou RIEN). Extrait du hub pour réutilisation par
// `OffersWidget` (iframe embed). Fonctions pures → testables sans Prisma.

import type { JobOffer } from "../../../prisma/generated/client";

// SSOT du libellé de mode de travail. Trois copies coexistaient (ici, la page
// d'offre, la liste console) et disaient trois mots différents pour le MÊME
// état : « Remote », « Remote », « À distance ». Le FR n'avait jamais été
// traduit — or « télétravail » est le mot que les candidats francophones
// tapent réellement. Toute copie de cette table est un bug : importer d'ici.
export const WORKMODE_LABELS: Record<string, { fr: string; en: string }> = {
  on_site: { fr: "Sur site", en: "On-site" },
  hybrid: { fr: "Hybride", en: "Hybrid" },
  remote: { fr: "Télétravail", en: "Remote" },
};

/**
 * Libellés des types de contrat schema.org (`JobPosting.employmentType`).
 * SSOT : sans ce mapping, une offre non-FULL_TIME affichait l'enum BRUT en
 * clair dans la FAQ publique (« Il s'agit d'un poste en CONTRACTOR ») — 9 offres
 * concernées en prod au 2026-08-11. Clés = valeurs schema.org autorisées.
 */
export const EMPLOYMENT_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  FULL_TIME: { fr: "CDI temps plein", en: "full-time permanent contract" },
  PART_TIME: { fr: "temps partiel", en: "part-time contract" },
  CONTRACTOR: { fr: "freelance (prestation indépendante)", en: "freelance contract" },
  TEMPORARY: { fr: "CDD", en: "fixed-term contract" },
  INTERN: { fr: "stage", en: "internship" },
  VOLUNTEER: { fr: "bénévolat", en: "volunteer role" },
  PER_DIEM: { fr: "vacation (mission ponctuelle)", en: "per-diem role" },
  OTHER: { fr: "contrat spécifique", en: "specific contract" },
};

/**
 * Libellé lisible du type de contrat. `contractLabel` (piloté en console) prime
 * toujours ; sinon on traduit l'enum ; en dernier recours on renvoie `null`
 * plutôt que l'enum brut — un libellé technique n'a rien à faire en façade.
 * Un second type déclaré (JSON-LD en tableau) s'affiche « X ou Y » : la façade
 * doit dire la même chose que ce qu'on déclare à Google.
 */
export function contractTypeLabel(
  o: Pick<JobOffer, "contractLabel" | "employmentType"> & {
    secondaryEmploymentType?: string | null;
  },
  isFr: boolean,
): string | null {
  if (o.contractLabel) return o.contractLabel;
  const primary = EMPLOYMENT_TYPE_LABELS[o.employmentType]?.[isFr ? "fr" : "en"] ?? null;
  if (!primary) return null;
  const secondary = o.secondaryEmploymentType
    ? (EMPLOYMENT_TYPE_LABELS[o.secondaryEmploymentType]?.[isFr ? "fr" : "en"] ?? null)
    : null;
  return secondary ? `${primary} ${isFr ? "ou" : "or"} ${secondary}` : primary;
}

/**
 * Pays d'où l'on accepte les candidatures (`JobOffer.applicantCountries`, codes
 * ISO 3166-1 alpha-2). Sert à la fois l'affichage et le
 * `JobPosting.applicantLocationRequirements` (Google for Jobs filtre les offres
 * télétravail par pays du chercheur : sans ces pays, une annonce ouverte à la
 * francophonie reste invisible hors de France).
 */
export const APPLICANT_COUNTRY_LABELS: Record<string, { fr: string; en: string }> = {
  FR: { fr: "France", en: "France" },
  BE: { fr: "Belgique", en: "Belgium" },
  CH: { fr: "Suisse", en: "Switzerland" },
  LU: { fr: "Luxembourg", en: "Luxembourg" },
  MC: { fr: "Monaco", en: "Monaco" },
  CA: { fr: "Canada", en: "Canada" },
  MA: { fr: "Maroc", en: "Morocco" },
  DZ: { fr: "Algérie", en: "Algeria" },
  TN: { fr: "Tunisie", en: "Tunisia" },
  SN: { fr: "Sénégal", en: "Senegal" },
  CI: { fr: "Côte d'Ivoire", en: "Ivory Coast" },
  CM: { fr: "Cameroun", en: "Cameroon" },
  BJ: { fr: "Bénin", en: "Benin" },
  BF: { fr: "Burkina Faso", en: "Burkina Faso" },
  ML: { fr: "Mali", en: "Mali" },
  TG: { fr: "Togo", en: "Togo" },
  NE: { fr: "Niger", en: "Niger" },
  GA: { fr: "Gabon", en: "Gabon" },
  CG: { fr: "Congo", en: "Congo" },
  CD: { fr: "République démocratique du Congo", en: "DR Congo" },
  MG: { fr: "Madagascar", en: "Madagascar" },
  MU: { fr: "Maurice", en: "Mauritius" },
  LB: { fr: "Liban", en: "Lebanon" },
  HT: { fr: "Haïti", en: "Haiti" },
};

/** Nom lisible d'un pays éligible, ou son code ISO si inconnu du mapping. */
export function applicantCountryLabel(code: string, isFr: boolean): string {
  return APPLICANT_COUNTRY_LABELS[code]?.[isFr ? "fr" : "en"] ?? code;
}

/**
 * Codes ISO éligibles, normalisés (majuscules, dédupliqués, ordre conservé).
 * Liste vide = aucun ciblage explicite → l'appelant retombe sur son défaut.
 */
export function normalizeApplicantCountries(codes: readonly string[] | null | undefined): string[] {
  if (!codes?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of codes) {
    const code = raw.trim().toUpperCase();
    if (code.length !== 2 || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

/** Une offre est « nouvelle » si publiée il y a moins de 14 jours. */
export function isNew(datePosted: Date, now: number = Date.now()): boolean {
  return now - datePosted.getTime() < 14 * 24 * 3600 * 1000;
}

/** Libellé du mode de travail (sur site / hybride / remote). */
export function workModeLabel(workMode: string, isFr: boolean): string {
  return WORKMODE_LABELS[workMode]?.[isFr ? "fr" : "en"] ?? workMode;
}

type SalaryFields = Pick<
  JobOffer,
  "isCommission" | "salaryVisible" | "salaryMin" | "salaryMax" | "salaryPeriod" | "salaryCurrency"
>;

/**
 * Fourchette salariale lisible, ou `null` si masquée. Directive UE 2023/970 :
 * on ne montre JAMAIS de mention vague (« selon profil ») — soit une fourchette
 * chiffrée, soit rien. Commission déplafonnée traitée à part.
 */
export function salaryLabel(o: SalaryFields, isFr: boolean): string | null {
  if (o.isCommission) return isFr ? "Commission déplafonnée" : "Uncapped commission";
  if (!o.salaryVisible) return null;
  if (o.salaryMin == null && o.salaryMax == null) return null;
  const k = (n: number) => `${Math.round(n / 1000)}k`;
  const per =
    o.salaryPeriod === "YEAR"
      ? isFr
        ? "/an"
        : "/yr"
      : o.salaryPeriod === "MONTH"
        ? isFr
          ? "/mois"
          : "/mo"
        : "/h";
  const range =
    o.salaryMin != null && o.salaryMax != null
      ? `${k(o.salaryMin)}–${k(o.salaryMax)}`
      : k((o.salaryMin ?? o.salaryMax) as number);
  return `${range} ${o.salaryCurrency} ${per}`;
}
