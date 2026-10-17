/**
 * Relecture de la PR 1561 (bloquant) — l'espace du formateur dit pourquoi son virement
 * attend un changement de compte : la règle C-1 du clic (`motifsChangementIbanDu`),
 * lue pour SA fiche (`session.trainerId`), au mois comme à la mission. Jamais l'IBAN.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  releves: vi.fn(),
  moi: vi.fn(),
  motifs: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { marque: "prisma" } }));
vi.mock("@/server/formateur/guard", () => ({
  requireFormateurLecture: async () => ({ trainerId: "t-moi" }),
}));
vi.mock("@/server/actions/formateur/desaccord.actions", () => ({
  signalerDesaccordFormAction: vi.fn(),
}));
vi.mock("@/server/qualiopi/formateurs-independants/paiement/lecture-passage", () => ({
  lireDateBascule: async () => null,
}));
vi.mock("@/server/qualiopi/formateurs-independants/paiement/virement-mission-base", () => ({
  relevesMissionEnAttenteAttestation: async () => new Set(),
  motifsChangementIbanDu: (...a: unknown[]) => h.motifs(...a),
}));
vi.mock("@/server/qualiopi/remuneration/queries", () => ({
  listRelevesDuFormateur: (...a: unknown[]) => h.releves(...a),
}));
vi.mock("@/server/qualiopi/remuneration/pilotage-formateurs", () => ({
  lireRemunerationDuFormateur: (...a: unknown[]) => h.moi(...a),
}));
vi.mock("../../_coquille", () => ({
  CoquilleFormateur: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { LIBELLE_CHANGEMENT_IBAN_FORMATEUR } from "@/server/qualiopi/formateurs-independants/paiement/virement-mission";

import Page from "../page";

function mensuel(over: Record<string, unknown> = {}) {
  return {
    id: "r-1",
    periodeYear: 2026,
    periodeMonth: 10,
    statut: "facture_recue",
    totalHtCents: 90_000,
    tvaCents: 18_000,
    totalTtcCents: 108_000,
    numeroFacture: "F-1",
    documentId: null,
    echeance: new Date("2026-12-01T12:00:00Z"),
    payeAt: null,
    contestationAvantAt: null,
    contesteeAt: null,
    deMission: false,
    estAvoir: false,
    avoirDeNumero: null,
    desaccordNonRetenu: false,
    contestable: false,
    ...over,
  };
}

async function rendu(): Promise<string> {
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.releves.mockResolvedValue([mensuel()]);
  h.moi.mockResolvedValue({ statut: "sous_traitant", situation: null, fixeMensuelBrutCents: null });
  h.motifs.mockResolvedValue([]);
});

describe("espace formateur — virement retenu par un changement d'IBAN", () => {
  it("relevé MENSUEL non payé, demande en attente : le motif est dit, pour SA fiche", async () => {
    h.motifs.mockResolvedValue(["compte_bancaire_a_valider"]);
    const html = await rendu();
    expect(html).toContain(LIBELLE_CHANGEMENT_IBAN_FORMATEUR.compte_bancaire_a_valider);
    expect(h.motifs.mock.calls[0]?.[1]).toBe("t-moi");
  });

  it("nouveau compte de moins de 48 h : le motif « 48 heures »", async () => {
    h.motifs.mockResolvedValue(["nouvel_iban_moins_de_48h"]);
    expect(await rendu()).toContain(LIBELLE_CHANGEMENT_IBAN_FORMATEUR.nouvel_iban_moins_de_48h);
  });

  it("relevé déjà payé : rien", async () => {
    h.releves.mockResolvedValue([mensuel({ statut: "paye", payeAt: new Date() })]);
    h.motifs.mockResolvedValue(["compte_bancaire_a_valider"]);
    expect(await rendu()).not.toContain("Virement en attente");
  });

  it("salarié : la règle n'est pas lue (inchangé)", async () => {
    h.moi.mockResolvedValue({ statut: "salarie", situation: null, fixeMensuelBrutCents: null });
    await rendu();
    expect(h.motifs).not.toHaveBeenCalled();
  });

  it("lecture en échec : l'écran n'affirme rien", async () => {
    h.motifs.mockRejectedValue(new Error("base"));
    expect(await rendu()).not.toContain("Virement en attente");
  });
});
