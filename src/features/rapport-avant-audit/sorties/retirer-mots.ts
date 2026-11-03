/**
 * Retrait des passages qui portent un mot interdit, AVANT le rendu du PDF client (2026-11-02).
 *
 * Module PUR et SANS `@react-pdf` : l'aperçu de la fiche (« ce que le PDF retirerait ») l'appelle
 * à chaque affichage, sans charger le moteur de rendu ni produire de PDF. `pdf-client.tsx` le
 * ré-exporte pour ses anciens importeurs.
 */

import { motsInterditsDans } from "../mots-interdits";
import type { VueClient } from "./filtre-client";

/** Un passage retiré du PDF client parce qu'il porte un mot interdit : Will le relit. */
export interface RetraitRelecture {
  /** Où il était : « besoin », « citation », « élément », « piste »… */
  readonly ou: string;
  readonly texte: string;
  readonly mots: readonly string[];
}

function normaliserTexte(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Mots interdits d'un passage destiné au client. « certifié » ne vise qu'Axion IA : un passage
 * qui ne parle pas d'Axion (« la certification ISO de vos ateliers ») n'est pas retiré pour ça.
 */
function interditsClient(texte: string): string[] {
  const mots = motsInterditsDans(texte);
  if (/\baxion\b/.test(normaliserTexte(texte))) return mots;
  return mots.filter((m) => m !== "« certifié »");
}

/**
 * Retire de la vue client, ÉLÉMENT PAR ÉLÉMENT, tout passage qui porte un mot interdit, et le note
 * pour relecture. On ne rejette pas tout le document pour un passage. PUR.
 */
export function retirerMotsInterdits(vue: VueClient): {
  vue: VueClient;
  retiresPourRelecture: RetraitRelecture[];
} {
  const retires: RetraitRelecture[] = [];
  /** Vrai si le passage peut rester ; sinon il est noté pour relecture. */
  const garde = (ou: string, ...textes: string[]): boolean => {
    const texte = textes.filter((t) => t.length > 0).join(" — ");
    const mots = interditsClient(texte);
    if (mots.length === 0) return true;
    retires.push({ ou, texte, mots });
    return false;
  };

  const besoins = vue.besoins
    .filter((b) => garde("besoin", b.enonce))
    .map((b) => ({ ...b, motsDesEquipes: b.motsDesEquipes.filter((c) => garde("citation", c)) }));
  const besoinsGardes = new Set(besoins.map((b) => b.id));

  const comprehension = vue.comprehension
    .map((s) => ({
      ...s,
      elements: s.elements.filter((e) => garde("élément", e.libelle, e.valeur)),
    }))
    .filter((s) => s.elements.length > 0);

  const lecture = garde("lecture financière", vue.evolution.lecture) ? vue.evolution.lecture : "";

  const difficultesParService = vue.difficultesParService
    .filter((d) => garde("service", d.service))
    .map((d) => ({
      ...d,
      difficultes: d.difficultes.filter((x) => garde("difficulté", x)),
      tachesRepetitives: d.tachesRepetitives.filter((x) => garde("tâche répétitive", x)),
    }))
    .filter((d) => d.difficultes.length + d.tachesRepetitives.length > 0);

  const pistes = vue.pistes
    .filter((p) => garde("piste", p.titre, p.description))
    .map((p, i) => ({
      ...p,
      besoinsServis: p.besoinsServis.filter((b) => besoinsGardes.has(b.id)),
      rang: i + 1,
    }));

  const pistesHorsDemande = vue.pistesHorsDemande.filter((p) =>
    garde("piste hors demande", p.titre, p.description),
  );

  const preparationVenue = vue.preparationVenue
    .filter((q) => garde("question de venue", q.question))
    .map((q) => ({
      ...q,
      besoin: q.besoin !== null && interditsClient(q.besoin).length === 0 ? q.besoin : null,
    }));

  const sources = vue.sources.filter((s) => garde("source", s.reference, s.url ?? ""));

  return {
    vue: {
      ...vue,
      besoins,
      comprehension,
      evolution: { ...vue.evolution, lecture },
      difficultesParService,
      pistes,
      pistesHorsDemande,
      preparationVenue,
      sources,
    },
    retiresPourRelecture: retires,
  };
}
