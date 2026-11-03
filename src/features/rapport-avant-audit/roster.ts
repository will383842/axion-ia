/**
 * Le ROSTER des personnes attendues qui n'ont pas répondu (2026-11-02) — module PUR.
 *
 * Construit depuis le suivi personne par personne (`lireSuiviParPersonne`) de chaque
 * questionnaire du lancement. Est « attendue sans réponse » une ligne de l'équipe déclarée (le
 * dirigeant, un collaborateur, un référent) dont l'état est `pas_de_nouvelles`, `ouvert` ou
 * `en_cours` (brouillon non envoyé). Ne sont PAS attendues : une réponse reçue, une réponse mise
 * à l'écart (demande d'effacement : on ne la nomme pas), une personne sans lien prévu, une
 * réponse non rattachée (`non_retrouvee`).
 *
 * Une personne qui a répondu à UN des questionnaires du lancement n'est pas attendue dans un
 * autre (même nom, ignorant la casse). Les doublons sont fusionnés.
 */

import type { LignePersonne, SuiviParPersonne } from "../questionnaire-preaudit/personnes";
import type { PersonneAttendue } from "./executer";

const ETATS_ATTENDUS = new Set(["pas_de_nouvelles", "ouvert", "en_cours"]);

function cleNom(nom: string): string {
  return nom.normalize("NFKC").trim().toLocaleLowerCase("fr");
}

function lignesDe(s: SuiviParPersonne): LignePersonne[] {
  return [s.dirigeant, ...s.collaborateurs, ...s.referents];
}

function nomAffiche(l: LignePersonne): string | null {
  if (l.nom !== null && l.nom.trim() !== "") return l.nom.trim();
  if (l.role === "dirigeant") return "Dirigeant";
  if (l.role === "referent") return "Référent informatique";
  return null;
}

export function rosterAttendusSansReponse(
  suivis: ReadonlyArray<SuiviParPersonne>,
): PersonneAttendue[] {
  const ontRepondu = new Set<string>();
  for (const s of suivis) {
    for (const l of lignesDe(s)) {
      const nom = nomAffiche(l);
      if (nom !== null && (l.etat === "recu" || l.etat === "ecartee")) ontRepondu.add(cleNom(nom));
    }
  }
  const vus = new Map<string, PersonneAttendue>();
  for (const s of suivis) {
    for (const l of lignesDe(s)) {
      if (l.role === "non_retrouvee" || !ETATS_ATTENDUS.has(l.etat)) continue;
      const nom = nomAffiche(l);
      if (nom === null) continue;
      const cle = cleNom(nom);
      if (ontRepondu.has(cle) || vus.has(cle)) continue;
      vus.set(cle, { nom, fonction: l.fonction, service: null });
    }
  }
  return [...vus.values()];
}
