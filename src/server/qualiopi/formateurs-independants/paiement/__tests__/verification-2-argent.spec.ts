// @vitest-environment node

/**
 * Vérification 2, volet argent — les règles pures des correctifs V2-A-1 à V2-A-7.
 * Chaque attendu est recalculé ici à la main (centimes entiers, jours civils).
 *
 *   · V2-A-1 : 350 €/j ; A signe le 12 (sa journée) ET le 13 (journée de B) → A payé
 *     d'UNE journée, 35 000 c ; la journée de B n'est jamais payée deux fois ;
 *   · V2-A-2 : un intervenant d'organisme → aucun relevé à son nom ;
 *   · V2-A-3 : 350,01 €/j, 3 demi-journées en mai puis 1 en juin → mai ⌊3 × 35 001 / 2⌋ =
 *     52 501, juin ⌊4 × 35 001 / 2⌋ − 52 501 = 70 002 − 52 501 = 17 501 ; total 70 002 =
 *     2 × 35 001 ;
 *   · V2-A-4 : journées désignées au désisté → au remplaçant, plus au désisté ;
 *   · V2-A-5 : tout complet le 05/10/2026 → au plus tard le 04/11/2026, même si
 *     l'autofacture part le 01/12/2026 (qui ferait le 31/12/2026) ;
 *   · V2-A-7 : émise le 01/09/2040, saisie « jusqu'au 31/12/2099 » → valable jusqu'au
 *     01/03/2041 (émission + 6 mois), jamais 2099.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import {
  calculerReleveDuMois,
  montantAnimationDuMoisCents,
  montantPrevuDuMoisHtCents,
} from "../../argent/calcul-mission";
import { demiJourneesSignees, parMoisCivil } from "@/server/qualiopi/remuneration/heures-animees";

import { desistesDeLaSession, journeesDuFormateur } from "../../argent/journees-du-formateur";
import { echeanceAutofactureMission } from "../echeance-autofacture";
import { jourOuToutEtaitComplet } from "../jour-complet";
import { planifierPassage, type CandidatMission } from "../passage-mission";
import { finDeValiditeAttestation } from "../virement-mission-base";

const TARIF = 35_000;
const CONDITIONS = {
  tarifJourneeHtCents: TARIF,
  forfaitDeplacementParJourHtCents: null,
  regimeTva: "franchise_293b" as const,
};
const JOUR = (jour: string) => ({ jour, heureDebut: "09:00", heureFin: "17:00" });
const SIG = (jour: string) => ({ jour, demiJournee: "journee" as const });

function candidat(over: Partial<CandidatMission> = {}): CandidatMission {
  return {
    trainerId: "a",
    sessionId: "s1",
    premiereJournee: "2040-03-12",
    conditions: CONDITIONS,
    contresignatures: [SIG("2040-03-12")],
    journeesPrevues: [JOUR("2040-03-12")],
    conditionFinanceurEnAttente: false,
    ...over,
  };
}

describe("V2-A-1 — la journée désignée à l'autre n'est jamais payée deux fois", () => {
  it("A signe sa journée ET celle de B : A payé d'une journée, anomalie, B payé de la sienne", () => {
    const p = planifierPassage(
      [
        candidat({ contresignatures: [SIG("2040-03-12"), SIG("2040-03-13")] }),
        candidat({
          trainerId: "b",
          contresignatures: [SIG("2040-03-13")],
          journeesPrevues: [JOUR("2040-03-13")],
        }),
      ],
      "2040-01-01",
    );
    expect(p.aEcrire.map((m) => [m.trainerId, m.releve.totalHtCents])).toEqual([
      ["a", 35_000],
      ["b", 35_000],
    ]);
    expect(p.aEcrire.reduce((t, m) => t + m.releve.totalHtCents, 0)).toBe(2 * TARIF);
    expect(p.anomalies).toEqual([{ trainerId: "a", sessionId: "s1", motif: "signee_hors_prevu" }]);
  });

  it("contre-témoin : sans signature hors de ses journées, aucune anomalie", () => {
    const p = planifierPassage([candidat()], "2040-01-01");
    expect(p.anomalies).toEqual([]);
    expect(p.aEcrire).toHaveLength(1);
  });
});

describe("V2-A-2 — intervenant d'un organisme : rien à son nom", () => {
  it("aucun relevé écrit, une anomalie « intervenant_organisme »", () => {
    const p = planifierPassage([candidat({ intervenantOrganisme: true })], "2040-01-01");
    expect(p.aEcrire).toEqual([]);
    expect(p.anomalies).toEqual([
      { trainerId: "a", sessionId: "s1", motif: "intervenant_organisme" },
    ]);
  });
});

describe("V2-A-3 — le centime du reliquat n'est jamais perdu entre deux mois", () => {
  const IMPAIR = { ...CONDITIONS, tarifJourneeHtCents: 35_001 };

  it("montantAnimationDuMoisCents : 52 501 puis 17 501, total 70 002", () => {
    expect(montantAnimationDuMoisCents(3, 35_001)).toBe(52_501);
    expect(montantAnimationDuMoisCents(1, 35_001, 3)).toBe(17_501);
    expect(montantAnimationDuMoisCents(1, 35_001)).toBe(17_500);
  });

  it("le passage : mai 52 501, juin 17 501 = 2 × 35 001 ; le prévu concorde (sans écart)", () => {
    const p = planifierPassage(
      [
        candidat({
          premiereJournee: "2040-05-30",
          conditions: IMPAIR,
          contresignatures: [
            SIG("2040-05-30"),
            { jour: "2040-05-31", demiJournee: "matin" },
            { jour: "2040-06-01", demiJournee: "matin" },
          ],
          journeesPrevues: [
            JOUR("2040-05-30"),
            { jour: "2040-05-31", heureDebut: "09:00", heureFin: "12:30" },
            { jour: "2040-06-01", heureDebut: "09:00", heureFin: "12:30" },
          ],
        }),
      ],
      "2040-01-01",
    );
    expect(p.aEcrire.map((m) => [m.releve.mois, m.releve.totalHtCents, m.sansEcart])).toEqual([
      ["2040-05", 52_501, true],
      ["2040-06", 17_501, true],
    ]);
    expect(p.aEcrire.reduce((t, m) => t + m.releve.totalHtCents, 0)).toBe(2 * 35_001);
  });

  it("relecture #1552 n°2 — l'ordre de paiement ne change pas le total : 52 501, jamais 52 502", () => {
    // Mai prévoit une journée (2 demi-journées), juin une demi-journée. Premier passage :
    // mai n'a que son matin signé (il attend), juin passe seul. Second passage : mai complet.
    const prevues = [
      JOUR("2040-05-30"),
      { jour: "2040-06-01", heureDebut: "09:00", heureFin: "12:30" },
    ];
    const juinMatin = { jour: "2040-06-01", demiJournee: "matin" as const };
    const premier = planifierPassage(
      [
        candidat({
          premiereJournee: "2040-05-30",
          conditions: IMPAIR,
          contresignatures: [{ jour: "2040-05-30", demiJournee: "matin" }, juinMatin],
          journeesPrevues: prevues,
        }),
      ],
      "2040-01-01",
    );
    expect(premier.aEcrire.map((m) => m.releve.mois)).toEqual(["2040-06"]);
    const second = planifierPassage(
      [
        candidat({
          premiereJournee: "2040-05-30",
          conditions: IMPAIR,
          contresignatures: [SIG("2040-05-30"), juinMatin],
          journeesPrevues: prevues,
        }),
      ],
      "2040-01-01",
    );
    const juin = premier.aEcrire[0]!.releve.totalHtCents;
    const mai = second.aEcrire.find((m) => m.releve.mois === "2040-05")!.releve.totalHtCents;
    // Le même juin, quel que soit l'ordre : celui du second passage concorde.
    expect(second.aEcrire.find((m) => m.releve.mois === "2040-06")!.releve.totalHtCents).toBe(juin);
    expect([mai, juin]).toEqual([35_001, 17_500]);
    expect(mai + juin).toBe(Math.floor((3 * 35_001) / 2));
  });

  it("sans mois antérieur, rien ne change : une demi-journée 17 500, une journée 35 001", () => {
    const [mois] = parMoisCivil(demiJourneesSignees([SIG("2040-05-30")]));
    expect(calculerReleveDuMois(mois!, IMPAIR).totalHtCents).toBe(35_001);
    expect(montantPrevuDuMoisHtCents({ demiJournees: 1, journees: 1 }, IMPAIR)).toBe(17_500);
  });
});

describe("V2-A-4 — la désignation d'un formateur désisté est caduque", () => {
  const jours = [
    { date: "2041-01-14", trainerId: "r1" },
    { date: "2041-01-15", trainerId: "r1" },
  ];
  const affectes = [{ trainerId: "r2" }];
  const desistes = desistesDeLaSession(
    [
      { trainerId: "r2", statut: "acceptee" },
      { trainerId: "r1", statut: "desistee" },
    ],
    affectes,
  );

  it("les désistés : sollicitation la plus récente `desistee` et plus affecté", () => {
    expect([...desistes]).toEqual(["r1"]);
    // Re-sollicité et accepté depuis : plus désisté.
    expect([
      ...desistesDeLaSession(
        [
          { trainerId: "r1", statut: "acceptee" },
          { trainerId: "r1", statut: "desistee" },
        ],
        [{ trainerId: "r1" }],
      ),
    ]).toEqual([]);
  });

  it("les deux journées vont au remplaçant ; le désisté n'en a plus aucune", () => {
    expect(journeesDuFormateur(jours, "r2", affectes, desistes).map((j) => j.date)).toEqual([
      "2041-01-14",
      "2041-01-15",
    ]);
    expect(journeesDuFormateur(jours, "r1", affectes, desistes)).toEqual([]);
  });

  it("co-animation : la journée caduque va au remplaçant, pas à la co-formatrice désignée", () => {
    const coAnimation = [
      { date: "2041-01-14", trainerId: "r1" },
      { date: "2041-01-15", trainerId: "b" },
    ];
    const deux = [{ trainerId: "b" }, { trainerId: "r2" }];
    const d = desistesDeLaSession([{ trainerId: "r1", statut: "desistee" }], deux);
    expect(journeesDuFormateur(coAnimation, "r2", deux, d).map((j) => j.date)).toEqual([
      "2041-01-14",
    ]);
    expect(journeesDuFormateur(coAnimation, "b", deux, d).map((j) => j.date)).toEqual([
      "2041-01-15",
    ]);
  });

  it("contre-témoin : sans désistés connus, la règle d'avant (rien au remplaçant)", () => {
    expect(journeesDuFormateur(jours, "r2", affectes)).toEqual([]);
    expect(journeesDuFormateur(jours, "r1", affectes).map((j) => j.date)).toEqual([
      "2041-01-14",
      "2041-01-15",
    ]);
  });
});

describe("V2-A-5 — la date limite part du jour où tout était complet", () => {
  const base = {
    jourAutofacture: "2026-12-01",
    echeanceDuReleve: "2026-11-04",
    remplace: false,
    objets: ["animation"],
  } as const;

  it("validation tardive : 04/11 (complet le 05/10 + 30), pas 31/12 (clic du 01/12 + 30)", () => {
    expect(echeanceAutofactureMission({ ...base, echeanceDuJourComplet: "2026-11-04" })).toBe(
      "2026-11-04",
    );
  });

  it("relecture #1552 n°7 — à date fixe aussi, la plus proche des trois dates", () => {
    expect(
      echeanceAutofactureMission({
        jourAutofacture: "2026-12-01",
        echeanceDuReleve: "2026-12-20",
        remplace: false,
        objets: ["indemnite_annulation"],
        echeanceDuJourComplet: "2026-11-04",
      }),
    ).toBe("2026-11-04");
    // Contre-témoin : l'échéance à date fixe plus proche reste gardée.
    expect(
      echeanceAutofactureMission({
        jourAutofacture: "2026-12-01",
        echeanceDuReleve: "2026-11-01",
        remplace: false,
        objets: ["indemnite_annulation"],
        echeanceDuJourComplet: "2026-11-04",
      }),
    ).toBe("2026-11-01");
  });

  it("jamais au-delà de la facture + 30 : le plus proche des deux", () => {
    expect(echeanceAutofactureMission({ ...base, echeanceDuJourComplet: "2027-01-10" })).toBe(
      "2026-12-31",
    );
  });

  it("jourOuToutEtaitComplet : la DERNIÈRE pièce arrivée (feuille ou bilan), jour de Paris", () => {
    expect(
      jourOuToutEtaitComplet({
        feuilles: [new Date("2026-10-04T16:30:00Z"), new Date("2026-10-05T16:30:00Z")],
        bilan: null,
      }),
    ).toBe("2026-10-05");
    expect(
      jourOuToutEtaitComplet({
        feuilles: [new Date("2026-10-05T16:30:00Z")],
        bilan: new Date("2026-10-20T22:30:00Z"),
      }),
    ).toBe("2026-10-21");
    expect(jourOuToutEtaitComplet({ feuilles: [], bilan: null })).toBeNull();
  });
});

describe("V2-A-7 — l'attestation URSSAF vaut au plus émission + 6 mois", () => {
  it("saisie « jusqu'en 2099 » : plafonnée au 01/03/2041", () => {
    expect(
      finDeValiditeAttestation({
        dateEmission: new Date("2040-09-01T00:00:00Z"),
        dateExpiration: new Date("2099-12-31T00:00:00Z"),
      }),
    ).toBe("2041-03-01");
  });

  it("une fin saisie plus proche que le plafond est gardée", () => {
    expect(
      finDeValiditeAttestation({
        dateEmission: new Date("2041-01-10T00:00:00Z"),
        dateExpiration: new Date("2041-05-10T00:00:00Z"),
      }),
    ).toBe("2041-05-10");
  });

  it("relecture #1552 n°6 — une date d'émission FUTURE (faute de frappe) ne prouve rien", () => {
    const maintenant = new Date("2040-10-01T10:00:00Z");
    expect(
      finDeValiditeAttestation(
        {
          dateEmission: new Date("2041-09-01T00:00:00Z"),
          dateExpiration: new Date("2099-12-31T00:00:00Z"),
        },
        maintenant,
      ),
    ).toBeNull();
    // Contre-témoin : émise avant « maintenant », elle garde son plafond.
    expect(
      finDeValiditeAttestation(
        {
          dateEmission: new Date("2040-09-01T00:00:00Z"),
          dateExpiration: new Date("2099-12-31T00:00:00Z"),
        },
        maintenant,
      ),
    ).toBe("2041-03-01");
  });

  it("sans date d'émission ou sans fin saisie : ne prouve rien", () => {
    expect(
      finDeValiditeAttestation({ dateEmission: null, dateExpiration: new Date("2041-05-10") }),
    ).toBeNull();
    expect(
      finDeValiditeAttestation({ dateEmission: new Date("2041-01-10"), dateExpiration: null }),
    ).toBeNull();
  });
});
