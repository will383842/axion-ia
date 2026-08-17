/**
 * Lot 1 §1.2 — les quatre états.
 *
 * Le test central est celui du 4e : **une échéance dépassée AVANT le début de
 * la session n'est pas la même chose qu'une échéance dépassée après.** Le soir
 * du 15/08, la moitié des rouges du dossier étaient encore sauvables, et rien à
 * l'écran ne les distinguait de ceux qui ne l'étaient plus.
 */

import { describe, expect, it } from "vitest";
import {
  appelleUneAction,
  calculerEtat,
  mentionPour,
  pireEtat,
  type EtatEtape,
} from "./etat-echeance";

const d = (iso: string): Date => new Date(iso);

const DEBUT = d("2026-09-10T09:00:00.000Z");
const ECHEANCE = d("2026-09-05T09:00:00.000Z"); // J-5

describe("🔴 le quatrième état — rattrapable", () => {
  it("échéance dépassée mais session pas commencée : RATTRAPABLE", () => {
    // Le cas exact du 15/08 : convention non signée à J-2. C'est encore
    // faisable, et l'écran doit dire « fais-le maintenant », pas « c'est foutu ».
    expect(
      calculerEtat({
        fait: false,
        echeance: ECHEANCE,
        borneRattrapage: DEBUT,
        maintenant: d("2026-09-08T10:00:00.000Z"),
      }),
    ).toBe("rattrapable");
  });

  it("la session a commencé : HORS DÉLAI", () => {
    expect(
      calculerEtat({
        fait: false,
        echeance: ECHEANCE,
        borneRattrapage: DEBUT,
        maintenant: d("2026-09-10T10:00:00.000Z"),
      }),
    ).toBe("hors_delai");
  });

  it("à la SECONDE du début de session, il est déjà trop tard", () => {
    // 🔴 Comparaison LARGE à la borne. Une session qui commence à 09:00
    // n'accepte pas une convention signée à 09:00:00 — la pièce doit précéder
    // la séance, pas la rejoindre.
    expect(
      calculerEtat({
        fait: false,
        echeance: ECHEANCE,
        borneRattrapage: DEBUT,
        maintenant: DEBUT,
      }),
    ).toBe("hors_delai");
  });

  it("à la SECONDE de l'échéance, on est encore dans les temps", () => {
    // Comparaison STRICTE à l'échéance : le contraire ferait rougir une pièce
    // déposée pile à l'heure annoncée.
    expect(
      calculerEtat({
        fait: false,
        echeance: ECHEANCE,
        borneRattrapage: DEBUT,
        maintenant: ECHEANCE,
      }),
    ).toBe("a_faire");
  });

  it("sans borne, le geste reste rattrapable indéfiniment", () => {
    // Une pièce d'après-séance (satisfaction à froid) reste utile longtemps :
    // la déclarer hors délai enverrait renoncer à un recueil encore possible.
    expect(
      calculerEtat({
        fait: false,
        echeance: ECHEANCE,
        borneRattrapage: null,
        maintenant: d("2027-01-01T00:00:00.000Z"),
      }),
    ).toBe("rattrapable");
  });
});

describe("🔴 fait et sans échéance", () => {
  it("fait gagne toujours, même très en retard", () => {
    // Une pièce signée en retard reste signée. C'est la MENTION qui porte
    // l'écart, pas l'état : effacer le « fait » ferait redemander le geste.
    expect(
      calculerEtat({
        fait: true,
        echeance: ECHEANCE,
        borneRattrapage: DEBUT,
        maintenant: d("2027-01-01T00:00:00.000Z"),
      }),
    ).toBe("fait");
  });

  it("sans échéance connue, l'étape reste à faire — jamais rouge sur une date inventée", () => {
    expect(
      calculerEtat({
        fait: false,
        echeance: null,
        borneRattrapage: DEBUT,
        maintenant: d("2027-01-01T00:00:00.000Z"),
      }),
    ).toBe("a_faire");
  });
});

describe("🔴 le pire état d'un dossier", () => {
  it("hors délai domine tout", () => {
    expect(pireEtat(["fait", "a_faire", "rattrapable", "hors_delai"])).toBe("hors_delai");
  });

  it("« on ne sait pas » passe DEVANT « à faire »", () => {
    // 🔴 Ranger `indetermine` tout en bas le ferait disparaître des synthèses —
    // or c'est justement ce qu'il faut aller vérifier à la main.
    expect(pireEtat(["fait", "a_faire", "indetermine"])).toBe("indetermine");
  });

  it("« on ne sait pas » passe DERRIÈRE une échéance dépassée", () => {
    expect(pireEtat(["indetermine", "rattrapable"])).toBe("rattrapable");
  });

  it("une liste vide ne fabrique pas d'alarme", () => {
    expect(pireEtat([])).toBe("sans_objet");
  });

  it("un dossier entièrement fait reste « fait », pas « sans objet »", () => {
    expect(pireEtat(["fait", "fait", "sans_objet"])).toBe("fait");
  });
});

describe("🔴 quels états appellent une action", () => {
  it.each([
    ["a_faire", true],
    ["rattrapable", true],
    ["hors_delai", true],
    ["fait", false],
    ["sans_objet", false],
    ["indetermine", false],
  ] as const)("%s → %s", (etat, attendu) => {
    // `hors_delai` appelle ENCORE une action : l'écart est consigné, mais la
    // pièce reste à produire. Le sortir d'ici ferait disparaître de « À traiter »
    // exactement les dossiers les plus en retard.
    // `indetermine` n'en appelle pas : l'action est de VÉRIFIER, pas de refaire.
    expect(appelleUneAction(etat as EtatEtape)).toBe(attendu);
  });
});

describe("🔴 l'état est dans le TEXTE, jamais dans la seule couleur", () => {
  const base = {
    echeance: ECHEANCE,
    borneRattrapage: DEBUT,
    maintenant: d("2026-09-08T10:00:00Z"),
  };

  it("« à faire » porte la date et le compte à rebours", () => {
    const m = mentionPour({
      ...base,
      etat: "a_faire",
      faitLe: null,
      maintenant: d("2026-08-31T09:00:00.000Z"),
    });
    expect(m).toContain("05/09/2026");
    expect(m).toContain("J-5");
  });

  it("« rattrapable » dit jusqu'à QUAND, à l'heure près", () => {
    // Sans l'heure, « rattrapable avant le 10/09 » laisserait croire qu'on a la
    // journée du 10 — alors que la session commence à 09:00.
    const m = mentionPour({ ...base, etat: "rattrapable", faitLe: null });
    expect(m).toContain("rattrapable");
    expect(m).toMatch(/\d{2}:\d{2}/);
  });

  it("« hors délai » chiffre le retard et annonce l'écart consigné", () => {
    const m = mentionPour({
      ...base,
      etat: "hors_delai",
      faitLe: null,
      maintenant: d("2026-09-11T09:00:00.000Z"),
    });
    expect(m).toContain("+6 j");
    expect(m).toContain("écart consigné");
  });

  it("un dépassement de quelques heures se voit quand même", () => {
    // 🔴 Arrondi à la baisse, « +0 j » se lirait comme « pas de retard ».
    const m = mentionPour({
      ...base,
      etat: "hors_delai",
      faitLe: null,
      maintenant: d("2026-09-05T12:00:00.000Z"),
    });
    expect(m).toContain("+1 j");
  });

  it("« fait » porte sa date", () => {
    const m = mentionPour({
      ...base,
      etat: "fait",
      faitLe: d("2026-08-12T00:00:00.000Z"),
    });
    expect(m).toBe("Fait le 12/08/2026");
  });

  it("« indéterminé » dit qu'on ne sait pas — et ne ressemble ni à un ✅ ni à un manque", () => {
    const m = mentionPour({ ...base, etat: "indetermine", faitLe: null });
    expect(m).toContain("non établi");
    // La phrase ne doit pas pouvoir se lire comme un acquittement.
    expect(m.toLowerCase()).not.toContain("fait le");
  });

  it("« sans objet » peut porter SON motif", () => {
    const m = mentionPour({
      ...base,
      etat: "sans_objet",
      faitLe: null,
      motifSansObjet: "financement direct entreprise — aucune pièce OPCO",
    });
    expect(m).toContain("financement direct");
  });
});
