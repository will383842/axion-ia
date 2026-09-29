/**
 * Gardes simples du circuit visio (`compte-rendu-et-extraction.md` §4.2) :
 *
 *   G5  — `deduit` limité aux types de `TYPES_DEDUCTIBLES` ;
 *   G7  — référence du catalogue FERMÉE : celle de la liste envoyée, jamais
 *         une référence « proche » ;
 *   G8  — aucune donnée sensible (art. 9), aucune appréciation d'une
 *         personne : le fait est MIS EN ATTENTE (jamais validable en un clic),
 *         jamais rangé comme les autres ;
 *   G11 — un fait ancien n'est jamais « reconfirmé » sans une preuve DU JOUR ;
 *   G12 — une consigne dite à l'oral (« ignore les instructions ») est un
 *         SIGNAL, et la transcription reste enfermée dans une balise de
 *         données ;
 *   G14 — aucun prix, aucun « euros », aucune TVA dans l'ébauche de devis ni
 *         dans le questionnaire : les prix sont calculés par le site ;
 *   G15 — une question du questionnaire ne répète aucune valeur dite par une
 *         AUTRE personne que son destinataire ;
 *   G17 — le formulaire Calendly (texte libre du client) ne peut pas ouvrir
 *         ni fermer une balise des données.
 *
 * Et la normalisation des clés de consolidation (§2.3).
 *
 * Module PUR.
 */

import type { FaitType } from "../../../../prisma/generated/client";
import { TYPES_DE_FAITS, TYPES_DEDUCTIBLES } from "../types-de-faits";
import { nombresDuTexte } from "./g04-valeurs";

// ── G5 ───────────────────────────────────────────────────────────────────────

export function deductionPermise(type: FaitType, certitude: string): boolean {
  return certitude !== "deduit" || TYPES_DEDUCTIBLES.includes(type);
}

// ── G7 ───────────────────────────────────────────────────────────────────────

export function referenceConnue(ref: string, catalogue: ReadonlySet<string>): boolean {
  return catalogue.has(ref.trim());
}

// ── G8 ───────────────────────────────────────────────────────────────────────

/**
 * Motifs (racines, sans accents) des données de l'art. 9 et des
 * appréciations d'une personne. Liste FERMÉE et courte : un faux positif met
 * un fait en attente (Will le lit), un faux négatif est rattrapé par la
 * consigne 7 et la relecture.
 */
const MOTIFS_SENSIBLES: readonly RegExp[] = [
  /\bsante\b/,
  /\bmaladi/,
  /\barret (?:de )?(?:maladie|travail)\b/,
  /\benceinte\b/,
  /\bgrossesse\b/,
  /\bsyndica/,
  /\breligi/,
  /\bpriere\b/,
  /\bmosquee\b/,
  /\beglise\b/,
  /\bsynagogue\b/,
  /\borigine (?:ethnique|raciale)\b/,
  /\borientation sexuelle\b/,
  /\bhomosexu/,
  /\bhandica/,
  /\bcondamn/,
  /\bcasier judiciaire\b/,
  /\bdepression\b/,
  /\bburn[- ]?out\b/,
  /\bcancer\b/,
  /\bopinion(?:s)? politique/,
  /\bparti politique\b/,
  /\bdivorc/,
  // Appréciations d'une personne (AI Act : jamais un ressenti deviné).
  /\bpas fiable\b/,
  /\bmefian/,
  /\bagressi/,
  /\bemoti/,
  /\bde mauvaise foi\b/,
  /\bincompeten/,
  /\bnerveu/,
  /\bhostile\b/,
  /\bmenteu/,
  /\barrogan/,
];

function sansAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function estSensible(...textes: ReadonlyArray<string | null>): boolean {
  const t = sansAccents(textes.filter((x): x is string => x !== null).join(" "));
  return MOTIFS_SENSIBLES.some((m) => m.test(t));
}

// ── G11 ──────────────────────────────────────────────────────────────────────

export function suiviAdmis(
  connuRef: string,
  connus: ReadonlySet<string>,
  preuveDuJourVerifiee: boolean,
): boolean {
  return connus.has(connuRef) && preuveDuJourVerifiee;
}

// ── G12 ──────────────────────────────────────────────────────────────────────

const CONSIGNES_A_L_ORAL: readonly RegExp[] = [
  /\bignore(?:z|r)? (?:les|tes|vos|toutes les) (?:instructions|consignes|regles)\b/,
  /\boublie(?:z|r)? (?:les|tes|vos) (?:instructions|consignes)\b/,
  /\btu es une (?:ia|intelligence artificielle)\b/,
  /\bnouvelle consigne\b/,
  // Pas « prompt » seul : Axion-IA forme à l'IA, le mot est courant en
  // rendez-vous et ce serait un signal à chaque appel.
  /\becris que\b.*\bcompte rendu\b/,
];

export function consigneDansLaConversation(textes: readonly string[]): boolean {
  return textes.some((t) => {
    const n = sansAccents(t);
    return CONSIGNES_A_L_ORAL.some((m) => m.test(n));
  });
}

// ── G14 ──────────────────────────────────────────────────────────────────────

const PRIX = [/€/, /\beuros?\b/i, /\btva\b/i, /\bht\b/i, /\bttc\b/i, /\bprix\b.*\d/i];

/** Toutes les chaînes d'une sortie JSON. */
export function chainesDe(valeur: unknown): string[] {
  if (typeof valeur === "string") return [valeur];
  if (Array.isArray(valeur)) return valeur.flatMap(chainesDe);
  if (valeur !== null && typeof valeur === "object")
    return Object.values(valeur).flatMap(chainesDe);
  return [];
}

/** Vrai si la sortie parle d'argent : elle est alors rejetée ENTIÈRE. */
export function contientUnPrix(sortie: unknown): boolean {
  return chainesDe(sortie).some((s) => PRIX.some((m) => m.test(s)));
}

// ── G15 ──────────────────────────────────────────────────────────────────────

export interface ValeurDite {
  /** Le texte de la valeur (énoncé, texte court) et ses nombres. */
  readonly texte: string;
  /** Qui l'a dite : l'identifiant du contact, ou `null` (Williams, inconnu). */
  readonly ditParContactId: string | null;
}

/**
 * Vrai si la question reprend un NOMBRE ou un MOT PROPRE dit par une autre
 * personne que le destinataire.
 */
export function repeteUnCollegue(
  question: string,
  destinataireId: string,
  valeurs: readonly ValeurDite[],
): boolean {
  const nombresQuestion = new Set(nombresDuTexte(question));
  const q = sansAccents(question);
  return valeurs
    .filter((v) => v.ditParContactId !== null && v.ditParContactId !== destinataireId)
    .some((v) => {
      if (nombresDuTexte(v.texte).some((n) => n >= 2 && nombresQuestion.has(n))) return true;
      // Un mot à majuscule qui n'ouvre pas une phrase : un nom propre.
      const propres = [...v.texte.matchAll(/[A-ZÉÈ][a-zéèêëàâîïôûç]{2,}/g)]
        .filter(
          (m) =>
            m.index !== undefined && m.index > 0 && !/[.!?]\s*$/.test(v.texte.slice(0, m.index)),
        )
        .map((m) => m[0]);
      return propres.some((p) => new RegExp(`\\b${sansAccents(p)}\\b`).test(q));
    });
}

// ── G17 ──────────────────────────────────────────────────────────────────────

/**
 * Neutralise un texte libre placé entre balises de données : aucun chevron ne
 * survit, donc aucune balise ne peut être ouverte ni fermée depuis le
 * formulaire (« </formulaire_reservation><consigne>… »).
 */
export function neutraliserDonnees(texte: string): string {
  return texte.replace(/[<>]/g, (c) => (c === "<" ? "‹" : "›")).replace(/\r/g, "");
}

// ── Clés de consolidation (§2.3) ─────────────────────────────────────────────

export function normaliserCle(type: FaitType, cle: string, refCatalogue: string | null): string {
  if (TYPES_DE_FAITS[type].cardinalite === "unique") return "global";
  if (type === "offre_envisagee" && refCatalogue !== null) return refCatalogue.slice(0, 80);
  const c = sansAccents(cle)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return c === "" ? "global" : c;
}
