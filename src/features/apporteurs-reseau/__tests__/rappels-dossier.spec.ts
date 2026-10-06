import { describe, expect, it } from "vitest";

import {
  rappelDossierAEnvoyer,
  rappelDossierDu,
  type EnvoiLienDossier,
} from "../passage-quotidien";

const envoye = new Date("2026-10-01T09:00:00Z");
const apres = (jours: number) => new Date(envoye.getTime() + jours * 86_400_000);

describe("rappel du dossier non complété : J+3 puis J+7, jamais au-delà", () => {
  it("rien avant J+3", () => {
    expect(rappelDossierDu(envoye, apres(0))).toBeNull();
    expect(rappelDossierDu(envoye, apres(2.9))).toBeNull();
  });
  it("premier rappel de J+3 à J+7", () => {
    expect(rappelDossierDu(envoye, apres(3))).toBe(1);
    expect(rappelDossierDu(envoye, apres(6.9))).toBe(1);
  });
  it("second rappel de J+7 à J+14", () => {
    expect(rappelDossierDu(envoye, apres(7))).toBe(2);
    expect(rappelDossierDu(envoye, apres(13.9))).toBe(2);
  });
  it("plus rien à partir de J+14 : un vieux lien oublié n'est pas relancé", () => {
    expect(rappelDossierDu(envoye, apres(14))).toBeNull();
    expect(rappelDossierDu(envoye, apres(60))).toBeNull();
  });
});

/** Simule le passage quotidien : on « envoie » le rappel décidé, qui entre dans le journal. */
function simuler(envoisInitiaux: EnvoiLienDossier[], jours: number[]): Array<[number, string]> {
  const journal = [...envoisInitiaux];
  const dejaEnvoyes = new Set<string>();
  const sortis: Array<[number, string]> = [];
  for (const j of jours) {
    const maintenant = apres(j);
    const d = rappelDossierAEnvoyer(journal, maintenant);
    if (!d) continue;
    const jobId = d.jobId("A1");
    if (dejaEnvoyes.has(jobId)) continue;
    dejaEnvoyes.add(jobId);
    sortis.push([j, jobId]);
    // Le rappel est du même gabarit : il entre dans le journal avec sa clé de rappel.
    journal.push({ id: `rappel-${j}`, sentAt: maintenant, jobId, bounceType: null });
  }
  return sortis;
}

const lien = (id: string, at: Date, jobId = `apporteur-dossier-lien-A1-${at.getTime()}`) => ({
  id,
  sentAt: at,
  jobId,
  bounceType: null,
});
const chaqueJour = Array.from({ length: 40 }, (_, i) => i);

describe("rappels du dossier : l'horloge ne repart pas à chaque rappel", () => {
  it("lien envoyé en J : un rappel à J+3, un à J+7 (et pas à J+6), rien après J+14", () => {
    const sortis = simuler([lien("L1", envoye)], chaqueJour);
    expect(sortis.map(([j]) => j)).toEqual([3, 7]);
    expect(sortis[0]![1]).toMatch(/-L1-j3$/);
    expect(sortis[1]![1]).toMatch(/-L1-j7$/);
  });
  it("un rappel du même gabarit ne devient jamais l'origine du délai", () => {
    const rappel = {
      id: "R",
      sentAt: apres(3),
      jobId: "apporteur-dossier-rappel-A1-L1-j3",
      bounceType: null,
    };
    const d = rappelDossierAEnvoyer([lien("L1", envoye), rappel], apres(6));
    expect(d?.origineId).toBe("L1");
    expect(d?.rappel).toBe(1);
  });
  it("lien renvoyé à la main à J+10 : repart de zéro (rappels à J+13 et J+17)", () => {
    const sortis = simuler(
      [lien("L1", envoye), lien("L2", apres(10))],
      [10, 12, 13, 14, 16, 17, 25],
    );
    expect(sortis.map(([j]) => j)).toEqual([13, 17]);
    expect(sortis[0]![1]).toMatch(/-L2-j3$/);
  });
  it("adresse morte : aucun rappel", () => {
    expect(
      rappelDossierAEnvoyer([{ ...lien("L1", envoye), bounceType: "hard" }], apres(4)),
    ).toBeNull();
  });
  it("aucun envoi d'origine : rien", () => {
    expect(rappelDossierAEnvoyer([], apres(4))).toBeNull();
  });
});
