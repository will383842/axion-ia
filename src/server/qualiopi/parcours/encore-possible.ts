/**
 * 🔴 ADR 0060 × L3 — « Encore possible » sur un dossier CLOS : UNE liste. Module PUR.
 *
 * ## Le défaut (relecture du lot L3, 30/09/2026)
 *
 * Deux listes portaient ce titre sur la fiche d'un dossier clos : le bandeau
 * du cadre commun (pièces à signer, exemplaires, questionnaires à froid,
 * factures — des comptages en base) et le bloc « Clôture du dossier » (les
 * étapes du parcours encore dues). Deux sources, deux vérités : l'une pouvait
 * dire « rien n'est en attente » pendant que l'autre listait une relance.
 *
 * ## La règle
 *
 * La liste est construite ICI, une fois, et rendue par le bandeau seul — en
 * tête de la fiche ET de ses quatre sous-pages. Elle réunit :
 *
 *  - les étapes du parcours encore dues dont le geste reste permis sur un
 *    dossier clos (`etapeBloqueeParLeVerrou`) — la même lecture que la
 *    checklist, donc aucune contradiction possible avec elle ;
 *  - ce que le parcours ne compte pas : les pièces HORS convention qui
 *    attendent une signature (lettre de mission, relevé…), les exemplaires
 *    signés à remettre, l'absence de facture.
 *
 * Chaque lien mène à la section DÉPLOYÉE : `hrefEtape` pour une étape, et
 * l'onglet « Clôturée » (celui d'un dossier clos, qui montre le bloc
 * Documents) pour le reste — jamais une ancre nue qui atterrirait dans un
 * bloc replié.
 */

import { hrefEtape, hrefFiche } from "./cible-etape";
import { etapeBloqueeParLeVerrou } from "./etape-dossier-clos";
import { TYPES_CONVENTION, type EtapeParcours } from "./session-parcours";

/** Un geste encore ouvert ET dû sur un dossier clos, avec l'endroit où le faire. */
export interface GesteEncorePossible {
  readonly libelle: string;
  readonly href: string;
}

export interface EntreeEncorePossible {
  readonly sessionId: string;
  /** Préfixe de la liste des sessions, p. ex. `/fr/admin/qualiopi/sessions`. */
  readonly prefixeSessions: string;
  /**
   * Les étapes du parcours, `null` quand le parcours n'a pas pu être lu : on
   * retombe alors sur le seul comptage des questionnaires à froid, pour ne
   * pas taire une relance possible.
   */
  readonly etapes: ReadonlyArray<EtapeParcours> | null;
  /** Types des pièces vivantes dont une signature attend encore. */
  readonly piecesASigner: ReadonlyArray<{ readonly type: string }>;
  readonly exemplairesARemettre: number;
  /** Questionnaires à froid sans réponse — lu seulement si `etapes` est `null`. */
  readonly froidSansReponse: number;
  readonly factures: number;
}

const ETAPES_DE_SIGNATURE = new Set(["convention_signee", "convention_contresignee"]);

function pluriel(n: number, un: string, plusieurs: string): string {
  return `${n} ${n > 1 ? plusieurs : un}`;
}

/**
 * La liste « Encore possible » d'un dossier CLOS (verrou actif). À n'appeler
 * que dans ce cas : le filtre du verrou y est toujours appliqué.
 */
export function gestesEncorePossibles(entree: EntreeEncorePossible): GesteEncorePossible[] {
  const { sessionId, prefixeSessions: p } = entree;
  const out: GesteEncorePossible[] = [];

  const dues = (entree.etapes ?? []).filter(
    (e) => e.etat !== "fait" && e.etat !== "sans_objet" && !etapeBloqueeParLeVerrou(e, true),
  );
  for (const e of dues) {
    const avancement = e.avancement ? ` (${e.avancement.fait}/${e.avancement.total})` : "";
    out.push({
      libelle: `${e.libelle}${avancement} — ${e.mention}`,
      href: hrefEtape(sessionId, e, p),
    });
  }

  // Les conventions ont déjà leur ligne quand une étape de signature est due :
  // les recompter ici ferait deux lignes pour une même pièce.
  const conventionsDejaListees = dues.some((e) => ETAPES_DE_SIGNATURE.has(e.cle));
  const aSigner = entree.piecesASigner.filter(
    (d) => !conventionsDejaListees || !(TYPES_CONVENTION as ReadonlyArray<string>).includes(d.type),
  ).length;
  if (aSigner > 0) {
    out.push({
      libelle: `${pluriel(aSigner, "pièce attend", "pièces attendent")} encore une signature ou un contreseing`,
      href: hrefFiche(sessionId, "cloturee", "documents", p),
    });
  }
  if (entree.exemplairesARemettre > 0) {
    out.push({
      libelle: `${pluriel(entree.exemplairesARemettre, "exemplaire signé", "exemplaires signés")} à remettre`,
      href: hrefFiche(sessionId, "cloturee", "documents", p),
    });
  }
  if (entree.etapes === null && entree.froidSansReponse > 0) {
    out.push({
      libelle: `${pluriel(entree.froidSansReponse, "questionnaire à froid", "questionnaires à froid")} en attente de réponse du stagiaire`,
      href: hrefFiche(sessionId, "apres", "questionnaires", p),
    });
  }
  if (entree.factures === 0) {
    out.push({
      libelle: "Aucune facture émise",
      href: `${p}/${sessionId}/financement#facturation`,
    });
  }
  return out;
}

/**
 * 🔴 QUAL-FIL-01 — les MANQUES FIGÉS d'un dossier clos : les étapes encore
 * dues dont le geste est verrouillé (évaluation finale, satisfaction à chaud…).
 *
 * Sans cette liste, le bandeau d'un dossier clos disait « Encore possible :
 * rien n'est en attente » et laissait croire le dossier complet, alors que la
 * checklist, plus bas, montrait des étapes dues mais bloquées. La source est
 * la même que la checklist (`etapeBloqueeParLeVerrou`), et le filtre est
 * l'EXACT complément de celui de `gestesEncorePossibles` : une étape due
 * figure dans l'une OU l'autre liste, jamais dans les deux.
 *
 * À n'appeler que sur un dossier clos, verrou actif.
 */
export function manquesFigesALaCloture(etapes: ReadonlyArray<EtapeParcours> | null): string[] {
  return (etapes ?? [])
    .filter((e) => etapeBloqueeParLeVerrou(e, true))
    .map((e) => {
      const avancement = e.avancement ? ` (${e.avancement.fait}/${e.avancement.total})` : "";
      return `${e.libelle}${avancement}`;
    });
}
