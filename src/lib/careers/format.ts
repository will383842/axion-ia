// Helpers d'affichage partagés des offres d'emploi (hub /carrieres + widget
// embarquable). SSOT : libellés mode de travail, badge « Nouveau », fourchette
// salariale conforme directive UE 2023/970 (jamais de mention vague — on
// affiche une fourchette ou RIEN). Extrait du hub pour réutilisation par
// `OffersWidget` (iframe embed). Fonctions pures → testables sans Prisma.

import type { JobOffer } from "../../../prisma/generated/client";

export const WORKMODE_LABELS: Record<string, { fr: string; en: string }> = {
  on_site: { fr: "Sur site", en: "On-site" },
  hybrid: { fr: "Hybride", en: "Hybrid" },
  remote: { fr: "Remote", en: "Remote" },
};

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
