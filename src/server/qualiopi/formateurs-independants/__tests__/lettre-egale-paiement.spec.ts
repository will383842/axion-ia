/**
 * Chantier « formateurs freelance », étape 4 — CE QUE LA LETTRE ANNONCE EST CE
 * QUE LE PAIEMENT VERSE.
 *
 * Trois défauts fermés, chacun par un contre-calcul en centimes écrit ici à la
 * main (jamais relu dans le code testé) :
 *  1. le découpage en demi-journées est UNE fonction, celle du paiement
 *     (`argent/parametres.ts` : matin avant 12:00, après-midi après 13:30) ;
 *  2. en co-animation, la lettre et la proposition ne comptent que les journées
 *     du formateur, filtrées par la fonction du paiement ;
 *  3. sans tarif (ou régime de TVA) figé sur la mission, la lettre ne part pas :
 *     le paiement ne verserait rien (`conditions_absentes`).
 */

import { describe, expect, it } from "vitest";

import { demiJourneesPrevues, parMoisCivil } from "@/server/qualiopi/remuneration/heures-animees";

import { calculerReleveDuMois, montantPrevuDuMoisHtCents } from "../argent/calcul-mission";
import { journeesDuFormateur } from "../argent/journees-du-formateur";
import { PARAMETRES_ARGENT_FORMATEURS } from "../argent/parametres";
import { honorairesProposition, ligneJour } from "../choix-formateur";
import { demiJourneesDuJour } from "../lettre-mission-v2-calcul";
import { assemblerLettreV2, type FaitsLettreV2 } from "../lettre-mission-v2-donnees";

const MOI = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";

type JourSession = FaitsLettreV2["session"]["jours"][number];

const jourSession = (
  date: string,
  heureDebut: string,
  heureFin: string,
  trainerId: string | null = null,
): JourSession => ({ date: new Date(`${date}T00:00:00Z`), heureDebut, heureFin, trainerId });

const MISSION: NonNullable<FaitsLettreV2["mission"]> = {
  statut: "acceptee",
  reponduAt: new Date("2026-10-12T07:41:00Z"),
  accordHorsOutilAt: null,
  tarifHtCents: 35_000,
  forfaitDeplacementParJourHtCents: null,
  regimeTvaFige: "franchise_293b",
};

const SESSION = (jours: ReadonlyArray<JourSession>): FaitsLettreV2["session"] => ({
  titre: "IA pour managers",
  numero: "AXI-SESS-2026-042",
  client: "Client SAS",
  stagiaires: 8,
  financeurEnAttente: false,
  lieu: "12 rue Exemple, Lyon",
  distanciel: false,
  affectes: [{ trainerId: MOI }],
  jours,
});

const faits = (
  jours: ReadonlyArray<JourSession>,
  over: Partial<FaitsLettreV2> = {},
): FaitsLettreV2 => ({
  numero: "LM-2026-0001",
  trainerId: MOI,
  trainer: {
    prenom: "Marie",
    nom: "Dupont",
    statut: "sous_traitant",
    siret: "12345678900012",
    nda: "84380000000",
    regimeTvaHonoraires: "franchise_293b",
    mandatAutofacturationSigneAt: null,
    mandatAutofacturationRevoqueAt: null,
    organismeSousTraitantId: null,
  },
  contratCadre: { version: 3, signeLe: new Date("2026-10-02T10:00:00Z") },
  mission: MISSION,
  session: SESSION(jours),
  dateMission: new Date("2026-10-12T08:00:00Z"),
  ...over,
});

/** Ce que le PAIEMENT verse quand tout est signé, mois par mois, avec SES fonctions. */
function paiementToutSigne(
  jours: ReadonlyArray<JourSession>,
  affectes: ReadonlyArray<{ trainerId: string }>,
  tarif = 35_000,
  forfait: number | null = null,
): { verse: number; prevu: number } {
  const prevues = demiJourneesPrevues(
    journeesDuFormateur(jours, MOI, affectes).map((j) => ({
      jour: j.date.toISOString().slice(0, 10),
      heureDebut: j.heureDebut,
      heureFin: j.heureFin,
    })),
    PARAMETRES_ARGENT_FORMATEURS,
  );
  const c = {
    tarifJourneeHtCents: tarif,
    forfaitDeplacementParJourHtCents: forfait,
    regimeTva: "franchise_293b" as const,
  };
  let verse = 0;
  let prevu = 0;
  for (const mois of parMoisCivil(prevues)) {
    verse += calculerReleveDuMois(mois, c).totalHtCents;
    prevu += montantPrevuDuMoisHtCents(mois, c);
  }
  return { verse, prevu };
}

function totalLettre(f: FaitsLettreV2): number {
  const r = assemblerLettreV2(f);
  if (!r.ok) throw new Error(r.motif);
  return r.data.totalHtCents;
}

describe("1 — un seul découpage en demi-journées : celui du paiement", () => {
  // Contre-calcul : matin si début < 12:00, après-midi si fin > 13:30.
  const CAS: ReadonlyArray<[string, string, 1 | 2, number]> = [
    ["09:00", "13:00", 1, 17_500], // finit avant 13:30 : le matin seul
    ["12:00", "17:00", 1, 17_500], // commence à 12:00, pas avant : l'après-midi seul
    ["09:00", "17:00", 2, 35_000],
    ["13:30", "17:30", 1, 17_500],
  ];

  for (const [debut, fin, demi, cents] of CAS) {
    it(`${debut}-${fin} : ${demi} demi-journée(s), ${cents} c HT annoncés ET versés`, () => {
      const jours = [jourSession("2026-11-04", debut, fin)];
      expect(demiJourneesDuJour({ date: "2026-11-04", heureDebut: debut, heureFin: fin })).toBe(
        demi,
      );
      expect(totalLettre(faits(jours))).toBe(cents);
      expect(
        honorairesProposition({
          jours: [{ date: "2026-11-04", heureDebut: debut, heureFin: fin }],
          tarifJourneeHtCents: 35_000,
          forfaitDeplacementParJourHtCents: null,
          distanciel: false,
        })?.totalHtCents,
      ).toBe(cents);
      const p = paiementToutSigne(jours, [{ trainerId: MOI }]);
      expect(p.verse).toBe(cents);
      // L'écart « payé ≠ annoncé » ne se déclenche pas sur une mission juste.
      expect(p.prevu).toBe(cents);
    });
  }

  it("les quatre journées ensemble, avec forfait de 80 € : 87 500 + 32 000 = 119 500 c HT", () => {
    const jours = [
      jourSession("2026-11-04", "09:00", "13:00"),
      jourSession("2026-11-05", "12:00", "17:00"),
      jourSession("2026-11-06", "09:00", "17:00"),
      jourSession("2026-12-01", "13:30", "17:30"),
    ];
    const mission = { ...MISSION, forfaitDeplacementParJourHtCents: 8_000 };
    expect(totalLettre(faits(jours, { mission }))).toBe(119_500);
    expect(paiementToutSigne(jours, [{ trainerId: MOI }], 35_000, 8_000).verse).toBe(119_500);
  });

  it("la ligne du jour dit le créneau payé : 09:00-13:00 matin, 12:00-17:00 après-midi", () => {
    expect(ligneJour({ date: "2026-11-04", heureDebut: "09:00", heureFin: "13:00" })).toBe(
      "mercredi 4 novembre · matin",
    );
    expect(ligneJour({ date: "2026-11-04", heureDebut: "12:00", heureFin: "17:00" })).toBe(
      "mercredi 4 novembre · après-midi",
    );
  });
});

describe("2 — co-animation : la lettre ne compte que les journées du formateur", () => {
  // 4 journées 09:00-17:00 ; les 2 dernières sont à un AUTRE formateur.
  const jours = [
    jourSession("2026-11-04", "09:00", "17:00", MOI),
    jourSession("2026-11-05", "09:00", "17:00", null),
    jourSession("2026-11-06", "09:00", "17:00", AUTRE),
    jourSession("2026-11-07", "09:00", "17:00", AUTRE),
  ];
  const affectes = [{ trainerId: MOI }, { trainerId: AUTRE }];

  it("2 journées × 35 000 = 70 000 c HT, annoncées ET versées", () => {
    const f = faits(jours, { session: { ...SESSION(jours), affectes } });
    const r = assemblerLettreV2(f);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.journees).toBe(2);
    expect(r.data.jours.map((j) => j.date)).toEqual(["04/11/2026", "05/11/2026"]);
    expect(r.data.totalHtCents).toBe(70_000);
    expect(paiementToutSigne(jours, affectes).verse).toBe(70_000);
  });

  it("le forfait suit : 2 journées de déplacement × 8 000 = 16 000 c HT", () => {
    const f = faits(jours, {
      session: { ...SESSION(jours), affectes },
      mission: { ...MISSION, forfaitDeplacementParJourHtCents: 8_000 },
    });
    expect(totalLettre(f)).toBe(86_000);
    expect(paiementToutSigne(jours, affectes, 35_000, 8_000).verse).toBe(86_000);
  });

  it("aucune journée pour lui : pas de lettre", () => {
    const seulementAutre = [jourSession("2026-11-06", "09:00", "17:00", AUTRE)];
    const r = assemblerLettreV2(
      faits(seulementAutre, { session: { ...SESSION(seulementAutre), affectes } }),
    );
    expect(r.ok).toBe(false);
  });
});

describe("3 — sans conditions figées, aucune lettre (jamais 350 € par défaut)", () => {
  const jours = [jourSession("2026-11-04", "09:00", "17:00")];

  it("tarif non figé : refus, motif clair", () => {
    const r = assemblerLettreV2(faits(jours, { mission: { ...MISSION, tarifHtCents: null } }));
    expect(r).toEqual({ ok: false, motif: expect.stringMatching(/tarif.*n'est pas figé/i) });
  });

  it("régime de TVA non figé : refus aussi (le paiement ne verserait rien)", () => {
    const r = assemblerLettreV2(faits(jours, { mission: { ...MISSION, regimeTvaFige: null } }));
    expect(r).toEqual({ ok: false, motif: expect.stringMatching(/TVA.*n'est pas figé/i) });
  });
});

describe("l'annonce de la lettre, mois par mois, pour l'écart avec le paiement", () => {
  it("novembre 52 500, décembre 17 500 : la part de chaque mois au centime", () => {
    const jours = [
      jourSession("2026-11-04", "09:00", "17:00"),
      jourSession("2026-11-05", "09:00", "13:00"),
      jourSession("2026-12-01", "13:30", "17:30"),
    ];
    const r = assemblerLettreV2(faits(jours));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.annonce.parMois).toEqual({ "2026-11": 52_500, "2026-12": 17_500 });
    expect(r.annonce.totalHtCents).toBe(70_000);
    expect(r.data.totalHtCents).toBe(70_000);
  });
});
