/**
 * Lot S5 — ce que la lettre v2 IMPRIME, à partir des faits en base, et
 * pourquoi elle REFUSE de partir (aucune lettre sans numéro de déclaration
 * d'activité, sans SIRET, sans contrat-cadre v3 signé, sans accord).
 */

import { describe, expect, it } from "vitest";

import { assemblerLettreV2, type FaitsLettreV2 } from "../lettre-mission-v2-donnees";

const faits = (over: Partial<FaitsLettreV2> = {}): FaitsLettreV2 => ({
  numero: "LM-2026-0001",
  trainerId: "t-marie",
  trainer: {
    prenom: "Marie",
    nom: "Dupont",
    statut: "sous_traitant",
    siret: "12345678900012",
    nda: "84380000000",
    regimeTvaHonoraires: "franchise_293b",
    mandatAutofacturationSigneAt: new Date("2026-10-01T10:00:00Z"),
    mandatAutofacturationRevoqueAt: null,
    organismeSousTraitantId: null,
  },
  contratCadre: { version: 3, signeLe: new Date("2026-10-02T10:00:00Z") },
  mission: {
    statut: "acceptee",
    reponduAt: new Date("2026-10-12T07:41:00Z"),
    accordHorsOutilAt: null,
    // Étape 4 : sans conditions FIGÉES, aucune lettre (le paiement ne verserait rien).
    tarifHtCents: 35_000,
    forfaitDeplacementParJourHtCents: null,
    regimeTvaFige: "franchise_293b",
  },
  session: {
    titre: "IA pour managers",
    numero: "AXI-SESS-2026-042",
    client: "Client SAS",
    stagiaires: 8,
    financeurEnAttente: false,
    lieu: "12 rue Exemple, Lyon",
    distanciel: false,
    affectes: [{ trainerId: "t-marie" }],
    jours: [
      {
        date: new Date("2026-11-04T00:00:00Z"),
        heureDebut: "09:00",
        heureFin: "17:00",
        trainerId: null,
      },
      {
        date: new Date("2026-11-05T00:00:00Z"),
        heureDebut: "09:00",
        heureFin: "12:30",
        trainerId: null,
      },
    ],
  },
  dateMission: new Date("2026-10-12T08:00:00Z"),
  ...over,
});

describe("assemblerLettreV2 — ce qui s'imprime", () => {
  it("SIRET et numéro de déclaration dans deux cases ; 350 + 175 = 525 € HT", () => {
    const r = assemblerLettreV2(faits());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.partie).toMatchObject({
      forme: "independant",
      nomPrenom: "Marie Dupont",
      siret: "12345678900012",
      nda: "84380000000",
    });
    expect(r.data.journees).toBe(1);
    expect(r.data.demiJournees).toBe(1);
    expect(r.data.totalHtCents).toBe(52_500);
    expect(r.data.deplacement).toBeNull();
    expect(r.data.mentionTva).toBe("TVA non applicable, art. 293 B du CGI");
    expect(r.data.autofacturation).toBe(true);
    expect(r.data.echeancePaiement).toBe("04/12/2026");
    expect(r.data.contratCadre).toEqual({ version: 3, signeLe: "02/10/2026" });
    expect(r.data.accordLe).toBe("12/10/2026 à 09:41");
    expect(r.data.mentionExpresse).toBeNull();
  });

  it("les conditions FIGÉES de la mission priment : tarif, forfait, régime de TVA", () => {
    const r = assemblerLettreV2(
      faits({
        mission: {
          ...faits().mission!,
          tarifHtCents: 40_000,
          forfaitDeplacementParJourHtCents: 8_000,
          regimeTvaFige: "assujetti_20",
        },
      }),
    );
    if (!r.ok) throw new Error(r.motif);
    expect(r.data.honorairesHtCents).toBe(60_000);
    // Deux journées sur place : deux journées de déplacement.
    expect(r.data.deplacement).toEqual({
      forfaitParJourHtCents: 8_000,
      joursDeplacement: 2,
      totalHtCents: 16_000,
    });
    expect(r.data.totalHtCents).toBe(76_000);
    expect(r.data.mentionTva).toBe("TVA 20 % : 152,00 €");
  });

  it("à distance : pas de déplacement, lieu « à distance »", () => {
    const r = assemblerLettreV2(
      faits({
        session: { ...faits().session, distanciel: true },
        mission: { ...faits().mission!, forfaitDeplacementParJourHtCents: 8_000 },
      }),
    );
    if (!r.ok) throw new Error(r.motif);
    expect(r.data.deplacement).toBeNull();
    expect(r.data.jours.every((j) => j.lieu === "à distance")).toBe(true);
  });

  it("sans mandat d'autofacturation en vigueur : « vous adressez votre facture »", () => {
    const r = assemblerLettreV2(
      faits({
        trainer: {
          ...faits().trainer,
          mandatAutofacturationRevoqueAt: new Date("2026-10-05T00:00:00Z"),
        },
      }),
    );
    if (!r.ok) throw new Error(r.motif);
    expect(r.data.autofacturation).toBe(false);
  });

  it("plusieurs mois : une échéance par mois", () => {
    const r = assemblerLettreV2(
      faits({
        session: {
          ...faits().session,
          jours: [
            {
              date: new Date("2026-11-04T00:00:00Z"),
              heureDebut: "09:00",
              heureFin: "17:00",
              trainerId: null,
            },
            {
              date: new Date("2026-12-10T00:00:00Z"),
              heureDebut: "09:00",
              heureFin: "17:00",
              trainerId: null,
            },
          ],
        },
      }),
    );
    if (!r.ok) throw new Error(r.motif);
    expect(r.data.echeancesParMois).toEqual(["04/12/2026", "08/01/2027"]);
    expect(r.data.echeancePaiement).toBe("08/01/2027");
  });
});

describe("assemblerLettreV2 — aucune lettre ne part sans…", () => {
  it.each([
    ["numéro de déclaration d'activité", { trainer: { ...faits().trainer, nda: null } }],
    ["SIRET", { trainer: { ...faits().trainer, siret: "  " } }],
    ["contrat-cadre v3 signé", { contratCadre: null }],
    ["contrat-cadre v3 signé", { contratCadre: { version: 2, signeLe: new Date() } }],
    ["accord", { mission: { ...faits().mission!, statut: "en_attente" as const } }],
    ["accord", { mission: null }],
    ["journée", { session: { ...faits().session, jours: [] } }],
    ["tarif figé", { mission: { ...faits().mission!, tarifHtCents: null } }],
    ["régime de TVA figé", { mission: { ...faits().mission!, regimeTvaFige: null } }],
  ])("refusée sans %s", (_quoi, over) => {
    expect(assemblerLettreV2(faits(over as Partial<FaitsLettreV2>)).ok).toBe(false);
  });

  it("refusée pour un salarié, et pour un organisme (lot L11f)", () => {
    expect(
      assemblerLettreV2(faits({ trainer: { ...faits().trainer, statut: "salarie" } })).ok,
    ).toBe(false);
    expect(
      assemblerLettreV2(
        faits({ trainer: { ...faits().trainer, organismeSousTraitantId: "org-1" } }),
      ).ok,
    ).toBe(false);
  });

  it("aucun mot interdit dans les motifs", () => {
    const motifs = [
      assemblerLettreV2(faits({ contratCadre: null })),
      assemblerLettreV2(faits({ mission: null })),
      assemblerLettreV2(faits({ mission: { ...faits().mission!, tarifHtCents: null } })),
      assemblerLettreV2(faits({ mission: { ...faits().mission!, regimeTvaFige: null } })),
    ].flatMap((r) => (r.ok ? [] : [r.motif]));
    for (const m of motifs) {
      expect(m).not.toMatch(/obligatoire|vous devez|rémunération|salaire|poste|entretien/i);
    }
  });
});
