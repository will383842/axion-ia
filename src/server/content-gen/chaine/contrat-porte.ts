/**
 * Contrat d'interface entre la chaîne éditoriale IA et la porte qualité (C4, § 8
 * de `CONCEPTION-CHAINE-EDITORIALE-IA.md`).
 *
 * Types et fonctions PURES : la porte (`evaluerPorte`) n'est pas écrite ici, et
 * rien n'est branché. Ce fichier fixe ce que la chaîne lui envoie, ce qu'elle
 * rend, comment un verdict devient des refus enregistrables, et la décision qui
 * suit (réécriture ciblée, abandon, report, relecture humaine).
 *
 * Les noms de critères (B01…B17, W01…W10) et de verdicts sont ceux de la porte :
 * la chaîne ne les renomme pas.
 */

import {
  CRITERES_BLOQUANTS,
  codePourCritere,
  type CodeRefus,
  type CritereBloquant,
} from "./codes-refus";

// ─── Constantes (valeurs de départ des conceptions) ──────────────────────────

/** Note minimale pour publier (relevée à 90 par la porte si l'indexation est faible). */
export const SEUIL_PUBLICATION_DEPART = 85;
/** Sous cette note, le verdict est `bloque`. */
export const SEUIL_BLOQUE = 70;
/** Réécritures ciblées au plus par contenu (3 passages au total). */
export const MAX_REECRITURES = 2;
/** Plafond de coût par contenu lancé, en dollars. Même compteur que la chaîne. */
export const PLAFOND_COUT_USD = 3;

export const VERDICTS_PORTE = ["publiable", "a_corriger", "bloque"] as const;
export type VerdictPorte = (typeof VERDICTS_PORTE)[number];

export const AVERTISSEMENTS = [
  "W01",
  "W02",
  "W03",
  "W04",
  "W05",
  "W06",
  "W07",
  "W08",
  "W09",
  "W10",
] as const;
export type Avertissement = (typeof AVERTISSEMENTS)[number];

export type IdCritere = CritereBloquant | Avertissement;

export function estCritereBloquant(valeur: unknown): valeur is CritereBloquant {
  return typeof valeur === "string" && (CRITERES_BLOQUANTS as readonly string[]).includes(valeur);
}

/** Classement unique des bloquants (§ 5 de la porte). */
export type ClasseCritere = "dur" | "corrigeable" | "derogeable" | "report";

export const CLASSE_CRITERE: Readonly<Record<CritereBloquant, ClasseCritere>> = {
  B01: "dur",
  B02: "dur",
  B03: "dur",
  B04: "dur",
  B05: "derogeable",
  B06: "derogeable",
  B07: "derogeable",
  B08: "corrigeable",
  B09: "dur",
  B10: "corrigeable",
  B11: "corrigeable",
  B12: "dur",
  B13: "corrigeable",
  B14: "dur",
  B15: "dur",
  B16: "corrigeable",
  B17: "report",
};

// ─── Appel de la porte (chaîne → porte) ──────────────────────────────────────

/** Un fait du dossier de preuves (R3), tel que transmis à la porte. */
export interface FaitPreuve {
  readonly enonce: string;
  readonly extrait: string;
  readonly url: string;
  readonly editeur: string;
  /** Date de publication de la source, ISO 8601. */
  readonly datePublication: string;
}

export interface BriefPorte {
  /** Requête principale normalisée (une requête = une URL). */
  readonly requetePrincipale: string;
  readonly intention: "information" | "comparaison" | "decision";
}

/** Ce que la chaîne envoie à la porte, une fois par contenu final (R8). */
export interface EntreePorte {
  readonly contenuId: string;
  readonly titre: string;
  readonly metaDescription: string;
  readonly corps: string;
  readonly dossierPreuves: readonly FaitPreuve[];
  readonly brief: BriefPorte;
  /**
   * Réécritures déjà faites : l'UNIQUE compteur du cycle (même compteur que la
   * porte, § 5.1). La tentative en cours vaut `reecrituresFaites + 1`.
   */
  readonly reecrituresFaites: number;
}

// ─── Réponse de la porte (porte → chaîne) ────────────────────────────────────

/** `non_evalue` : source indisponible. Pour un bloquant, cela bloque (échec fermé). */
export type EtatCritere = "ok" | "echec" | "non_evalue";

export interface ResultatCritere {
  readonly id: IdCritere;
  readonly etat: EtatCritere;
  /** Preuve enregistrée (extrait, mesure). */
  readonly preuve: string;
  /** Raison en français simple. */
  readonly raison: string;
  /** Section en cause : sans elle, la cause n'est pas localisable. */
  readonly section?: string;
  /** Précision de cause permise par `CORRESPONDANCE_BNN` (ex. B11 → longueur). */
  readonly precision?: CodeRefus;
}

export interface SortiePorte {
  readonly versionPorte: string;
  readonly verdict: VerdictPorte;
  /** Note sur 100. */
  readonly note: number;
  readonly criteres: readonly ResultatCritere[];
}

/** L'appel peut échouer : la chaîne ne publie alors jamais (échec fermé). */
export type ResultatAppelPorte =
  | { readonly etat: "ok"; readonly sortie: SortiePorte }
  | { readonly etat: "erreur"; readonly message: string };

/** Une note valide est un nombre fini de 0 à 100. */
export function noteValide(note: number): boolean {
  return Number.isFinite(note) && note >= 0 && note <= 100;
}

/** Une section n'est localisée que si elle est non vide. */
function sectionLocalisee(section: string | undefined): section is string {
  return section !== undefined && section.trim() !== "";
}

/** Numéro de la tentative en cours (1 = premier passage), d'après l'unique compteur. */
export function tentativeEnCours(reecrituresFaites: number): number {
  return reecrituresFaites + 1;
}

interface DefautBloquant {
  readonly id: CritereBloquant;
  readonly etat: "echec" | "non_evalue";
  /** Absent quand la porte n'a rendu aucun résultat pour ce critère. */
  readonly resultat?: ResultatCritere;
}

/**
 * Bloquants qui ne sont pas « ok », dans l'ordre B01…B17. Un bloquant ABSENT de
 * la sortie vaut « non évalué » (échec fermé), jamais « ok ». Si un critère est
 * répété, le pire état l'emporte.
 */
function defautsBloquants(sortie: SortiePorte): DefautBloquant[] {
  const parId = new Map<IdCritere, ResultatCritere>();
  for (const c of sortie.criteres) {
    const avant = parId.get(c.id);
    const rang = (e: EtatCritere) => (e === "ok" ? 0 : e === "non_evalue" ? 1 : 2);
    if (!avant || rang(c.etat) > rang(avant.etat)) parId.set(c.id, c);
  }
  const defauts: DefautBloquant[] = [];
  for (const id of CRITERES_BLOQUANTS) {
    const r = parId.get(id);
    if (!r) defauts.push({ id, etat: "non_evalue" });
    else if (r.etat !== "ok") defauts.push({ id, etat: r.etat, resultat: r });
  }
  return defauts;
}

/**
 * Seul chemin vers la publication : appel réussi, verdict `publiable`, note
 * valide, et les 17 bloquants présents et « ok » (B17 compris). Tout le reste
 * est refusé : un critère manquant n'est pas un critère réussi.
 */
export function publicationAutorisee(resultat: ResultatAppelPorte): boolean {
  if (resultat.etat !== "ok") return false;
  const { sortie } = resultat;
  if (!noteValide(sortie.note)) return false;
  return (
    sortie.verdict === "publiable" &&
    sortie.note >= SEUIL_PUBLICATION_DEPART &&
    defautsBloquants(sortie).length === 0
  );
}

// ─── Enregistrement des refus (porte → ContenuRefus) ─────────────────────────

/** Une ligne de refus, prête à être écrite par `ContenuRefus` (§ 7.1). */
export interface RefusEnregistrable {
  readonly role: "porte";
  readonly contenuId: string;
  readonly code: CodeRefus;
  /** Critère exact (Bnn) : distingue B03 de B04 malgré un code commun. Absent si le refus tient à la note seule. */
  readonly critere?: CritereBloquant;
  readonly raison: string;
  readonly preuve: string;
  readonly section?: string;
  readonly tentative: number;
  readonly versionPorte: string;
  readonly coutUsd: number;
  readonly versionPrompt?: string;
  readonly versionBrief?: string;
}

export interface ContexteRefus {
  readonly contenuId: string;
  /** L'unique compteur du cycle ; la tentative enregistrée vaut `reecrituresFaites + 1`. */
  readonly reecrituresFaites: number;
  /** Coût déjà dépensé sur ce contenu. */
  readonly coutUsd: number;
  readonly versionPrompt?: string;
  readonly versionBrief?: string;
}

/**
 * Lignes de refus d'un verdict :
 * - une par bloquant EN ÉCHEC (B17 exclu : c'est un report) ;
 * - un bloquant « non évalué » n'est PAS un refus (c'est une panne de source :
 *   elle ne doit pas fausser les statistiques de refus) ;
 * - note invalide : aucune ligne (panne, mise en attente) ;
 * - si le verdict n'est pas publiable alors qu'aucun refus n'a été produit
 *   (note sous le seuil, ou B17 seul avec une note sous 70), une ligne `autre` sans critère, pour que ce refus ne
 *   se perde pas ;
 * - les avertissements ne sont jamais des refus.
 */
export function refusDepuisVerdict(sortie: SortiePorte, ctx: ContexteRefus): RefusEnregistrable[] {
  const base = {
    role: "porte" as const,
    contenuId: ctx.contenuId,
    tentative: tentativeEnCours(ctx.reecrituresFaites),
    versionPorte: sortie.versionPorte,
    coutUsd: ctx.coutUsd,
    ...(ctx.versionPrompt !== undefined ? { versionPrompt: ctx.versionPrompt } : {}),
    ...(ctx.versionBrief !== undefined ? { versionBrief: ctx.versionBrief } : {}),
  };
  // Note invalide : panne de la porte, pas faute du contenu (action : mise en attente).
  if (!noteValide(sortie.note)) return [];
  const defauts = defautsBloquants(sortie);
  const refus: RefusEnregistrable[] = [];
  for (const d of defauts) {
    if (d.etat !== "echec" || !d.resultat || CLASSE_CRITERE[d.id] === "report") continue;
    refus.push({
      ...base,
      code: codePourCritere(d.id, d.resultat.precision),
      critere: d.id,
      raison: d.resultat.raison,
      preuve: d.resultat.preuve,
      ...(d.resultat.section !== undefined ? { section: d.resultat.section } : {}),
    });
  }
  const nonEvalueHorsB17 = defauts.some((d) => d.etat === "non_evalue" && d.id !== "B17");
  const report =
    defauts.length > 0 && defauts.every((d) => d.id === "B17") && sortie.note >= SEUIL_BLOQUE;
  if (sortie.verdict !== "publiable" && refus.length === 0 && !nonEvalueHorsB17 && !report) {
    refus.push({
      ...base,
      code: "autre",
      raison: `Note de ${sortie.note} sur 100, sous le seuil de publication`,
      preuve: "",
    });
  }
  return refus;
}

// ─── Décision après verdict (cycle du § 4) ───────────────────────────────────

export interface CorrectionLocalisee {
  readonly critere: IdCritere;
  readonly section: string;
  readonly code: CodeRefus;
}

export interface EtatCycle {
  readonly reecrituresFaites: number;
  readonly coutUsd: number;
}

export type ActionApresVerdict =
  | { readonly action: "relecture_humaine" }
  | { readonly action: "reporter" }
  /** Source indisponible ou note invalide : on ne publie pas, on ne détruit pas, on ne compte pas de refus. */
  | { readonly action: "mettre_en_attente"; readonly criteres: readonly CritereBloquant[] }
  /** Bloquant dérogeable seul (B05, B06, B07) : un humain tranche (dérogation motivée, fusion ou abandon). */
  | { readonly action: "derogation_ou_fusion"; readonly criteres: readonly CritereBloquant[] }
  | { readonly action: "reecrire"; readonly corrections: readonly CorrectionLocalisee[] }
  | { readonly action: "abandonner"; readonly code: CodeRefus };

/**
 * Ce que fait la chaîne d'un verdict. Ordre des règles :
 * 1. note invalide → mise en attente ;
 * 2. B17 seul en défaut, note ≥ 70 → report (ni réécriture ni abandon) ;
 * 3. publiable et sans défaut → relecture humaine (jamais de publication directe) ;
 * 4. bloquant (hors B17) non évalué ou absent, sans échec → mise en attente,
 *    sauf B04 seul : relecture humaine (§ 5 de la porte) ;
 * 5. seuls des dérogeables en échec → `derogation_ou_fusion` (avant le plafond :
 *    une dérogation ne consomme pas de réécriture) ;
 * 6. plafond de réécritures ou de coût atteint, ou compteur invalide → abandon
 *    `plafond_atteint` ;
 * 7. échec dur ou corrigeable sans section non vide → abandon (non localisable) ;
 * 8. sinon réécriture ciblée des sections en cause (échecs bloquants non
 *    dérogeables) ; sans aucun bloquant en échec (note basse), les corrections
 *    viennent des avertissements localisés, à défaut → abandon `autre`.
 */
export function actionApresVerdict(sortie: SortiePorte, etat: EtatCycle): ActionApresVerdict {
  const defauts = defautsBloquants(sortie);
  if (!noteValide(sortie.note)) {
    return { action: "mettre_en_attente", criteres: defauts.map((d) => d.id) };
  }
  if (defauts.length > 0 && defauts.every((d) => d.id === "B17") && sortie.note >= SEUIL_BLOQUE) {
    return { action: "reporter" };
  }
  if (sortie.verdict === "publiable" && defauts.length === 0) {
    return { action: "relecture_humaine" };
  }
  const echecs = defauts.filter(
    (d): d is DefautBloquant & { resultat: ResultatCritere } =>
      d.etat === "echec" && d.resultat !== undefined && CLASSE_CRITERE[d.id] !== "report",
  );
  const nonEvalues = defauts.filter((d) => d.etat === "non_evalue" && d.id !== "B17");
  if (echecs.length === 0 && nonEvalues.length > 0) {
    // § 5 de la porte : « B04 non évalué = relecture humaine » (liste réglementaire pas encore activée).
    // Cette relecture est un autre chemin que `publicationAutorisee` (qui exige B04 « ok »).
    if (nonEvalues.every((d) => d.id === "B04")) return { action: "relecture_humaine" };
    return { action: "mettre_en_attente", criteres: nonEvalues.map((d) => d.id) };
  }
  const aCorriger = echecs.filter((d) => CLASSE_CRITERE[d.id] !== "derogeable");
  // Une dérogation ne consomme aucune réécriture : elle passe avant le plafond.
  if (echecs.length > 0 && aCorriger.length === 0) {
    return { action: "derogation_ou_fusion", criteres: echecs.map((d) => d.id) };
  }
  // Compteurs corrompus (NaN, négatif) : plafond atteint, jamais « illimité » (échec fermé).
  const compteurOk =
    Number.isInteger(etat.reecrituresFaites) &&
    etat.reecrituresFaites >= 0 &&
    Number.isFinite(etat.coutUsd) &&
    etat.coutUsd >= 0;
  if (
    !compteurOk ||
    etat.reecrituresFaites >= MAX_REECRITURES ||
    etat.coutUsd >= PLAFOND_COUT_USD
  ) {
    return { action: "abandonner", code: "plafond_atteint" };
  }
  const sansSection = aCorriger.find((d) => !sectionLocalisee(d.resultat.section));
  if (sansSection) {
    return {
      action: "abandonner",
      code: codePourCritere(sansSection.id, sansSection.resultat.precision),
    };
  }
  if (aCorriger.length > 0) {
    return {
      action: "reecrire",
      corrections: aCorriger.map((d) => ({
        critere: d.id,
        section: d.resultat.section as string,
        code: codePourCritere(d.id, d.resultat.precision),
      })),
    };
  }
  const avertissements = sortie.criteres.filter(
    (c): c is ResultatCritere & { section: string } =>
      !estCritereBloquant(c.id) && c.etat === "echec" && sectionLocalisee(c.section),
  );
  if (avertissements.length === 0) return { action: "abandonner", code: "autre" };
  return {
    action: "reecrire",
    corrections: avertissements.map((c) => ({
      critere: c.id,
      section: c.section,
      code: "style" as const,
    })),
  };
}
