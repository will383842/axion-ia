// @vitest-environment node

/**
 * Lot D (M6) — aucun virement d'un relevé de mission sans contrat-cadre SIGNÉ
 * et sans SIREN ACTIF confirmé, contrôlés côté serveur au clic.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const lireContratCadreSigne = vi.fn();
const entrepriseActiveAuPaiement = vi.fn();
const entrepriseActiveConfirmeeEnBase = vi.fn();

vi.mock("@/server/qualiopi/formateurs-independants/contrat-cadre-en-vigueur", () => ({
  lireContratCadreSigne: (...a: unknown[]) => lireContratCadreSigne(...a),
}));
vi.mock("@/server/qualiopi/documents/signature/contrat-cadre-signature", () => ({
  entrepriseActiveAuPaiement: (...a: unknown[]) => entrepriseActiveAuPaiement(...a),
  entrepriseActiveConfirmeeEnBase: (...a: unknown[]) => entrepriseActiveConfirmeeEnBase(...a),
}));

import {
  garantiesPaiementMission,
  garantiesPaiementMissionSousVerrou,
  LIBELLE_GARANTIE_PAIEMENT,
} from "../garanties-paiement-mission";

const T = "22222222-2222-4222-8222-222222222222";
const MAINTENANT = new Date("2032-01-02T10:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  lireContratCadreSigne.mockResolvedValue({ version: 3, signeLe: new Date("2031-01-01") });
  entrepriseActiveAuPaiement.mockResolvedValue(true);
  entrepriseActiveConfirmeeEnBase.mockResolvedValue(true);
});

describe("garanties du paiement d'une mission", () => {
  it("contrat signé et SIREN actif : aucun motif", async () => {
    expect(await garantiesPaiementMission(T, MAINTENANT, "admin")).toEqual([]);
    expect(entrepriseActiveAuPaiement).toHaveBeenCalledWith(T, MAINTENANT, "admin");
  });

  it("sans contrat-cadre signé : refus, le registre n'est même pas relu", async () => {
    lireContratCadreSigne.mockResolvedValue(null);
    expect(await garantiesPaiementMission(T, MAINTENANT, null)).toEqual(["contrat_cadre_absent"]);
    expect(entrepriseActiveAuPaiement).not.toHaveBeenCalled();
  });

  it("SIREN non confirmé actif (fermé, introuvable, registre muet) : refus", async () => {
    entrepriseActiveAuPaiement.mockResolvedValue(false);
    expect(await garantiesPaiementMission(T, MAINTENANT, null)).toEqual(["siren_non_confirme"]);
  });

  it("une lecture en échec vaut refus, jamais un paiement", async () => {
    lireContratCadreSigne.mockRejectedValue(new Error("base"));
    expect(await garantiesPaiementMission(T, MAINTENANT, null)).toEqual(["contrat_cadre_absent"]);
    lireContratCadreSigne.mockResolvedValue({ version: 3, signeLe: new Date() });
    entrepriseActiveAuPaiement.mockRejectedValue(new Error("registre"));
    expect(await garantiesPaiementMission(T, MAINTENANT, null)).toEqual(["siren_non_confirme"]);
  });

  it("chaque motif a un libellé pour l'opérateur", () => {
    expect(LIBELLE_GARANTIE_PAIEMENT.contrat_cadre_absent).toMatch(/contrat-cadre/);
    expect(LIBELLE_GARANTIE_PAIEMENT.siren_non_confirme).toMatch(/SIREN/);
  });
});

describe("chantier C4 (défaut 5) — les mêmes garanties RELUES sous verrou", () => {
  const tx = { tx: true } as never;

  it("tout tient : aucun motif ; lu avec le client de la TRANSACTION, sans appel au registre", async () => {
    expect(await garantiesPaiementMissionSousVerrou(tx, T, MAINTENANT)).toEqual([]);
    expect(lireContratCadreSigne).toHaveBeenCalledWith(T, tx);
    expect(entrepriseActiveConfirmeeEnBase).toHaveBeenCalledWith(tx, T, MAINTENANT);
    expect(entrepriseActiveAuPaiement).not.toHaveBeenCalled();
  });

  it("contrat-cadre annulé entre-temps : refus", async () => {
    lireContratCadreSigne.mockResolvedValue(null);
    expect(await garantiesPaiementMissionSousVerrou(tx, T, MAINTENANT)).toEqual([
      "contrat_cadre_absent",
    ]);
  });

  it("dernier contrôle du registre non confirmé, ou lecture en échec : refus", async () => {
    entrepriseActiveConfirmeeEnBase.mockResolvedValue(false);
    expect(await garantiesPaiementMissionSousVerrou(tx, T, MAINTENANT)).toEqual([
      "siren_non_confirme",
    ]);
    entrepriseActiveConfirmeeEnBase.mockRejectedValue(new Error("base"));
    expect(await garantiesPaiementMissionSousVerrou(tx, T, MAINTENANT)).toEqual([
      "siren_non_confirme",
    ]);
  });
});
