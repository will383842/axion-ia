/**
 * 🔴 QUELLES DEMI-JOURNÉES ATTENDENT LA CONTRESIGNATURE DU FORMATEUR ?
 *
 * Constaté sur AXI-SESS-2026-001 : la stagiaire a signé, `emargement_contresignatures`
 * est vide, et rien ne l'a jamais demandé au formateur ni signalé à la console.
 * La contresignature reste NON BLOQUANTE (décision de Will) — mais les OPCO la
 * demandent, et une signature ne s'appose pas à la place de quelqu'un :
 * « automatique » veut dire que la DEMANDE part seule, au bon moment.
 *
 * Ce module décide du « quoi » et du « quand », sans base ni horloge implicite.
 * Le même bilan alimente l'e-mail au formateur, son espace et la fiche session :
 * trois surfaces qui diraient trois choses différentes si chacune recomptait.
 */

import { describe, it, expect } from "vitest";
import * as manquantes from "../contresignatures-manquantes";

const jourDb = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const BASE = {
  jours: [
    { date: jourDb("2026-09-16"), heureDebut: "09:00", heureFin: "17:00", trainerId: "t-jour-1" },
    { date: jourDb("2026-09-17"), heureDebut: "09:00", heureFin: "17:00", trainerId: null },
  ],
  formateurPrincipalId: "t-principal",
  creneauxSignes: [
    { date: jourDb("2026-09-16"), demiJournee: "matin" },
    { date: jourDb("2026-09-16"), demiJournee: "apres_midi" },
    { date: jourDb("2026-09-17"), demiJournee: "matin" },
  ],
  contresignatures: [] as Array<{ date: Date; demiJournee: string }>,
};

describe("bilan de contresignature", () => {
  it("🔴 une demi-journée signée par un stagiaire et sans contresignature est à contresigner", () => {
    // Jeudi 17/09 à 20:00 Paris : les deux journées sont terminées.
    const b = manquantes.bilanContresignature({
      ...BASE,
      maintenant: new Date("2026-09-17T18:00:00.000Z"),
    });
    expect(b.signees).toBe(3);
    expect(b.aContresigner.map((d) => `${d.date}|${d.demiJournee}`)).toEqual([
      "2026-09-16|matin",
      "2026-09-16|apres_midi",
      "2026-09-17|matin",
    ]);
  });

  it("le formateur désigné est celui de la JOURNÉE, sinon le principal", () => {
    const b = manquantes.bilanContresignature({
      ...BASE,
      maintenant: new Date("2026-09-17T18:00:00.000Z"),
    });
    expect(b.aContresigner[0]?.formateurId).toBe("t-jour-1");
    expect(b.aContresigner[2]?.formateurId).toBe("t-principal");
  });

  it("une contresignature posée — par n'importe quel formateur — ferme la demi-journée", () => {
    // Même règle que la feuille d'émargement tirée (`emargement-tirage.ts`) :
    // la case « contresignée » ne regarde pas QUI a contresigné.
    const b = manquantes.bilanContresignature({
      ...BASE,
      contresignatures: [{ date: jourDb("2026-09-16"), demiJournee: "matin" }],
      maintenant: new Date("2026-09-17T18:00:00.000Z"),
    });
    expect(b.aContresigner.map((d) => `${d.date}|${d.demiJournee}`)).toEqual([
      "2026-09-16|apres_midi",
      "2026-09-17|matin",
    ]);
  });

  it("🔴 on ne réclame rien PENDANT la journée : la demande part quand elle est finie", () => {
    // Jeudi 17/09 à 14:00 Paris : la journée du 17 n'est pas terminée. Harceler
    // le formateur au milieu de sa séance serait du bruit, et il a déjà le
    // bouton sous les yeux.
    const b = manquantes.bilanContresignature({
      ...BASE,
      maintenant: new Date("2026-09-17T12:00:00.000Z"),
    });
    expect(b.aContresigner.map((d) => d.date)).toEqual(["2026-09-16", "2026-09-16"]);
    expect(b.signees).toBe(2);
    // 17:00 Paris pile : terminée.
    const fin = manquantes.bilanContresignature({
      ...BASE,
      maintenant: new Date("2026-09-17T15:00:00.000Z"),
    });
    expect(fin.aContresigner.map((d) => d.date)).toContain("2026-09-17");
  });

  it("le grain « journee » (créneau importé) n'est jamais réclamé — comme sur la feuille", () => {
    const b = manquantes.bilanContresignature({
      ...BASE,
      creneauxSignes: [{ date: jourDb("2026-09-16"), demiJournee: "journee" }],
      maintenant: new Date("2026-09-17T18:00:00.000Z"),
    });
    expect(b.aContresigner).toEqual([]);
    expect(b.signees).toBe(0);
  });

  it("aucune signature de stagiaire → rien à contresigner", () => {
    const b = manquantes.bilanContresignature({
      ...BASE,
      creneauxSignes: [],
      maintenant: new Date("2026-09-17T18:00:00.000Z"),
    });
    expect(b).toMatchObject({ signees: 0, aContresigner: [], sansDestinataire: 0 });
    expect(b.parFormateur.size).toBe(0);
  });

  it("libellé lisible d'une demi-journée, en français", () => {
    expect(
      manquantes.libelleDemiJourneeAContresigner({
        date: "2026-09-16",
        demiJournee: "apres_midi",
        formateurId: null,
      }),
    ).toBe("mercredi 16 septembre 2026 — après-midi");
  });
});

describe("🔴 relecture #1096 — formateur de la journée NON membre de la session", () => {
  const maintenant = new Date("2026-09-17T18:00:00.000Z");
  const base = {
    ...BASE,
    jours: [
      { date: jourDb("2026-09-16"), heureDebut: "09:00", heureFin: "17:00", trainerId: "t-parti" },
    ],
    creneauxSignes: [{ date: jourDb("2026-09-16"), demiJournee: "matin" }],
    maintenant,
  };

  it("replie sur le formateur principal quand il est membre", () => {
    // `contresignerDemiJourneeAction` refuse un non-membre : lui écrire
    // l'enverrait sur un bouton qui échoue. Le principal, lui, peut agir.
    const b = manquantes.bilanContresignature({
      ...base,
      membres: new Set(["t-principal"]),
    });
    expect(b.aContresigner[0]?.formateurId).toBe("t-principal");
    expect(b.sansDestinataire).toBe(0);
  });

  it("personne de membre à qui demander → destinataire nul, et COMPTÉ", () => {
    const b = manquantes.bilanContresignature({
      ...base,
      formateurPrincipalId: null,
      membres: new Set<string>(),
    });
    expect(b.aContresigner[0]?.formateurId).toBeNull();
    expect(b.sansDestinataire).toBe(1);
  });

  it("le bilan porte le détail PAR formateur (accueil du co-formateur)", () => {
    const b = manquantes.bilanContresignature({
      ...BASE,
      membres: new Set(["t-jour-1", "t-principal"]),
      maintenant,
    });
    expect(b.parFormateur.get("t-jour-1")).toEqual({ signees: 2, aContresigner: 2 });
    expect(b.parFormateur.get("t-principal")).toEqual({ signees: 1, aContresigner: 1 });
  });
});
