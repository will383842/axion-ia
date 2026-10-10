// Le moteur commun des campagnes de relance (ADR 0066 § g, CAMP-0a) — tables
// de cas : fenêtre horaire (heure de Paris, été comme hiver), plafond, ordre
// des motifs, une relance par jour, clé d'envoi stable.

import { describe, expect, it } from "vitest";

import {
  cleEnvoi,
  dansFenetreEnvoi,
  decisionCampagne,
  motifBloquantCommun,
  motifsBloquants,
  ORDRE_MOTIFS_BLOQUANTS,
  type EtatCampagne,
  type RegleCampagne,
} from "../campagne";

const JOUR = 24 * 60 * 60 * 1000;
const H = 60 * 60 * 1000;

const REGLE: RegleCampagne<"j3" | "j7"> = {
  etapes: [
    { id: "j3", delaiMs: 3 * JOUR },
    { id: "j7", delaiMs: 7 * JOUR },
  ],
  ecartMinMs: 3 * JOUR,
  silenceApresMs: 14 * JOUR,
  max: 2,
  unParJour: true,
  fenetre: { debut: 8, fin: 19, fuseau: "Europe/Paris" },
};

// Mardi 6 octobre 2026, 10 h à Paris (UTC+2).
const ORIGINE = new Date("2026-10-06T08:00:00Z");
const apres = (jours: number, heures = 0) =>
  new Date(ORIGINE.getTime() + jours * JOUR + heures * H);

function etat(over: Partial<EtatCampagne> = {}): EtatCampagne {
  return {
    origine: ORIGINE,
    envois: [],
    efface: false,
    opposition: false,
    adresseMorte: false,
    close: false,
    actionFaite: false,
    reponseHumaine: false,
    ...over,
  };
}

describe("la fenêtre horaire d'envoi (heure de Paris)", () => {
  it.each<[string, string, boolean]>([
    // Heure d'hiver : Paris = UTC+1.
    ["hiver 7 h 59 Paris", "2026-01-15T06:59:00Z", false],
    ["hiver 8 h 00 Paris", "2026-01-15T07:00:00Z", true],
    ["hiver 18 h 59 Paris", "2026-01-15T17:59:00Z", true],
    ["hiver 19 h 00 Paris", "2026-01-15T18:00:00Z", false],
    // Heure d'été : Paris = UTC+2.
    ["été 7 h 59 Paris", "2026-07-15T05:59:00Z", false],
    ["été 8 h 00 Paris", "2026-07-15T06:00:00Z", true],
    ["été 18 h 59 Paris", "2026-07-15T16:59:00Z", true],
    ["été 19 h 00 Paris", "2026-07-15T17:00:00Z", false],
    // La même heure UTC n'est pas dans la fenêtre des deux côtés du changement.
    ["été 06:30 UTC = 8 h 30", "2026-03-30T06:30:00Z", true],
    ["hiver 06:30 UTC = 7 h 30", "2026-03-27T06:30:00Z", false],
    ["veille du passage à l'heure d'hiver, 17:30 UTC = 19 h 30", "2026-10-24T17:30:00Z", false],
    ["lendemain du passage à l'heure d'hiver, 17:30 UTC = 18 h 30", "2026-10-26T17:30:00Z", true],
    ["minuit", "2026-07-14T22:00:00Z", false],
  ])("%s", (_cas, iso, attendu) => {
    expect(dansFenetreEnvoi(new Date(iso))).toBe(attendu);
  });

  it("est paramétrable : l'émargement garde 21 h", () => {
    const emargement = { debut: 8, fin: 21, fuseau: "Europe/Paris" };
    const vingtHeures = new Date("2026-07-15T18:30:00Z"); // 20 h 30 Paris
    expect(dansFenetreEnvoi(vingtHeures)).toBe(false);
    expect(dansFenetreEnvoi(vingtHeures, emargement)).toBe(true);
    expect(dansFenetreEnvoi(new Date("2026-07-15T19:00:00Z"), emargement)).toBe(false);
  });
});

describe("l'ordre des motifs bloquants est fixe", () => {
  const tous: Partial<EtatCampagne> = {
    efface: true,
    opposition: true,
    adresseMorte: true,
    close: true,
    actionFaite: true,
    reponseHumaine: true,
    envois: [apres(3), apres(7)],
  };

  it("la liste suit l'ordre déclaré", () => {
    expect(motifsBloquants(etat(tous), REGLE, apres(20))).toEqual([...ORDRE_MOTIFS_BLOQUANTS]);
  });

  it.each<[keyof EtatCampagne, string]>([
    ["efface", "opposition"],
    ["opposition", "adresse-morte"],
    ["adresseMorte", "close"],
    ["close", "action-faite"],
    ["actionFaite", "reponse-humaine"],
    ["reponseHumaine", "plafond"],
  ])("sans `%s`, c'est `%s` qui est rendu", (retire, attendu) => {
    const e = etat({ ...tous, [retire]: false });
    // Retirer les drapeaux qui précèdent pour isoler le suivant.
    const ordre = [
      "efface",
      "opposition",
      "adresseMorte",
      "close",
      "actionFaite",
      "reponseHumaine",
    ];
    const avant = ordre.slice(0, ordre.indexOf(retire as string));
    const isole = etat({ ...e, ...Object.fromEntries(avant.map((k) => [k, false])) });
    expect(motifBloquantCommun(isole, REGLE, apres(20))).toBe(attendu);
  });

  it("plafond avant fenêtre dépassée", () => {
    expect(motifBloquantCommun(etat({ envois: [apres(3), apres(7)] }), REGLE, apres(20))).toBe(
      "plafond",
    );
    expect(motifBloquantCommun(etat(), REGLE, apres(14, 1))).toBe("fenetre-depassee");
  });

  it("sans règle, seuls les drapeaux comptent (filet du départ)", () => {
    expect(motifBloquantCommun(etat({ envois: [apres(3), apres(7)] }))).toBeNull();
    expect(motifBloquantCommun(etat({ opposition: true }))).toBe("opposition");
  });

  it("un motif bloquant ne laisse aucune échéance", () => {
    expect(
      decisionCampagne({ etat: etat({ adresseMorte: true }), maintenant: apres(3), regle: REGLE }),
    ).toEqual({ envoyer: false, motif: "adresse-morte", prochaineEcheance: null });
  });
});

describe("le calendrier et le plafond", () => {
  it.each<[string, Partial<EtatCampagne>, Date, object]>([
    ["avant J+3", {}, apres(2, 23), { envoyer: false, motif: "pas-encore" }],
    ["à J+3", {}, apres(3), { envoyer: true, etape: "j3" }],
    [
      "J+4 après le premier",
      { envois: [apres(3)] },
      apres(4),
      { envoyer: false, motif: "pas-encore" },
    ],
    ["à J+7", { envois: [apres(3)] }, apres(7), { envoyer: true, etape: "j7" }],
    [
      "rattrapage : écart de trois jours",
      { envois: [apres(9)] },
      apres(10),
      { envoyer: false, motif: "pas-encore" },
    ],
    [
      "rattrapage : puis le second",
      { envois: [apres(9)] },
      apres(12),
      { envoyer: true, etape: "j7" },
    ],
    [
      "plafond atteint",
      { envois: [apres(3), apres(7)] },
      apres(10),
      { envoyer: false, motif: "plafond" },
    ],
    ["à 14 jours pile, encore permis", {}, apres(14), { envoyer: true, etape: "j3" }],
    ["au-delà de 14 jours", {}, apres(14, 1), { envoyer: false, motif: "fenetre-depassee" }],
  ])("%s", (_cas, over, maintenant, attendu) => {
    expect(decisionCampagne({ etat: etat(over), maintenant, regle: REGLE })).toMatchObject(attendu);
  });

  it("un plafond plus bas que les étapes s'applique", () => {
    const r = { ...REGLE, max: 1 };
    expect(
      decisionCampagne({ etat: etat({ envois: [apres(3)] }), maintenant: apres(8), regle: r }),
    ).toMatchObject({
      envoyer: false,
      motif: "plafond",
    });
  });

  it("l'échéance d'un « pas encore » est le délai de l'étape", () => {
    const d = decisionCampagne({ etat: etat(), maintenant: apres(1), regle: REGLE });
    expect(d.prochaineEcheance).toEqual(apres(3));
  });

  it("une échéance au-delà du silence vaut « jamais »", () => {
    const r = { ...REGLE, silenceApresMs: 2 * JOUR };
    expect(
      decisionCampagne({ etat: etat(), maintenant: apres(1), regle: r }).prochaineEcheance,
    ).toBeNull();
  });
});

describe("au plus une relance par jour et par personne", () => {
  it("une relance d'une AUTRE campagne le même jour (Paris) reporte au lendemain 8 h", () => {
    const d = decisionCampagne({
      etat: etat({ derniereRelancePersonne: apres(3, -1) }), // 9 h Paris le même jour
      maintenant: apres(3), // 10 h Paris
      regle: REGLE,
    });
    expect(d).toMatchObject({ envoyer: false, motif: "deja-aujourd-hui" });
    expect(d.prochaineEcheance).toEqual(new Date("2026-10-10T06:00:00Z")); // samedi 8 h Paris
  });

  it("le jour s'entend à Paris, pas en UTC", () => {
    // 23 h 30 UTC le 8 = 1 h 30 Paris le 9 : même jour que 10 h Paris le 9.
    const e = etat({ derniereRelancePersonne: new Date("2026-10-08T23:30:00Z") });
    expect(decisionCampagne({ etat: e, maintenant: apres(3), regle: REGLE })).toMatchObject({
      motif: "deja-aujourd-hui",
    });
  });

  it("la veille ne compte pas", () => {
    const e = etat({ derniereRelancePersonne: apres(2) });
    expect(decisionCampagne({ etat: e, maintenant: apres(3), regle: REGLE })).toMatchObject({
      envoyer: true,
    });
  });

  it("désactivable par la règle", () => {
    const e = etat({ derniereRelancePersonne: apres(3, -1) });
    expect(
      decisionCampagne({ etat: e, maintenant: apres(3), regle: { ...REGLE, unParJour: false } }),
    ).toMatchObject({ envoyer: true, etape: "j3" });
  });
});

describe("hors de la fenêtre horaire", () => {
  it("reporte à 8 h Paris, été comme hiver", () => {
    // Été : 21 h Paris → lendemain 8 h = 06:00 UTC.
    const ete = decisionCampagne({
      etat: etat({ origine: new Date("2026-07-01T19:00:00Z") }),
      maintenant: new Date("2026-07-04T19:00:00Z"),
      regle: REGLE,
    });
    expect(ete).toMatchObject({ envoyer: false, motif: "hors-fenetre" });
    expect(ete.prochaineEcheance).toEqual(new Date("2026-07-05T06:00:00Z"));
    // Hiver : 21 h Paris → lendemain 8 h = 07:00 UTC.
    const hiver = decisionCampagne({
      etat: etat({ origine: new Date("2026-01-10T20:00:00Z") }),
      maintenant: new Date("2026-01-13T20:00:00Z"),
      regle: REGLE,
    });
    expect(hiver.prochaineEcheance).toEqual(new Date("2026-01-14T07:00:00Z"));
  });

  it("à travers le passage à l'heure d'hiver (nuit du 24 au 25 octobre 2026)", () => {
    const d = decisionCampagne({
      etat: etat({ origine: new Date("2026-10-21T18:00:00Z") }),
      maintenant: new Date("2026-10-24T18:00:00Z"), // 20 h Paris (été)
      regle: REGLE,
    });
    expect(d.prochaineEcheance).toEqual(new Date("2026-10-25T07:00:00Z")); // 8 h Paris (hiver)
  });

  it("sans fenêtre, à toute heure", () => {
    const d = decisionCampagne({
      etat: etat({ origine: new Date("2026-07-01T19:00:00Z") }),
      maintenant: new Date("2026-07-04T19:00:00Z"),
      regle: { ...REGLE, fenetre: null },
    });
    expect(d).toMatchObject({ envoyer: true, etape: "j3" });
  });
});

describe("la clé d'envoi", () => {
  it("est stable, distingue campagne, étape et personne, et n'a aucun `:`", () => {
    const a = cleEnvoi("formateur-dossier", "p-1", "j3");
    expect(a).toBe("formateur-dossier-j3-p-1");
    expect(cleEnvoi("formateur-dossier", "p-1", "j3")).toBe(a);
    expect(cleEnvoi("formateur-dossier", "p-1", "j7")).not.toBe(a);
    expect(cleEnvoi("formateur-dossier", "p-2", "j3")).not.toBe(a);
    expect(cleEnvoi("formateur-signature", "p-1", "j3")).not.toBe(a);
    expect(cleEnvoi("c:x", "p:1", "j3")).toBe("c-x-j3-p-1");
  });
});
