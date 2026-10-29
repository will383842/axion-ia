/**
 * La réponse du questionnaire en une ligne (lot B10, 2026-10-29). PUR : aucune lecture de base,
 * aucune horloge implicite. On COMPTE, on ne montre jamais le contenu d'une réponse ; les prénoms
 * viennent de la liste déclarée par le dirigeant lui-même (comme le suivi par personne).
 */

import {
  collaborateurAttendu,
  referentActif,
  type LignePersonne,
  type SuiviParPersonne,
} from "@/features/questionnaire-preaudit/personnes";

export interface EntreeEnBref {
  readonly attendus: number;
  readonly recus: number;
  /** Prénoms des personnes attendues qui n'ont pas répondu (déjà filtrés : liste du dirigeant). */
  readonly manquants: ReadonlyArray<string>;
  /** Personnes qui manquent mais dont le nom n'est pas montrable à ce lecteur. */
  readonly manquantsSansNom: number;
  /** Le dirigeant n'a pas répondu (à part : il ne figure jamais dans `manquants`). */
  readonly dirigeantManque?: boolean;
}

/** « Paul », « Paul et Léa », « Paul, Léa et Emma ». */
export function enumerer(noms: ReadonlyArray<string>): string {
  if (noms.length <= 1) return noms[0] ?? "";
  return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}

/** « 2 réponses sur 5. Il manque Paul, Léa et Emma. » ; complet : « Toutes les réponses sont arrivées. » */
export function phraseEnBref(e: EntreeEnBref): string {
  const dirigeant = e.dirigeantManque === true ? 1 : 0;
  const nbManquants = e.manquants.length + e.manquantsSansNom + dirigeant;
  if (e.attendus > 0 && e.recus >= e.attendus && nbManquants === 0) {
    return "Toutes les réponses sont arrivées.";
  }
  if (e.attendus === 0) return "Aucune réponse n'est encore attendue.";
  const debut = `${e.recus} réponse${e.recus > 1 ? "s" : ""} sur ${e.attendus}.`;
  if (nbManquants === 0) return debut;
  const morceaux = [...(dirigeant === 1 ? ["le dirigeant"] : []), ...e.manquants];
  if (e.manquantsSansNom > 0) {
    morceaux.push(
      `${e.manquantsSansNom} autre${e.manquantsSansNom > 1 ? "s" : ""} personne${e.manquantsSansNom > 1 ? "s" : ""}`,
    );
  }
  return `${debut} Il manque ${enumerer(morceaux)}.`;
}

/** « À rendre avant le 5 nov. » (jour de Paris) ; `null` si aucune date connue. */
export function phraseDateLimite(expireLe: Date | null): string | null {
  if (expireLe === null) return null;
  const jour = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  }).format(expireLe);
  return `À rendre avant le ${jour}${jour.endsWith(".") ? "" : "."}`;
}

export const PHRASE_RELANCES_AUTOMATIQUES =
  "Les relances automatiques partent au dirigeant (J+2, J+5, J+10).";

/** Le premier mot du nom (« Paul Martin » → « Paul »), ou `null`. */
export function prenomDe(nom: string | null): string | null {
  const mot = (nom ?? "").trim().split(/\s+/)[0] ?? "";
  return mot === "" ? null : mot;
}

/** Vrai quand toutes les réponses attendues sont là : même test que le suivi (`recus >= attendus`). */
export const estComplet = (e: EntreeEnBref): boolean => e.attendus > 0 && e.recus >= e.attendus;

/**
 * Compte à partir du suivi par personne, avec LA règle de `personnes.ts` : les personnes attendues
 * sont le dirigeant, les collaborateurs attendus (`collaborateurAttendu`), et un référent seulement
 * s'il a commencé (`referentActif`). Une ligne `ecartee` (effacement demandé) n'est JAMAIS nommée.
 * Les noms tirés d'un brouillon ne sont jamais utilisés ; ceux de la liste déclarée ou d'une
 * réponse le sont.
 */
export function entreeDepuisSuivi(s: SuiviParPersonne): EntreeEnBref {
  const manque: LignePersonne[] = s.collaborateurs.filter(
    (l) => l.etat !== "ecartee" && l.etat !== "recu" && collaborateurAttendu(l),
  );
  if (referentActif(s.referents) && !s.referents.some((l) => l.etat === "recu")) {
    const r = s.referents.find((l) => l.etat === "en_cours" || l.etat === "ouvert");
    if (r !== undefined) manque.push(r);
  }
  const manquants: string[] = [];
  let sansNom = 0;
  for (const l of manque) {
    const prenom = l.sourceNom === "brouillon" ? null : prenomDe(l.nom);
    if (prenom === null) sansNom += 1;
    else manquants.push(prenom);
  }
  return {
    attendus: s.total.attendus,
    recus: s.total.recus,
    manquants,
    manquantsSansNom: sansNom,
    dirigeantManque: s.dirigeant.etat !== "recu",
  };
}
