/**
 * Content Generator — Ancrage local sémantique (PH3, plan §7 / pack 07 réécrit).
 *
 * Injecte les VRAIES données économiques d'une ville dans le prompt pour que le
 * LLM les intègre (anti-doorway nominatif). Porté du pack v2 `07` MAIS :
 *   - ✅ alimenté depuis le SSOT existant `getVilleEconomicData(slug)` (PAS le
 *     modèle KB fragile du pack qui violait le contrat READ-ONLY de kb-client).
 *   - Mode dégradé (sans données) → ancrage minimal SANS invention.
 *   - Pur : 0 I/O (l'appelant fournit déjà `VilleEconomicData`).
 *
 * DORMANT en PH3 : aucun générateur ne l'appelle encore ; c'est la brique
 * d'injection prompt à câbler lors de l'activation pilote (profil local/commercial).
 */

import type { VilleEconomicData } from "@/content/villes/economic-data/types";

/** Données ville aplaties pour l'ancrage (shape consommée par buildLocalAnchorBlock). */
export interface VilleKbFacts {
  readonly villeNom: string;
  readonly departement: string;
  readonly region: string;
  readonly economicData: ReadonlyArray<string>;
  readonly secteursDominants: ReadonlyArray<string>;
  readonly ecosystemActeurs: ReadonlyArray<string>;
  readonly reseauxConsulaires: ReadonlyArray<string>;
  readonly caracteristiquesLocales: ReadonlyArray<string>;
}

export interface LocalAnchorParams {
  readonly ville: string;
  readonly departement?: string;
  readonly region?: string;
  readonly kbFacts: VilleKbFacts | null;
}

/**
 * Adaptateur SSOT → ancrage : mappe le `VilleEconomicData` réel vers `VilleKbFacts`.
 * N'invente rien : se limite aux champs réellement présents (sourcés/datés).
 */
export function villeEconomicToAnchorFacts(
  data: VilleEconomicData | undefined,
  opts: { ville: string; departement?: string; region?: string },
): VilleKbFacts | null {
  if (!data) return null;

  const secteursDominants = (data.topSectorsNaf ?? []).map((s) => s.label).filter(Boolean);

  const ecosystemActeurs = (data.grandsGroupesImplantes ?? [])
    .map((g) => (g.secteur ? `${g.nom} (${g.secteur})` : g.nom))
    .filter(Boolean);

  const reseauxConsulaires = data.cciCompetente?.nom ? [data.cciCompetente.nom] : [];

  const economicData: string[] = [];
  const insee = data.statsInsee;
  if (insee?.etablissementsActifs) {
    economicData.push(
      `${insee.etablissementsActifs.toLocaleString("fr-FR")} établissements actifs (INSEE ${insee.anneeReference})`,
    );
  }
  if (insee?.creationsEntreprises) {
    economicData.push(
      `${insee.creationsEntreprises.toLocaleString("fr-FR")} créations d'entreprises (INSEE ${insee.anneeReference})`,
    );
  }
  if (insee?.densiteEtablissementsPour1000) {
    economicData.push(
      `densité de ${insee.densiteEtablissementsPour1000} établissements / 1000 hab.`,
    );
  }

  const caracteristiquesLocales = (data.communesBassin ?? [])
    .map((c) => (typeof c === "object" && c && "nom" in c ? String(c.nom) : ""))
    .filter(Boolean)
    .slice(0, 5);

  // Si vraiment aucune matière → null (mode dégradé géré par l'appelant).
  if (
    secteursDominants.length === 0 &&
    economicData.length === 0 &&
    ecosystemActeurs.length === 0 &&
    reseauxConsulaires.length === 0
  ) {
    return null;
  }

  return {
    villeNom: opts.ville,
    departement: opts.departement ?? "",
    region: opts.region ?? "",
    economicData,
    secteursDominants,
    ecosystemActeurs,
    reseauxConsulaires,
    caracteristiquesLocales,
  };
}

/**
 * Construit le bloc d'ancrage local injecté dans le prompt. Porté verbatim du
 * pack `07` (string-building pur).
 */
export function buildLocalAnchorBlock(params: LocalAnchorParams): string {
  const { ville, departement, region, kbFacts } = params;

  if (!kbFacts) {
    return `
=== ANCRAGE GÉOGRAPHIQUE ===

Ville ciblée : ${ville}${departement ? ` (${departement})` : ""}${region ? `, ${region}` : ""}

RÈGLES D'ANCRAGE (SANS données locales KB — mode minimal) :
1. Mentionner ${ville} explicitement dans le corps du texte (pas seulement dans le titre)
2. JAMAIS de formulation générique "dans votre région" ou "dans votre ville"
3. JAMAIS inventer des entreprises locales, des chiffres économiques locaux, ou des acteurs spécifiques à ${ville}
4. Se limiter aux données sectorielles nationales — ne PAS localiser les statistiques sans source
5. Le scénario avant/après peut mentionner ${ville} comme localisation de la situation décrite
`.trim();
  }

  const economicBlock =
    kbFacts.economicData.length > 0
      ? `Données économiques réelles :\n${kbFacts.economicData
          .slice(0, 4)
          .map((d) => `- ${d}`)
          .join("\n")}`
      : "";

  const secteursBlock =
    kbFacts.secteursDominants.length > 0
      ? `Secteurs dominants locaux : ${kbFacts.secteursDominants.slice(0, 5).join(", ")}`
      : "";

  const ecosystemBlock =
    kbFacts.ecosystemActeurs.length > 0
      ? `Tissu économique local (exemples génériques, ne pas citer en tant que clients) :\n${kbFacts.ecosystemActeurs
          .slice(0, 3)
          .map((a) => `- ${a}`)
          .join("\n")}`
      : "";

  const reseauxBlock =
    kbFacts.reseauxConsulaires.length > 0
      ? `Réseaux consulaires : ${kbFacts.reseauxConsulaires.slice(0, 2).join(", ")}`
      : "";

  return `
=== ANCRAGE LOCAL OBLIGATOIRE — ${ville.toUpperCase()} ===

Ville : ${kbFacts.villeNom}${kbFacts.departement ? ` (${kbFacts.departement})` : ""}${kbFacts.region ? ` — ${kbFacts.region}` : ""}

${[economicBlock, secteursBlock, ecosystemBlock, reseauxBlock].filter(Boolean).join("\n\n")}

RÈGLES D'ANCRAGE LOCAL (OBLIGATOIRES — pas optionnelles) :
1. Au moins 1 fait économique local concret de la liste ci-dessus doit apparaître dans le corps du texte (narratif, pas en titre/méta).
2. Le scénario avant/après doit être situé à ${ville}, cohérent avec les secteurs dominants locaux.
3. JAMAIS "dans votre région" — nommer ${ville} explicitement.
4. JAMAIS inventer des données économiques hors de la liste ci-dessus.
5. Réseau consulaire : utiliser ceux de la liste (${kbFacts.reseauxConsulaires.slice(0, 1).join(", ") || "CCI locale"}).
6. 3 à 5 mentions naturelles de ${ville} maximum (ancrage sémantique, pas répétition mécanique).
`.trim();
}
