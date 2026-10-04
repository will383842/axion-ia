/**
 * Alerte `subrogation_incompatible_regime` (lot OPCO A7c, manque n°5 de la
 * critique de complétude) : session subrogée, non facturée, dont le régime
 * calculé est `remboursement_entreprise` sans `subrogationConfirmeeParAccord`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { trainingSession: { findMany: mockFindMany } } }));

import {
  candidatsSubrogationIncompatibleRegime,
  regleSubrogationIncompatibleRegime,
} from "./regle-subrogation-incompatible-regime";
import { ALERTE_CATALOGUE } from "./catalogue";
import { guichetPourCode } from "./routage";

const J = (iso: string) => new Date(`${iso}T12:00:00.000Z`);
const NOW = J("2026-10-04");

type Dossier = {
  id: string;
  type: "opco" | "france_travail" | "cpf" | "mixte";
  accordAt: Date | null;
  accordEcritLe: Date | null;
  depotFaitLe: Date | null;
  subrogationConfirmeeParAccord: boolean | null;
  payeurs: { payeurType: string }[];
};

const dossier = (d: Partial<Dossier> = {}): Dossier => ({
  id: "d-1",
  type: "opco",
  accordAt: null,
  accordEcritLe: null,
  depotFaitLe: null,
  subrogationConfirmeeParAccord: null,
  payeurs: [],
  ...d,
});

// Atlas, 120 salariés, accord du 15/10/2026 : remboursement de l'entreprise.
const GRANDE = {
  id: "s-1",
  numero: "AXI-SES-101",
  client: { opco: "atlas", opcoIdentifie: null, effectif: 120 },
  dossiersFinancement: [dossier({ accordEcritLe: J("2026-10-15") })],
};

describe("candidatsSubrogationIncompatibleRegime", () => {
  it("lève : subrogation posée, régime « remboursement de l'entreprise », pas de confirmation", () => {
    const [a] = candidatsSubrogationIncompatibleRegime([GRANDE], NOW);
    expect(a?.code).toBe("subrogation_incompatible_regime");
    expect(a?.niveau).toBe("critique");
    expect(a?.cibleType).toBe("TrainingSession");
    expect(a?.cibleId).toBe("s-1");
    expect(a?.message).toContain("AXI-SES-101");
    expect(a?.message).toContain("Atlas");
    expect(a?.message).toContain("50 salariés ou plus");
  });

  it("vise la subrogation posée avant le 1/10/2026 sans dossier (Constructys, transitoire)", () => {
    const ancienne = {
      id: "s-2",
      numero: "AXI-SES-102",
      client: { opco: null, opcoIdentifie: "constructys", effectif: 8 },
      dossiersFinancement: [],
    };
    const [a] = candidatsSubrogationIncompatibleRegime([ancienne], NOW);
    expect(a?.code).toBe("subrogation_incompatible_regime");
    expect(a?.message).toContain("Constructys");
  });

  it("ne lève pas si l'accord écrit confirme le paiement direct", () => {
    const confirmee = {
      ...GRANDE,
      dossiersFinancement: [
        dossier({ accordEcritLe: J("2026-10-15"), subrogationConfirmeeParAccord: true }),
      ],
    };
    expect(candidatsSubrogationIncompatibleRegime([confirmee], NOW)).toEqual([]);
  });

  it("ne lève pas quand le régime permet la subrogation (accord antérieur à la réforme)", () => {
    const ancienRegime = {
      ...GRANDE,
      dossiersFinancement: [dossier({ accordEcritLe: J("2026-09-20") })],
    };
    expect(candidatsSubrogationIncompatibleRegime([ancienRegime], NOW)).toEqual([]);
  });

  it("ne lève pas sur un régime inconnu (effectif non renseigné) : avertissement, jamais alerte", () => {
    const inconnu = { ...GRANDE, client: { opco: "atlas", opcoIdentifie: null, effectif: null } };
    expect(candidatsSubrogationIncompatibleRegime([inconnu], NOW)).toEqual([]);
  });

  it("se résout quand la condition disparaît (effectif corrigé sous 50)", () => {
    const corrige = { ...GRANDE, client: { opco: "atlas", opcoIdentifie: null, effectif: 12 } };
    expect(candidatsSubrogationIncompatibleRegime([GRANDE], NOW)).toHaveLength(1);
    expect(candidatsSubrogationIncompatibleRegime([corrige], NOW)).toEqual([]);
  });
});

describe("regleSubrogationIncompatibleRegime — requête", () => {
  beforeEach(() => mockFindMany.mockReset());

  it("🔴 une session déjà facturée n'est jamais lue : la requête exclut toute facture émise", async () => {
    mockFindMany.mockResolvedValue([]);
    await regleSubrogationIncompatibleRegime(NOW);
    const where = mockFindMany.mock.calls[0]?.[0]?.where;
    expect(where.opcoSubrogation).toBe(true);
    expect(where.statut).toEqual({ in: ["planifiee", "en_cours", "realisee"] });
    expect(where.facturesFormation).toEqual({
      none: { statut: { notIn: ["brouillon", "annulee"] } },
    });
  });

  it("sélectionne `opco` ET `opcoIdentifie` (règle unique opcoDuClient)", async () => {
    mockFindMany.mockResolvedValue([GRANDE]);
    const alertes = await regleSubrogationIncompatibleRegime(NOW);
    const select = mockFindMany.mock.calls[0]?.[0]?.select;
    expect(select.client.select).toMatchObject({ opco: true, opcoIdentifie: true, effectif: true });
    expect(alertes).toHaveLength(1);
  });

  it("au catalogue : critique, guichet direction, résolution automatique", () => {
    const e = ALERTE_CATALOGUE["subrogation_incompatible_regime"];
    expect(e?.niveau).toBe("critique");
    expect(e?.resolutionAuto).toBe(true);
    expect(guichetPourCode("subrogation_incompatible_regime")).toBe("direction");
  });
});
