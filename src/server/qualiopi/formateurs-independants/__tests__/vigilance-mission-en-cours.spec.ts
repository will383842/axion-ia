/**
 * Étape 3 (C4) — décision de Will : le seuil de vigilance COMPTE LA MISSION EN COURS.
 *
 * Quand une mission (proposition, affectation, acceptation, lettre) fait passer le cumul
 * des honoraires HT au-delà de 5 000 €, l'attestation URSSAF est exigée AVANT la
 * mission. Le montant de la mission est celui de la lettre (tarif × journées du
 * formateur + forfaits) ; dans le doute, il est SUR-estimé.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { MANQUES_MISSION, peutRecevoirMission, type FaitsGardeMission } from "../garde-mission";
import { honorairesLettre } from "../lettre-mission-v2-calcul";
import { FORFAIT_MAX_HT_CENTS } from "../choix-formateur";
import { montantMissionHtCents, type FaitsMontantMission } from "../montant-mission";
import { etatVigilanceFormateur, vigilanceExigiblePourMission } from "../vigilance-seuil";

const MAINTENANT = new Date("2026-10-14T10:00:00Z");
const JOUR = 24 * 3600 * 1000;
const ilYa = (jours: number) => new Date(MAINTENANT.getTime() - jours * JOUR);

describe("vigilanceExigiblePourMission — la mission compte", () => {
  it("4 000 € déjà facturés + une mission de 1 400 € : exigée AVANT la mission", () => {
    expect(vigilanceExigiblePourMission(400_000, 140_000)).toBe(true);
  });

  it("4 000 € + 700 € : pas encore (4 700 € < 5 000 €)", () => {
    expect(vigilanceExigiblePourMission(400_000, 70_000)).toBe(false);
  });

  it("pile 5 000 € avec la mission : exigée (borne incluse)", () => {
    expect(vigilanceExigiblePourMission(430_000, 70_000)).toBe(true);
  });

  it("aucune mission en jeu (undefined) : la règle d'avant, sur le cumul seul", () => {
    expect(vigilanceExigiblePourMission(400_000, undefined)).toBe(false);
    expect(vigilanceExigiblePourMission(500_000, undefined)).toBe(true);
  });

  it("montant de mission illisible : exigée (garde fermée, sur-estimation)", () => {
    expect(vigilanceExigiblePourMission(0, null)).toBe(true);
    expect(vigilanceExigiblePourMission(0, Number.NaN)).toBe(true);
  });

  it("cumul illisible : exigée, comme avant", () => {
    expect(vigilanceExigiblePourMission(null, 0)).toBe(true);
  });

  it("un montant négatif ne fait jamais baisser le cumul", () => {
    expect(vigilanceExigiblePourMission(500_000, -200_000)).toBe(true);
  });

  it("etatVigilanceFormateur passe la mission comme nouvelle somme", () => {
    expect(
      etatVigilanceFormateur({
        cumulHtCents: 400_000,
        attestationValide: false,
        missionHtCents: 140_000,
      }),
    ).toMatchObject({ phase: "approche", exigible: true, demander: true, attendre: true });
    expect(
      etatVigilanceFormateur({ cumulHtCents: 400_000, attestationValide: false }),
    ).toMatchObject({ exigible: false, attendre: false });
  });
});

describe("garde de mission — la mission en jeu fait franchir le seuil", () => {
  const faits = (
    cumul: number | null,
    mission: number | null | undefined,
    pieces: FaitsGardeMission["pieces"] = [],
  ): FaitsGardeMission => ({
    statut: "sous_traitant",
    actif: true,
    finCollaborationAt: null,
    activationValideeSource: "controle",
    sousTraitantVerifieAt: ilYa(3),
    sousTraitantNda: "84123456789",
    sousTraitantContratSigneAt: ilYa(10),
    contratCadreVersion: 3,
    pieces,
    cumulHonorairesHtCents: cumul,
    ...(mission === undefined ? {} : { montantMissionHtCents: mission }),
  });

  it("4 000 € + 1 400 € sans attestation : refusée, avec un message qui dit pourquoi", () => {
    const v = peutRecevoirMission(faits(400_000, 140_000), 3, MAINTENANT);
    expect(v).toEqual({ ok: false, manques: [MANQUES_MISSION.vigilanceMission] });
    expect(MANQUES_MISSION.vigilanceMission).toMatch(/avec cette mission/i);
    expect(MANQUES_MISSION.vigilanceMission).toMatch(/5\s000 € HT/);
  });

  it("4 000 € + 1 400 € AVEC une attestation valable : acceptée", () => {
    const attestation = {
      type: "attestation_vigilance_urssaf",
      statutValidation: "valide",
      fichierUrl: "r2://a.pdf",
      dateEmission: ilYa(20),
      dateExpiration: null,
    } as FaitsGardeMission["pieces"][number];
    expect(peutRecevoirMission(faits(400_000, 140_000, [attestation]), 3, MAINTENANT)).toEqual({
      ok: true,
    });
  });

  it("4 000 € + 700 € : acceptée sans attestation", () => {
    expect(peutRecevoirMission(faits(400_000, 70_000), 3, MAINTENANT)).toEqual({ ok: true });
  });

  it("seuil déjà atteint SANS la mission : le message d'avant", () => {
    expect(peutRecevoirMission(faits(520_000, 70_000), 3, MAINTENANT)).toEqual({
      ok: false,
      manques: [MANQUES_MISSION.vigilance],
    });
  });

  it("montant de la mission illisible : refusée (sur-estimation)", () => {
    expect(peutRecevoirMission(faits(0, null), 3, MAINTENANT).ok).toBe(false);
  });
});

describe("montantMissionHtCents — le calcul de la lettre, sur-estimé dans le doute", () => {
  const jour = (date: string, trainerId: string | null = null, debut = "09:00", fin = "17:00") => ({
    date: new Date(`${date}T00:00:00.000Z`),
    heureDebut: debut,
    heureFin: fin,
    trainerId,
  });
  const base: FaitsMontantMission = {
    trainerId: "t1",
    affectes: [{ trainerId: "t1" }],
    distanciel: false,
    jours: [jour("2026-11-02"), jour("2026-11-03"), jour("2026-11-04", null, "09:00", "12:00")],
    tarifFigeHtCents: 40_000,
    forfaitFigeHtCents: 5_000,
    tarifFicheHtCents: null,
    repli: null,
  };

  it("conditions figées : EXACTEMENT le total de la lettre (journées + demi-journée + forfaits)", () => {
    const attendu = honorairesLettre({
      jours: base.jours.map((j) => ({
        date: j.date.toISOString().slice(0, 10),
        heureDebut: j.heureDebut,
        heureFin: j.heureFin,
      })),
      tarifJourneeHtCents: 40_000,
      forfaitDeplacementParJourHtCents: 5_000,
      joursDeplacement: 3,
    }).totalHtCents;
    expect(montantMissionHtCents(base)).toBe(attendu);
    expect(attendu).toBe(2 * 40_000 + 20_000 + 3 * 5_000);
  });

  it("co-animation : seules les journées du formateur comptent", () => {
    const f = { ...base, jours: [...base.jours, jour("2026-11-05", "t2")] };
    expect(montantMissionHtCents(f)).toBe(montantMissionHtCents(base));
  });

  it("formateur pas encore affecté : les journées sans formateur désigné lui reviennent", () => {
    expect(montantMissionHtCents({ ...base, affectes: [] })).toBe(montantMissionHtCents(base));
  });

  it("à distance : aucun forfait", () => {
    expect(montantMissionHtCents({ ...base, distanciel: true })).toBe(2 * 40_000 + 20_000);
  });

  it("tarif figé sans forfait figé : déplacement compris (0)", () => {
    expect(montantMissionHtCents({ ...base, forfaitFigeHtCents: null })).toBe(2 * 40_000 + 20_000);
  });

  it("rien de figé : le PLUS HAUT des tarifs (fiche ou 350 €) et le forfait au plafond", () => {
    const f = { ...base, tarifFigeHtCents: null, forfaitFigeHtCents: null };
    expect(montantMissionHtCents({ ...f, tarifFicheHtCents: 30_000 })).toBe(
      2 * 35_000 + 17_500 + 3 * FORFAIT_MAX_HT_CENTS,
    );
    expect(montantMissionHtCents({ ...f, tarifFicheHtCents: 50_000 })).toBe(
      2 * 50_000 + 25_000 + 3 * FORFAIT_MAX_HT_CENTS,
    );
  });

  it("tarif impair : arrondi AU-DESSUS (jamais une demi-journée sous-estimée)", () => {
    expect(montantMissionHtCents({ ...base, tarifFigeHtCents: 40_001, distanciel: true })).toBe(
      2 * 40_002 + 20_001,
    );
  });

  it("aucune journée déclarée : chaque jour calendaire de la période vaut une journée entière", () => {
    const f: FaitsMontantMission = {
      ...base,
      jours: [],
      repli: {
        debut: new Date("2026-11-02T08:00:00.000Z"),
        fin: new Date("2026-11-04T16:00:00.000Z"),
      },
    };
    expect(montantMissionHtCents(f)).toBe(3 * (40_000 + 5_000));
  });

  it("ni journée ni période : illisible (null) — la garde exige alors l'attestation", () => {
    expect(montantMissionHtCents({ ...base, jours: [], repli: null })).toBeNull();
  });
});

describe("côté formateur : l'acceptation dit ce qui manque, en clair", () => {
  it("seule l'attestation manque (mission) : le message le dit ; autre raison : neutre", async () => {
    const m = await import("@/server/qualiopi/trainers/mission-formateur");
    expect(m.messageAcceptationSuspendue([MANQUES_MISSION.vigilanceMission])).toBe(
      m.ACCEPTATION_ATTEND_ATTESTATION.avecLaMission,
    );
    expect(m.ACCEPTATION_ATTEND_ATTESTATION.avecLaMission).toMatch(/5\s000 € hors taxes/);
    expect(m.messageAcceptationSuspendue([MANQUES_MISSION.vigilance])).toBe(
      m.ACCEPTATION_ATTEND_ATTESTATION.aRenouveler,
    );
    expect(
      m.messageAcceptationSuspendue([MANQUES_MISSION.vigilanceMission, MANQUES_MISSION.registre]),
    ).toBe(m.PROPOSITION_SUSPENDUE);
  });
});
