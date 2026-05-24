/**
 * Knowledge Graph Wikidata sameAs triangulation (Sprint v7 Phase 10).
 *
 * Renforce le signal d'autorité Person/Organization en ajoutant des liens
 * `sameAs` vers Wikidata + sources externes croisées. Permet à Google
 * Knowledge Panel + AI Overviews + Perplexity de relier l'entité Axion-IA
 * (et la persona Manon) à une identité unique cross-platform.
 *
 * Pattern : on lit les Q-numbers Wikidata depuis env vars Coolify :
 *   - WIKIDATA_QNUMBER_AXIONIA  = QXXXXXXX (org)
 *   - WIKIDATA_QNUMBER_MANON    = QYYYYYYY (persona)
 *
 * Fallback safe (cf. brief Session 8 ⚠️ Phase 10) : si env vars absents,
 * `sameAs` retourne array vide non-bloquant. Aucune erreur build/runtime.
 *
 * Usage côté JSON-LD :
 *   const sameAs = buildOrganizationSameAs();
 *   const orgSchema = { ..., ...(sameAs.length > 0 ? { sameAs } : {}) };
 */

const WIKIDATA_BASE_URL = "https://www.wikidata.org/wiki";

/**
 * Construit le tableau `sameAs` pour le schema Organization Axion-IA.
 * Inclut Wikidata si Q-number configuré + sources externes statiques
 * (LinkedIn, GitHub, etc.) qui peuvent être ajoutées en dur ici.
 */
export function buildOrganizationSameAs(): ReadonlyArray<string> {
  const sameAs: string[] = [];
  const qNumber = process.env.WIKIDATA_QNUMBER_AXIONIA;
  if (qNumber && /^Q\d+$/.test(qNumber)) {
    sameAs.push(`${WIKIDATA_BASE_URL}/${qNumber}`);
  }
  // Sources externes statiques — ajouter ici quand les profils existent
  // (LinkedIn entreprise, GitHub org, etc.). Pour l'instant : Wikidata only.
  return sameAs;
}

/**
 * Construit le tableau `sameAs` pour le schema Person Manon.
 * Note : Manon est une persona IA-générée (AI Act art. 50 disclosed).
 * L'identifiant Wikidata éventuel doit explicitement mentionner ce statut
 * dans la description Wikidata (pas une vraie personne physique).
 */
export function buildPersonManonSameAs(): ReadonlyArray<string> {
  const sameAs: string[] = [];
  const qNumber = process.env.WIKIDATA_QNUMBER_MANON;
  if (qNumber && /^Q\d+$/.test(qNumber)) {
    sameAs.push(`${WIKIDATA_BASE_URL}/${qNumber}`);
  }
  return sameAs;
}

/**
 * Helper combiné : retourne objet `{ sameAs: [...] }` ou `{}` si vide.
 * Évite d'ajouter une key vide dans le JSON-LD (signal sale).
 */
export function withSameAs(source: "axionia" | "manon"): { sameAs?: ReadonlyArray<string> } {
  const sameAs = source === "axionia" ? buildOrganizationSameAs() : buildPersonManonSameAs();
  return sameAs.length > 0 ? { sameAs } : {};
}

/**
 * Status helper pour admin UI : indique si Wikidata est configuré.
 * Utilisable côté admin `/content-gen/settings` pour visualiser l'état.
 */
export function getWikidataConfigStatus(): {
  readonly axioniaConfigured: boolean;
  readonly manonConfigured: boolean;
  readonly axioniaQNumber: string | null;
  readonly manonQNumber: string | null;
} {
  const axioniaQ = process.env.WIKIDATA_QNUMBER_AXIONIA ?? null;
  const manonQ = process.env.WIKIDATA_QNUMBER_MANON ?? null;
  return {
    axioniaConfigured: !!axioniaQ && /^Q\d+$/.test(axioniaQ),
    manonConfigured: !!manonQ && /^Q\d+$/.test(manonQ),
    axioniaQNumber: axioniaQ,
    manonQNumber: manonQ,
  };
}
