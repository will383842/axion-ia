/**
 * Le CATALOGUE montré à l'IA, SANS AUCUN PRIX, et le CHIFFRAGE par le code
 * (C4) de l'ébauche de devis (`compte-rendu-et-extraction.md` §3.4, §5.5).
 *
 * Deux références seulement :
 *   · `OFF:<code>` — toute offre du site active (`offres_site`) ;
 *   · `TIER:<id>` — tout palier de `src/content/pricing.ts` sans offre active.
 *
 * Une ligne par référence : référence | intitulé | activité | durée | effectif
 * | type de tarif (fixe, à partir de, sur devis). Jamais un montant : c'est le
 * site qui chiffre, et seulement quand le prix est FERME
 * (`resolveOffrePriceEur`) — une offre « à partir de » ou « sur devis » ne
 * reçoit aucun montant (jamais un plancher inscrit comme prix).
 *
 * L'empreinte SHA-256 de la liste envoyée est gardée dans la vérification
 * (G7 : une référence hors de CETTE liste est rejetée).
 *
 * Fonctions PURES ; `chargerCatalogue()` lit la base.
 */

import { createHash } from "node:crypto";

import { PRICING_CATEGORIES, type PricingTier } from "@/content/pricing";

export type TypeTarif = "fixe" | "a_partir_de" | "sur_devis";

export interface EntreeCatalogue {
  readonly ref: string;
  readonly intitule: string;
  readonly activite: string;
  readonly duree: string;
  readonly effectif: string;
  readonly typeTarif: TypeTarif;
  /** Prix HT FERME en euros, pour le chiffrage par le code — JAMAIS envoyé à l'IA. */
  readonly prixHtEur: number | null;
}

export interface CatalogueIA {
  readonly entrees: readonly EntreeCatalogue[];
  readonly refs: ReadonlySet<string>;
  /** Le texte envoyé (sans prix). */
  readonly texte: string;
  readonly empreinte: string;
}

const LIBELLE_TARIF: Readonly<Record<TypeTarif, string>> = {
  fixe: "tarif : fixe",
  a_partir_de: "tarif : à partir de",
  sur_devis: "tarif : sur devis",
};

/** Retire tout ce qui ressemble à un montant d'un libellé (ceinture et bretelles). */
function sansMontant(texte: string): string {
  return texte
    .replace(/\d[\d\s  .,]*\s*(?:€|euros?|k€)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function construireCatalogue(entrees: readonly EntreeCatalogue[]): CatalogueIA {
  const triees = [...entrees].sort((a, b) => a.ref.localeCompare(b.ref));
  const texte = triees
    .map((e) =>
      [
        e.ref,
        sansMontant(e.intitule),
        e.activite,
        sansMontant(e.duree) || "—",
        sansMontant(e.effectif) || "—",
        LIBELLE_TARIF[e.typeTarif],
      ].join(" | "),
    )
    .join("\n");
  return {
    entrees: triees,
    refs: new Set(triees.map((e) => e.ref)),
    texte,
    empreinte: createHash("sha256").update(texte).digest("hex"),
  };
}

/** Activité d'une catégorie de `PRICING_CATEGORIES` — la clé est celle du catalogue du site. */
const ACTIVITE_PAR_CATEGORIE = {
  audit: "audit",
  interventions: "formation",
  implementation: "implementation",
  maintenance: "implementation",
  codage: "site_web",
} as const satisfies Record<keyof typeof PRICING_CATEGORIES, string>;

/** Lit les offres actives et les paliers ; rend le catalogue. */
export async function chargerCatalogue(): Promise<CatalogueIA> {
  const [{ listOffres }, { deriveTarifType, resolveOffreEffectifFr, resolveOffrePriceEur }] =
    await Promise.all([
      import("@/server/qualiopi/offres/offres"),
      import("@/server/qualiopi/offres/pricing-resolver"),
    ]);
  const offres = await listOffres({ actifOnly: true });
  const tiersAvecOffre = new Set(offres.map((o) => o.offre.tierId).filter((x): x is string => !!x));
  const entrees: EntreeCatalogue[] = offres.map((o) => ({
    ref: `OFF:${o.offre.code}`,
    intitule: o.offre.titreFr,
    activite: o.offre.categorie === "intervention" ? "formation" : String(o.offre.categorie),
    duree:
      o.offre.dureeHeuresMin === o.offre.dureeHeuresMax
        ? `${o.offre.dureeHeuresMin} h`
        : `${o.offre.dureeHeuresMin} à ${o.offre.dureeHeuresMax} h`,
    effectif: resolveOffreEffectifFr(o.offre) ?? "",
    typeTarif:
      o.offre.tarifType === "sur_devis"
        ? "sur_devis"
        : o.prixHtEur === null
          ? "a_partir_de"
          : "fixe",
    prixHtEur: o.prixHtEur,
  }));
  for (const categorie of Object.keys(PRICING_CATEGORIES) as Array<
    keyof typeof PRICING_CATEGORIES
  >) {
    for (const t of PRICING_CATEGORIES[categorie] as ReadonlyArray<PricingTier>) {
      if (tiersAvecOffre.has(t.id)) continue;
      entrees.push({
        ref: `TIER:${t.id}`,
        intitule: t.labelFr,
        activite: ACTIVITE_PAR_CATEGORIE[categorie],
        duree: t.durationFr ?? "",
        effectif: t.groupSizeFr ?? "",
        // LA règle du site (une seule) : `deriveTarifType`.
        typeTarif: deriveTarifType(t),
        prixHtEur: resolveOffrePriceEur({ tierId: t.id, gamme: null, dureeCode: null }),
      });
    }
  }
  return construireCatalogue(entrees);
}

// ── C4 — chiffrage par le code ───────────────────────────────────────────────

export interface LigneChiffree {
  readonly ref: string;
  readonly intitule: string;
  readonly quantite: number;
  readonly unite: string;
  readonly typeTarif: TypeTarif;
  /** Prix unitaire HT en centimes — seulement si FERME. */
  readonly prixUnitaireHtCents: number | null;
  readonly totalHtCents: number | null;
}

export interface EbaucheChiffree {
  readonly lignes: readonly LigneChiffree[];
  /** Total HT des seules lignes chiffrées ; `null` si aucune ne l'est. */
  readonly totalHtCents: number | null;
  readonly lignesSurDevis: number;
}

export function chiffrerEbauche(
  lignes: ReadonlyArray<{
    readonly ref_catalogue: string;
    readonly quantite: number;
    readonly unite: string;
  }>,
  catalogue: CatalogueIA,
): EbaucheChiffree {
  const parRef = new Map(catalogue.entrees.map((e) => [e.ref, e]));
  const chiffrees: LigneChiffree[] = [];
  for (const l of lignes) {
    const e = parRef.get(l.ref_catalogue);
    if (!e) continue; // G7 : une référence inconnue ne se chiffre pas (déjà rejetée).
    const pu =
      e.typeTarif === "fixe" && e.prixHtEur !== null ? Math.round(e.prixHtEur * 100) : null;
    chiffrees.push({
      ref: e.ref,
      intitule: e.intitule,
      quantite: l.quantite,
      unite: l.unite,
      typeTarif: e.typeTarif,
      prixUnitaireHtCents: pu,
      totalHtCents: pu === null ? null : pu * Math.max(0, l.quantite),
    });
  }
  const fermes = chiffrees.filter((c) => c.totalHtCents !== null);
  return {
    lignes: chiffrees,
    totalHtCents:
      fermes.length === 0 ? null : fermes.reduce((s, c) => s + (c.totalHtCents ?? 0), 0),
    lignesSurDevis: chiffrees.length - fermes.length,
  };
}
