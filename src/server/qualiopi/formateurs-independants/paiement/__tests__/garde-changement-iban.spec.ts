// @vitest-environment node

/**
 * Relecture de #1561 (bloquant) — LA RÈGLE C-1 EST UNE SEULE FONCTION.
 *
 * Virement BLOQUÉ pendant la vérification d'un changement d'IBAN, puis tant que
 * `maintenant < max(demande + 48 h, validation)` (décision 72, V1-C-1). Elle n'était lue
 * que par le paiement par MISSION : un relevé MENSUEL d'indépendant, payé avant la date
 * de passage, partait pendant la vérification. `gardeChangementIban` est la règle,
 * `motifsChangementIbanDu` sa lecture ; la mission et le mensuel lisent les deux.
 */

import { describe, expect, it, vi } from "vitest";

import { gardeChangementIban, gardeVirementMission } from "../virement-mission";
import { motifsChangementIbanDu } from "../virement-mission-base";

const H = 3_600_000;
const DEMANDE = new Date("2026-11-02T09:00:00Z");
const VALIDATION = new Date("2026-11-03T15:00:00Z");
const accepte = { demandeA: DEMANDE, valideA: VALIDATION };
const a = (ms: number) => new Date(DEMANDE.getTime() + ms);

describe("gardeChangementIban — bornes de la fenêtre de 48 h", () => {
  it("demande en attente : « compte bancaire à valider », quelle que soit l'heure", () => {
    expect(
      gardeChangementIban({
        demandeIbanEnAttente: true,
        dernierChangementIban: null,
        maintenant: a(1000 * H),
      }),
    ).toEqual(["compte_bancaire_a_valider"]);
  });

  it("48 h moins 1 ms après la demande : bloqué", () => {
    expect(
      gardeChangementIban({
        demandeIbanEnAttente: false,
        dernierChangementIban: accepte,
        maintenant: a(48 * H - 1),
      }),
    ).toEqual(["nouvel_iban_moins_de_48h"]);
  });

  it("exactement 48 h après la demande : permis", () => {
    expect(
      gardeChangementIban({
        demandeIbanEnAttente: false,
        dernierChangementIban: accepte,
        maintenant: a(48 * H),
      }),
    ).toEqual([]);
  });

  it("validation APRÈS les 48 h : bloqué jusqu'à la validation, permis à la validation", () => {
    const tardive = { demandeA: DEMANDE, valideA: a(60 * H) };
    expect(
      gardeChangementIban({
        demandeIbanEnAttente: false,
        dernierChangementIban: tardive,
        maintenant: a(60 * H - 1),
      }),
    ).toEqual(["nouvel_iban_moins_de_48h"]);
    expect(
      gardeChangementIban({
        demandeIbanEnAttente: false,
        dernierChangementIban: tardive,
        maintenant: a(60 * H),
      }),
    ).toEqual([]);
  });

  it("aucun changement : rien", () => {
    expect(
      gardeChangementIban({
        demandeIbanEnAttente: false,
        dernierChangementIban: null,
        maintenant: a(0),
      }),
    ).toEqual([]);
  });

  it("la garde de la MISSION lit la même règle (aucune copie)", () => {
    const base = {
      derniereJournee: "2026-10-30",
      echeance: "2026-12-30",
      aujourdhui: "2026-11-04",
      totalTtcCents: 50_000,
      attestationsValidesJusquau: [],
      vigilanceExigible: false,
      ibanEmpreinteActuelle: "e",
      ibanEmpreinteAffichee: "e",
      finPourDeces: false,
    } as const;
    for (const ms of [0, 48 * H - 1, 48 * H, 60 * H]) {
      for (const enAttente of [false, true]) {
        const c = {
          demandeIbanEnAttente: enAttente,
          dernierChangementIban: accepte,
          maintenant: a(ms),
        };
        expect(gardeVirementMission({ ...base, ...c }).motifs).toEqual(gardeChangementIban(c));
      }
    }
  });
});

describe("motifsChangementIbanDu — la lecture partagée", () => {
  function db(enAttente: number, dernier: { createdAt: Date; traiteAt: Date | null } | null) {
    return {
      demandeChangementFormateur: {
        count: vi.fn().mockResolvedValue(enAttente),
        findFirst: vi.fn().mockResolvedValue(dernier),
      },
    };
  }

  it("lit les demandes d'IBAN DE CE formateur (en attente, puis la dernière acceptée)", async () => {
    const d = db(0, { createdAt: DEMANDE, traiteAt: VALIDATION });
    expect(await motifsChangementIbanDu(d, "t-1", a(48 * H - 1))).toEqual([
      "nouvel_iban_moins_de_48h",
    ]);
    expect(d.demandeChangementFormateur.count).toHaveBeenCalledWith({
      where: { trainerId: "t-1", nature: "iban", statut: "en_attente" },
    });
    expect(d.demandeChangementFormateur.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { trainerId: "t-1", nature: "iban", statut: "acceptee" },
        orderBy: { traiteAt: "desc" },
      }),
    );
    expect(await motifsChangementIbanDu(d, "t-1", a(48 * H))).toEqual([]);
  });

  it("demande en attente : « compte bancaire à valider »", async () => {
    expect(await motifsChangementIbanDu(db(1, null), "t-1", a(0))).toEqual([
      "compte_bancaire_a_valider",
    ]);
  });

  it("une lecture en échec REMONTE (l'appelant refuse : jamais « rien à signaler »)", async () => {
    const d = db(0, null);
    d.demandeChangementFormateur.count.mockRejectedValue(new Error("base"));
    await expect(motifsChangementIbanDu(d, "t-1", a(0))).rejects.toThrow("base");
  });
});
