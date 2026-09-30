/**
 * Le CATALOGUE montré à l'IA, SANS AUCUN PRIX, et les RÉFÉRENCES de l'ébauche
 * de devis (`compte-rendu-et-extraction.md` §3.4, §5.5).
 *
 * ⛔ Décision de Will du 29/09 (DEVIS = OPTION A) : aucun chiffrage. Le circuit
 * ne calcule AUCUN prix, AUCUN total : Williams compose le devis lui-même, le
 * formulaire s'ouvre vide. L'ancien C4 (chiffrage par le code) est retiré ; garde
 * `l-ebauche-de-devis-ne-contient-aucun-prix.spec.ts`.
 *
 * Deux références seulement :
 *   · `OFF:<code>` — toute offre du site active (`offres_site`) ;
 *   · `TIER:<id>` — tout palier de `src/content/pricing.ts` sans offre active.
 *
 * Une ligne par référence : référence | intitulé | activité | durée | effectif
 * | type de tarif (fixe, à partir de, sur devis). Jamais un montant.
 *
 * L'empreinte SHA-256 de la liste envoyée est gardée dans la vérification
 * (G7 : une référence hors de CETTE liste est rejetée).
 *
 * Fonctions PURES ; `chargerCatalogue()` lit la base.
 */

import { createHash } from "node:crypto";

import type { OffreTarifType } from "../../../prisma/generated/client";
import { PRICING_CATEGORIES, type PricingTier } from "@/content/pricing";

/** Le type de tarif : l'énumération du site (`OffreTarifType`), jamais une copie. */
export type TypeTarif = OffreTarifType;

export interface EntreeCatalogue {
  readonly ref: string;
  readonly intitule: string;
  readonly activite: string;
  readonly duree: string;
  readonly effectif: string;
  readonly typeTarif: TypeTarif;
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
  const [{ listOffres }, { deriveTarifType, resolveOffreEffectifFr }] = await Promise.all([
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
    // La SOURCE est la colonne `tarifType` de l'offre ; une offre « fixe »
    // sans prix ferme dérivable est seulement ramenée à « à partir de ».
    typeTarif:
      o.offre.tarifType === "fixe" && o.prixHtEur === null ? "a_partir_de" : o.offre.tarifType,
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
      });
    }
  }
  return construireCatalogue(entrees);
}

// ── Références de l'ébauche (SANS PRIX) ───────────────────────────────────────

/** Une ligne de l'ébauche, rapportée au catalogue : référence et intitulé, jamais un montant. */
export interface LigneReferencee {
  readonly ref: string;
  readonly intitule: string;
  readonly quantite: number;
  readonly unite: string;
}

/**
 * Les lignes de l'ébauche rapportées au catalogue (intitulé du site). Une
 * référence inconnue est ignorée (G7 l'a déjà rejetée). AUCUN prix, AUCUN
 * total (décision de Will du 29/09). Fonction PURE.
 */
export function referencerEbauche(
  lignes: ReadonlyArray<{
    readonly ref_catalogue: string;
    readonly quantite: number;
    readonly unite: string;
  }>,
  catalogue: CatalogueIA,
): LigneReferencee[] {
  const parRef = new Map(catalogue.entrees.map((e) => [e.ref, e]));
  const sortie: LigneReferencee[] = [];
  for (const l of lignes) {
    const e = parRef.get(l.ref_catalogue);
    if (!e) continue;
    sortie.push({ ref: e.ref, intitule: e.intitule, quantite: l.quantite, unite: l.unite });
  }
  return sortie;
}
