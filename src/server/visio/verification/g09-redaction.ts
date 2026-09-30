/**
 * V2 — VÉRIFICATION DU COMPTE RENDU RÉDIGÉ (G6 et G9, `compte-rendu-et-extraction.md` §4.2).
 *
 *   G9 — RÉDACTION SANS AJOUT : chaque paragraphe cite au moins un fait
 *        VÉRIFIÉ ; chaque nombre, montant, date et nom propre du paragraphe
 *        figure dans l'énoncé, la valeur ou la citation de l'un de SES faits —
 *        y compris dans la rubrique « offres » : aucun prix du catalogue n'est
 *        admis (décision de Will du 29/09, aucun chiffrage) ; aucun
 *        « € » hors des rubriques budget, engagements et offres. Un paragraphe
 *        fautif est RETIRÉ (signal) ; si plus de 20 % des paragraphes sont
 *        retirés, le compte rendu est rejeté et réécrit une fois.
 *   G6 — le statut rédigé de chaque rubrique est celui de la couverture
 *        VÉRIFIÉE (le code l'impose).
 *
 * Module PUR.
 */

import type { CompteRenduV1 } from "../schemas/autres";
import { RUBRIQUES_COUVERTURE, type Paragraphe, type RubriqueCouverture } from "../schemas/communs";
import type { Couverture } from "./g06-couverture";
import { nombresDuTexte } from "./g04-valeurs";

export const PART_MAX_PARAGRAPHES_RETIRES = 0.2;

/** Ce qu'un fait vérifié autorise à écrire. */
export interface FaitPourRedaction {
  readonly ref: string;
  readonly enonce: string;
  readonly citation: string | null;
  /** Valeurs typées mises en texte (montants en euros, quantités, date ISO, texte court…). */
  readonly valeurs: readonly string[];
}

const RUBRIQUES_AVEC_EUROS: ReadonlySet<RubriqueCouverture> = new Set([
  "budget_financement",
  "engagements",
  "offres",
]);

/** Mots à majuscule qui ne sont pas des noms propres (début de phrase, titres). */
const MAJUSCULES_ADMISES = new Set([
  "Le",
  "La",
  "Les",
  "L",
  "Un",
  "Une",
  "Des",
  "Du",
  "De",
  "Il",
  "Elle",
  "Ils",
  "Elles",
  "Ce",
  "Cette",
  "Ces",
  "Son",
  "Sa",
  "Ses",
  "Leur",
  "Leurs",
  "Aucun",
  "Aucune",
  "Rien",
  "Non",
  "Hypothèse",
  "Williams",
  "Axion",
  "IA",
  "Le client",
  "En",
  "Pour",
  "Dans",
  "Avec",
  "Sans",
  "Pas",
  "Aucune",
  "Selon",
  "Question",
  "Prochaine",
  "Budget",
  "Échéance",
  "Relance",
]);

function sansAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Les dates écrites (« 15/12 », « 15 décembre », « 2027 »). */
function datesDuTexte(texte: string): string[] {
  const t = sansAccents(texte);
  const trouves = [...t.matchAll(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g)].map((m) => m[0]);
  for (const m of t.matchAll(
    /\b\d{1,2}(?:er)? (?:janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b/g,
  )) {
    trouves.push(m[0]);
  }
  return trouves;
}

function nomsPropres(texte: string): string[] {
  const mots = texte.match(/(?<![.!?]\s)(?<!^)\b[A-ZÉÈÀÂÎÔÛ][\p{L}'-]{2,}\b/gu) ?? [];
  return mots.filter((m) => !MAJUSCULES_ADMISES.has(m));
}

/** Motif de retrait d'un paragraphe, ou `null` s'il est admis. */
export function paragrapheFautif(
  p: Paragraphe,
  rubrique:
    | RubriqueCouverture
    | "en_bref"
    | "ce_qui_a_change"
    | "prochaine_etape_texte"
    | "besoins_detectes",
  faits: ReadonlyMap<string, FaitPourRedaction>,
): string | null {
  const siens = p.faits_refs.map((r) => faits.get(r)).filter((f) => f !== undefined);
  if (siens.length === 0) return "aucun fait vérifié cité";
  const matiere = siens.flatMap((f) => [f.enonce, f.citation ?? "", ...f.valeurs]).join(" \n ");
  const nombresPermis = new Set(nombresDuTexte(matiere));
  for (const n of nombresDuTexte(p.texte)) {
    if (!nombresPermis.has(n)) return `nombre absent des faits (${n})`;
  }
  const matiereSA = sansAccents(matiere);
  for (const d of datesDuTexte(p.texte)) {
    if (!matiereSA.includes(d)) return "date absente des faits";
  }
  for (const nom of nomsPropres(p.texte)) {
    if (!matiereSA.includes(sansAccents(nom))) return "nom absent des faits";
  }
  const rubriqueEuros = RUBRIQUES_COUVERTURE.includes(rubrique as RubriqueCouverture)
    ? RUBRIQUES_AVEC_EUROS.has(rubrique as RubriqueCouverture)
    : false;
  if (/€|\beuros?\b/i.test(p.texte) && !rubriqueEuros) return "montant hors des rubriques d'argent";
  return null;
}

export interface BilanV2 {
  readonly compteRendu: CompteRenduV1;
  readonly paragraphes: number;
  readonly retires: number;
  readonly motifs: readonly string[];
  /** Plus de 20 % retirés : rejeté, à réécrire. */
  readonly rejete: boolean;
}

/** V2 : applique G6 (statuts imposés) et G9 (paragraphes sans ajout). */
export function verifierCompteRendu(
  cr: CompteRenduV1,
  couverture: Couverture,
  faits: ReadonlyMap<string, FaitPourRedaction>,
): BilanV2 {
  let paragraphes = 0;
  let retires = 0;
  const motifs: string[] = [];
  const filtrer = (
    liste: readonly Paragraphe[],
    rubrique: Parameters<typeof paragrapheFautif>[1],
  ): Paragraphe[] =>
    liste.filter((p) => {
      paragraphes += 1;
      const m = paragrapheFautif(p, rubrique, faits);
      if (m !== null) {
        retires += 1;
        motifs.push(`${rubrique} : ${m}`);
        return false;
      }
      return true;
    });

  const rubriques = {} as Record<
    RubriqueCouverture,
    CompteRenduV1["rubriques"][RubriqueCouverture]
  >;
  for (const r of RUBRIQUES_COUVERTURE) {
    const statut = couverture[r].statut;
    rubriques[r] = {
      statut,
      paragraphes: statut === "non_aborde" ? [] : filtrer(cr.rubriques[r].paragraphes, r),
    };
  }
  const besoins = cr.besoins_detectes.filter((b) => {
    paragraphes += 1;
    const m = paragrapheFautif(
      { texte: `${b.hypothese} ${b.question}`, faits_refs: b.faits_refs },
      "besoins_detectes",
      faits,
    );
    if (m !== null) {
      retires += 1;
      motifs.push(`besoins détectés : ${m}`);
      return false;
    }
    return true;
  });
  const prochaine = filtrer([cr.prochaine_etape_texte], "prochaine_etape_texte");
  const compteRendu: CompteRenduV1 = {
    en_bref: filtrer(cr.en_bref, "en_bref"),
    ce_qui_a_change: filtrer(cr.ce_qui_a_change, "ce_qui_a_change"),
    rubriques,
    besoins_detectes: besoins,
    prochaine_etape_texte: prochaine[0] ?? { texte: "Non abordé.", faits_refs: [] },
  };
  return {
    compteRendu,
    paragraphes,
    retires,
    motifs,
    rejete: paragraphes > 0 && retires / paragraphes > PART_MAX_PARAGRAPHES_RETIRES,
  };
}
