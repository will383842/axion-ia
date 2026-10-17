/**
 * QNC L06 — la fenêtre d'une demi-journée, en heure de Paris. Pure.
 */

import { describe, expect, it } from "vitest";
import {
  cleDemiJournee,
  demiJourneeCible,
  demiJourneeDuRappel,
  fenetreSignature,
  instantParis,
  libelleDemiJournee,
  positionFenetre,
  type DemiJourneePrevue,
} from "../fenetre";

const MATIN: DemiJourneePrevue = {
  creneauId: "c-matin",
  date: "2026-10-15",
  demiJournee: "matin",
  jourHeureDebut: "09:00",
  jourHeureFin: "17:00",
};
const APRES_MIDI: DemiJourneePrevue = { ...MATIN, creneauId: "c-am", demiJournee: "apres_midi" };
const LENDEMAIN: DemiJourneePrevue = { ...MATIN, creneauId: "c-j2", date: "2026-10-16" };

describe("instantParis", () => {
  it("convertit l'heure de Paris en UTC, été comme hiver", () => {
    expect(instantParis("2026-10-15", 9 * 60).toISOString()).toBe("2026-10-15T07:00:00.000Z");
    expect(instantParis("2026-12-15", 9 * 60).toISOString()).toBe("2026-12-15T08:00:00.000Z");
    // Le lendemain du passage à l'heure d'hiver (dimanche 25 octobre 2026).
    expect(instantParis("2026-10-26", 9 * 60).toISOString()).toBe("2026-10-26T08:00:00.000Z");
  });
});

describe("fenetreSignature", () => {
  it("coupe la journée au pivot de 13:00", () => {
    const m = fenetreSignature(MATIN);
    expect([m.heureDebut, m.heureFin]).toEqual(["09:00", "13:00"]);
    expect(m.debut.toISOString()).toBe("2026-10-15T07:00:00.000Z");
    expect(m.fin.toISOString()).toBe("2026-10-15T11:00:00.000Z");
    const a = fenetreSignature(APRES_MIDI);
    expect([a.heureDebut, a.heureFin]).toEqual(["13:00", "17:00"]);
  });

  it("une « journée » couvre les horaires réels entiers", () => {
    const j = fenetreSignature({ ...MATIN, demiJournee: "journee" });
    expect([j.heureDebut, j.heureFin]).toEqual(["09:00", "17:00"]);
  });
});

describe("positionFenetre", () => {
  it("à venir, ouverte, close — la fin est exclue", () => {
    expect(positionFenetre(MATIN, new Date("2026-10-15T06:59:59.000Z"))).toBe("a_venir");
    expect(positionFenetre(MATIN, new Date("2026-10-15T07:00:00.000Z"))).toBe("ouverte");
    expect(positionFenetre(MATIN, new Date("2026-10-15T10:59:59.000Z"))).toBe("ouverte");
    expect(positionFenetre(MATIN, new Date("2026-10-15T11:00:00.000Z"))).toBe("close");
  });
});

describe("demiJourneeCible — la demi-journée que sert un jeton", () => {
  const djs = [LENDEMAIN, APRES_MIDI, MATIN];

  it("celle en cours, sinon la prochaine", () => {
    expect(demiJourneeCible(djs, new Date("2026-10-14T18:00:00.000Z"))?.creneauId).toBe("c-matin");
    expect(demiJourneeCible(djs, new Date("2026-10-15T08:00:00.000Z"))?.creneauId).toBe("c-matin");
    expect(demiJourneeCible(djs, new Date("2026-10-15T11:30:00.000Z"))?.creneauId).toBe("c-am");
    expect(demiJourneeCible(djs, new Date("2026-10-15T14:00:00.000Z"))?.creneauId).toBe("c-am");
    expect(demiJourneeCible(djs, new Date("2026-10-15T20:00:00.000Z"))?.creneauId).toBe("c-j2");
  });

  it("aucune après la dernière demi-journée : plus de réouverture de 48 h", () => {
    expect(demiJourneeCible(djs, new Date("2026-10-16T15:01:00.000Z"))).toBeNull();
  });
});

describe("demiJourneeDuRappel — le rappel du début de demi-journée", () => {
  const djs = [MATIN, APRES_MIDI];

  it("part dans l'heure qui précède le début", () => {
    expect(demiJourneeDuRappel(djs, new Date("2026-10-15T05:59:00.000Z"))).toBeNull();
    expect(demiJourneeDuRappel(djs, new Date("2026-10-15T06:05:00.000Z"))?.creneauId).toBe(
      "c-matin",
    );
  });

  it("n'envoie pas le lien de l'après-midi tant que le matin est signable", () => {
    // 12:05 Paris : l'après-midi commence dans moins d'une heure, mais le matin
    // est encore ouvert — c'est lui qui est rappelé.
    expect(demiJourneeDuRappel(djs, new Date("2026-10-15T10:05:00.000Z"))?.creneauId).toBe(
      "c-matin",
    );
    expect(demiJourneeDuRappel(djs, new Date("2026-10-15T11:05:00.000Z"))?.creneauId).toBe("c-am");
  });

  it("rien après la fin de la dernière demi-journée", () => {
    expect(demiJourneeDuRappel(djs, new Date("2026-10-15T15:05:00.000Z"))).toBeNull();
  });
});

describe("libellés", () => {
  it("clé et libellé stables", () => {
    expect(cleDemiJournee(MATIN)).toBe("2026-10-15:matin");
    expect(libelleDemiJournee(APRES_MIDI)).toBe(
      "jeudi 15 octobre 2026, après-midi, de 13:00 à 17:00",
    );
  });
});
