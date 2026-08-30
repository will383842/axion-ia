/**
 * VilleTissuEconomique — Server Component partagé (Sprint A · Phase 4).
 *
 * Affiche le tissu économique d'une ville sous forme d'un tableau « Secteur ·
 * Présence · Opportunités IA » exploitable par toute page ville (hub
 * `/fr/implantations/{region}/{ville}` et templates verticale). Source de
 * vérité par ordre de priorité : (1) `ville.economicData.topSectorsNaf`
 * (INSEE/CCI vérifié), (2) `ville.copy.topSectorsNaf` (tags B2B curatés),
 * (3) fallback générique neutre (PME / ETI / grands groupes — vrai pour la majorité des
 * villes françaises). Aucun chiffre fabriqué : la colonne « Présence » est
 * qualitative (forte / moyenne / émergente). Les opportunités IA proviennent
 * du catalogue partagé `src/content/ville-tissu-data.ts` (génériques par
 * secteur, jamais inventées par ville).
 */

import type { Ville } from "@/content/villes";
import {
  resolveSectorOpportunity,
  SECTOR_IA_FALLBACK_FR,
  SECTOR_IA_FALLBACK_EN,
  type SectorIaOpportunity,
} from "@/content/ville-tissu-data";

interface VilleTissuEconomiqueProps {
  readonly ville: Ville;
  readonly isFr: boolean;
}

/**
 * Ligne du tableau secteurs — normalisée à partir des sources hétérogènes.
 */
interface SectorRow {
  readonly key: string;
  /** Libellé secteur dans la langue active. */
  readonly sector: string;
  /** Présence qualitative — jamais un nombre fabriqué. */
  readonly presence: string;
  /** Phrase opportunité IA. */
  readonly opportunity: string;
}

/** Mappe rank INSEE → présence qualitative (jamais un compte fabriqué). */
function presenceFromRank(
  rank: number | undefined,
  count: number | undefined,
  isFr: boolean,
): string {
  if (rank !== undefined) {
    if (rank <= 2) return isFr ? "Forte" : "Strong";
    if (rank <= 4) return isFr ? "Moyenne" : "Moderate";
    return isFr ? "Émergente" : "Emerging";
  }
  if (count !== undefined && count > 0) {
    if (count >= 5000) return isFr ? "Forte" : "Strong";
    if (count >= 500) return isFr ? "Moyenne" : "Moderate";
    return isFr ? "Émergente" : "Emerging";
  }
  return isFr ? "Présence avérée" : "Established";
}

/** Libellé secteur dans la langue active, fallback FR si EN manquant. */
function sectorLabel(
  opportunity: SectorIaOpportunity | undefined,
  raw: string,
  isFr: boolean,
): string {
  if (!opportunity) return raw;
  return isFr ? opportunity.labelFr : opportunity.labelEn;
}

/** Phrase opportunité IA selon langue, fallback générique sinon. */
function opportunityText(opportunity: SectorIaOpportunity | undefined, isFr: boolean): string {
  if (!opportunity) return isFr ? SECTOR_IA_FALLBACK_FR : SECTOR_IA_FALLBACK_EN;
  return isFr ? opportunity.opportunityFr : opportunity.opportunityEn;
}

/**
 * Construit la liste des secteurs à afficher (3-6 max). Priorité :
 *   1. `economicData.topSectorsNaf` (vérifié INSEE)
 *   2. `copy.topSectorsNaf` (tags B2B éditoriaux)
 *   3. fallback générique 4 secteurs neutres
 */
function buildRows(ville: Ville, isFr: boolean): ReadonlyArray<SectorRow> {
  const fromEconomic = ville.economicData?.topSectorsNaf;
  if (fromEconomic && fromEconomic.length > 0) {
    return fromEconomic.slice(0, 6).map((entry, idx) => {
      const opportunity = resolveSectorOpportunity(entry.label);
      return {
        key: `naf-${entry.naf}-${idx}`,
        sector: sectorLabel(opportunity, entry.label, isFr),
        presence: presenceFromRank(entry.rank, entry.etablissementsCount, isFr),
        opportunity: opportunityText(opportunity, isFr),
      };
    });
  }

  const fromCopy = ville.copy?.topSectorsNaf;
  if (fromCopy && fromCopy.length > 0) {
    return fromCopy.slice(0, 6).map((label, idx) => {
      const opportunity = resolveSectorOpportunity(label);
      return {
        key: `copy-${idx}`,
        sector: sectorLabel(opportunity, label, isFr),
        presence: isFr ? "Présence avérée" : "Established",
        opportunity: opportunityText(opportunity, isFr),
      };
    });
  }

  // Fallback générique : tissu mixte vrai pour la majorité des communes FR.
  const fallbackLabels = isFr
    ? [
        "Conseil & Services aux entreprises",
        "Commerce & Distribution",
        "BTP & Construction",
        "Tech & Édition logicielle",
      ]
    : [
        "Consulting & Business services",
        "Retail & Distribution",
        "Construction & Civil engineering",
        "Tech & Software publishing",
      ];
  return fallbackLabels.map((label, idx) => {
    const opportunity = resolveSectorOpportunity(label);
    return {
      key: `fallback-${idx}`,
      sector: sectorLabel(opportunity, label, isFr),
      presence: isFr ? "Tissu mixte" : "Mixed fabric",
      opportunity: opportunityText(opportunity, isFr),
    };
  });
}

export function VilleTissuEconomique({ ville, isFr }: VilleTissuEconomiqueProps) {
  const rows = buildRows(ville, isFr);
  const sectionId = `ville-tissu-${ville.slug}`;
  const headingId = `${sectionId}-title`;

  // Will 2026-05-26 : renommé pour distinguer clairement de VilleEcosystemeLocal
  // (qui parle de l'écosystème institutionnel + données INSEE). Ce composant =
  // tableau secteurs B2B + leviers IA prioritaires (action-oriented).
  const heading = isFr
    ? `Secteurs B2B et leviers IA à ${ville.nameFr}`
    : `Secteurs B2B et leviers IA à ${ville.nameFr}`;

  const description = isFr
    ? `Vue d'ensemble des secteurs B2B représentés à ${ville.nameFr} et leurs leviers IA prioritaires. Notre cabinet accompagne PME, ETI et grands groupes sans biais sectoriel.`
    : `Overview of B2B sectors active in ${ville.nameEn ?? ville.nameFr} and their priority AI levers. Our consultancy supports very small, medium, mid-cap and large companies with no sector bias.`;

  return (
    <section aria-labelledby={headingId} id={sectionId} className="bg-paper py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-6 lg:px-10">
        <p className="text-fg-muted mb-3 text-[12px] font-semibold tracking-[0.16em] uppercase">
          <span className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle" />
          {isFr ? "Opportunités IA par secteur" : "Opportunités IA par secteur"}
        </p>
        <h2
          id={headingId}
          className="text-ink text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {heading}
        </h2>
        <p className="text-fg-soft mt-3 max-w-3xl text-base leading-relaxed">{description}</p>

        {/* Desktop / tablette ≥ sm : tableau classique 3 colonnes */}
        <div className="border-border mt-10 hidden overflow-hidden rounded-lg border sm:block">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-sand text-ink">
              <tr>
                <th scope="col" className="border-border border-b px-4 py-3 font-semibold">
                  {isFr ? "Secteur" : "Sector"}
                </th>
                <th scope="col" className="border-border border-b px-4 py-3 font-semibold">
                  {isFr ? "Présence locale" : "Local presence"}
                </th>
                <th scope="col" className="border-border border-b px-4 py-3 font-semibold">
                  {isFr ? "Opportunités IA" : "AI opportunities"}
                </th>
              </tr>
            </thead>
            <tbody className="bg-bg">
              {rows.map((row, idx) => (
                <tr
                  key={row.key}
                  className={
                    idx % 2 === 0
                      ? "border-border border-b last:border-b-0"
                      : "bg-paper border-border border-b last:border-b-0"
                  }
                >
                  <td className="text-ink px-4 py-3 align-top font-medium">{row.sector}</td>
                  <td className="text-fg-soft px-4 py-3 align-top">{row.presence}</td>
                  <td className="text-fg-soft px-4 py-3 align-top leading-relaxed">
                    {row.opportunity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile < sm : cards empilées (table 3 cols illisible sur petit écran) */}
        <ul className="mt-10 grid grid-cols-1 gap-4 sm:hidden">
          {rows.map((row) => (
            <li key={row.key} className="border-border bg-bg rounded-lg border p-4">
              <p className="text-ink text-base font-semibold">{row.sector}</p>
              <p className="text-fg-muted mt-1 text-xs font-medium tracking-wider uppercase">
                {isFr ? "Présence" : "Presence"} · {row.presence}
              </p>
              <p className="text-fg-soft mt-2 text-sm leading-relaxed">{row.opportunity}</p>
            </li>
          ))}
        </ul>

        <p className="text-fg-muted mt-6 text-xs leading-relaxed">
          {isFr
            ? "Les opportunités présentées sont génériques par secteur ; nous calibrons chaque mission selon votre taille (PME / ETI / grands groupes) et vos données réelles lors de l'audit IA Flash."
            : "Opportunities shown are sector-generic; each engagement is tailored to your company size (VSE / SME / mid-cap / large) and real data during the Flash AI audit."}
        </p>
      </div>
    </section>
  );
}
