/**
 * Le verrou optimiste : une sauvegarde n'écrase pas une version qu'on n'a pas vue.
 *
 * ## Ce qui est gardé
 *
 * `AdminConflictDialog` décrivait ce risque depuis mai 2026 — « Will ouvre la
 * même fiche dans 2 onglets et édite dans les 2. Sans protection : dernier
 * write gagne silencieusement, modifs externes écrasées » — et n'était
 * **branchée nulle part** pendant quatre mois. Le composant existait, la
 * protection non.
 *
 * 🔑 **Ce test garde surtout les DEUX cas où refuser serait pire que le défaut.**
 * Un verrou de concurrence mal réglé ne se manifeste pas par une perte de
 * données : il se manifeste par des sauvegardes refusées sans raison, et il
 * finit par être retiré. Les cas « pas de version attendue » et « version
 * identique » comptent donc autant que le cas du conflit.
 */

import { describe, it, expect } from "vitest";

import {
  CHAMP_FORCER_ECRASEMENT,
  CHAMP_VERSION_ATTENDUE,
  conflitDeVersion,
  ecrasementForce,
  lireVersionAttendue,
  versionPerimee,
} from "../version-attendue";

const T0 = "2026-09-10T10:00:00.000Z";
const T1 = "2026-09-10T10:05:00.000Z";

function formulaire(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

describe("versionPerimee — le cas du conflit", () => {
  it("la base a bougé après le chargement : c'est un conflit", () => {
    expect(versionPerimee(new Date(T1), T0)).toBe(true);
  });

  it("🔑 version IDENTIQUE : ce n'est PAS un conflit — c'est le cas normal", () => {
    expect(
      versionPerimee(new Date(T0), T0),
      "l'éditeur a chargé exactement la version qu'il remplace ; refuser ici bloquerait " +
        "TOUTE sauvegarde et ferait retirer le verrou",
    ).toBe(false);
  });

  it("la base est plus ANCIENNE : pas un conflit (horloges, réplication)", () => {
    expect(versionPerimee(new Date(T0), T1)).toBe(false);
  });
});

describe("versionPerimee — les cas où refuser serait pire que le défaut", () => {
  it("🔑 aucune version attendue : jamais périmé", () => {
    expect(
      versionPerimee(new Date(T1), null),
      "un formulaire qui ne pose pas encore le champ, une création, un appel " +
        "programmatique : aucun n'a de version à comparer. Refuser transformerait une " +
        "protection en panne généralisée.",
    ).toBe(false);
  });

  it("date serveur absente : jamais périmé", () => {
    expect(versionPerimee(null, T0)).toBe(false);
    expect(versionPerimee(undefined, T0)).toBe(false);
  });

  it("date illisible des deux côtés : jamais périmé", () => {
    expect(versionPerimee(new Date("pas-une-date"), T0)).toBe(false);
    expect(versionPerimee(new Date(T1), "pas-une-date")).toBe(false);
  });
});

describe("lireVersionAttendue", () => {
  it("lit une date ISO et la normalise", () => {
    expect(lireVersionAttendue(formulaire({ [CHAMP_VERSION_ATTENDUE]: T0 }))).toBe(T0);
  });

  it("rend null sur un champ absent, vide ou illisible", () => {
    expect(lireVersionAttendue(formulaire({}))).toBeNull();
    expect(lireVersionAttendue(formulaire({ [CHAMP_VERSION_ATTENDUE]: "   " }))).toBeNull();
    expect(lireVersionAttendue(formulaire({ [CHAMP_VERSION_ATTENDUE]: "hier" }))).toBeNull();
  });
});

describe("ecrasementForce — l'écrasement est un choix EXPLICITE", () => {
  it("reconnaît les formes que le navigateur peut envoyer", () => {
    for (const v of ["1", "true", "on"]) {
      expect(ecrasementForce(formulaire({ [CHAMP_FORCER_ECRASEMENT]: v })), v).toBe(true);
    }
  });

  it("🔑 champ ABSENT ou VIDE : pas d'écrasement", () => {
    expect(
      ecrasementForce(formulaire({})),
      "le champ est rendu vide à chaque affichage ; s'il valait `true` par défaut, " +
        "le verrou serait désarmé partout sans que rien ne le dise",
    ).toBe(false);
    expect(ecrasementForce(formulaire({ [CHAMP_FORCER_ECRASEMENT]: "" }))).toBe(false);
    expect(ecrasementForce(formulaire({ [CHAMP_FORCER_ECRASEMENT]: "0" }))).toBe(false);
  });
});

describe("conflitDeVersion — ce que l'écran reçoit", () => {
  it("porte les DEUX dates, en ISO", () => {
    const c = conflitDeVersion(new Date(T1), T0);
    expect(c.conflit).toBe(true);
    expect(c.versionServeur).toBe(T1);
    expect(c.versionLocale).toBe(T0);
  });

  it("🔑 les deux dates diffèrent — sinon le dialogue ne dirait rien à personne", () => {
    const c = conflitDeVersion(new Date(T1), T0);
    expect(
      c.versionServeur === c.versionLocale,
      "un dialogue de conflit qui affiche deux fois la même date ne permet aucun choix",
    ).toBe(false);
  });
});
