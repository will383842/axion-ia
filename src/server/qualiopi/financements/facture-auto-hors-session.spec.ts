/**
 * 🔴 UNE SESSION DÉJÀ FACTURÉE PAR UNE FACTURE NON RATTACHÉE N'EST PAS REFACTURÉE
 * — relecture A09 de la PR 1097, dette n° 5.
 *
 * Une « facture libre » (Hub facturation), une facture reprise d'historique ou
 * un plan récurrent ne portent pas de `sessionId`. L'automate ne voyait que les
 * factures rattachées à la session : une prestation déjà facturée ainsi aurait
 * reçu une seconde facture le lendemain.
 *
 * Désormais, avant d'émettre, l'automate cherche une facture vivante NON
 * rattachée qui pourrait couvrir la prestation :
 *   - même devis que la session ;
 *   - même dossier de financement ;
 *   - même client (par fiche ou, pour une reprise d'historique, par raison
 *     sociale), activité formation ou non renseignée, émise depuis 90 jours
 *     avant le début de la session.
 * Dans le doute il ne facture pas, et l'alerte demande de vérifier. Faux positif
 * accepté ; doublon interdit.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  etatVide,
  factureFausse,
  sessionEligible,
  type EtatFaux,
} from "./__tests__/fausse-base-facture-auto";

const h = vi.hoisted(() => ({
  etat: null as unknown as EtatFaux,
  journal: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  emettre: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("@/lib/prisma", async () => {
  const { vi: v } = await import("vitest");
  const { etatVide: vide, faussePrisma: fausse } =
    await import("./__tests__/fausse-base-facture-auto");
  h.etat = vide();
  h.journal = v.fn();
  return { prisma: fausse(h.etat, h.journal) };
});
vi.mock("./facture-formation-emission", async () => {
  const { vi: v } = await import("vitest");
  h.emettre = v.fn();
  return {
    emettreFactureFormationSession: (...a: unknown[]) => h.emettre(...a),
    genererPdfFactureFormation: vi.fn(async (factureId: string) => ({
      data: { factureId, documentId: "doc" },
    })),
  };
});
vi.mock("./facture-envoi-email", () => ({
  preparerEnvoiFactureEmail: vi.fn(async () => ({
    data: {
      enqueued: false,
      garePourValidation: true,
      to: "x",
      numero: "n",
      estAvoir: false,
      pdfHash: "h",
    },
  })),
}));

import { casFactureAutoASignaler } from "./facture-auto-regles";
import { genererFacturesDuLendemain } from "./facture-auto-session";

const LENDEMAIN = new Date("2026-10-06T09:30:00.000Z");
const BALAYAGE = new Date("2026-10-07T07:00:00.000Z");

/** Une facture NON rattachée à la session, vivante, du même client. */
const libre = (over: Parameters<typeof factureFausse>[0] = {}) =>
  factureFausse({
    id: "f-libre",
    numero: "AXI-FACT-2026-061",
    sessionId: null,
    emiseAt: new Date("2026-10-01T10:00:00.000Z"),
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    ...over,
  });

beforeEach(() => {
  Object.assign(h.etat, etatVide());
  h.journal.mockReset().mockResolvedValue({});
  h.emettre.mockReset().mockResolvedValue({
    data: {
      factureId: "f-auto",
      numero: "AXI-FACT-2026-099",
      documentId: null,
      destinataire: "entreprise",
      ventilation: "forfait",
      totalHtCents: 150000,
    },
  });
  h.etat.sessions = [sessionEligible("s-1")];
});

describe("🔴 facture non rattachée qui peut couvrir la prestation : on ne facture PAS", () => {
  it.each([
    ["même client, activité formation, émise avant la session", {}],
    ["même client, activité non renseignée", { activite: null }],
    [
      "même devis, même sans client",
      { clientId: null, destinataireNom: "Autre", devisId: "devis-1" },
    ],
    [
      "même dossier de financement, même sans client",
      { clientId: null, destinataireNom: "Autre", dossierFinancementId: "dos-1" },
    ],
    ["reprise d'historique : même raison sociale, aucune fiche client", { clientId: null }],
    ["un brouillon compte", { statut: "brouillon" }],
  ])("%s", async (_nom, over) => {
    h.etat.sessions = [
      sessionEligible("s-1", {
        devisId: "devis-1",
        dossiersFinancement: [{ id: "dos-1", payeurs: [] }],
      }),
    ];
    h.etat.factures = [libre(over)];

    const bilan = await genererFacturesDuLendemain(LENDEMAIN);

    expect(h.emettre).not.toHaveBeenCalled();
    expect(bilan.nonAutomatisables).toBe(1);
  });

  it("l'alerte demande de VÉRIFIER, et nomme la facture", async () => {
    h.etat.factures = [libre()];
    const cas = await casFactureAutoASignaler(BALAYAGE);
    expect(cas).toHaveLength(1);
    expect(cas[0]).toMatchObject({ cibleType: "TrainingSession", cibleId: "s-1" });
    expect(cas[0]!.message).toContain("AXI-FACT-2026-061");
    expect(cas[0]!.message).toMatch(/vérifi/i);
  });
});

describe("TÉMOINS : ce qui ne peut pas couvrir la prestation n'empêche rien", () => {
  it.each([
    [
      "un autre client, autre devis, autre dossier",
      { clientId: "client-2", destinataireNom: "Autre" },
    ],
    ["une autre activité (audit) du même client", { activite: "audit" }],
    [
      "émise plus de 90 jours avant le début de la session",
      {
        emiseAt: new Date("2026-06-01T10:00:00.000Z"),
        createdAt: new Date("2026-06-01T10:00:00.000Z"),
      },
    ],
    ["annulée", { statut: "annulee" }],
    ["entièrement rectifiée par avoir", { avoirs: [{ statut: "emise", montantHtCents: -150000 }] }],
    ["rattachée à UNE AUTRE session", { sessionId: "s-autre" }],
  ])("%s", async (_nom, over) => {
    h.etat.factures = [libre(over)];
    await genererFacturesDuLendemain(LENDEMAIN);
    expect(h.emettre).toHaveBeenCalledTimes(1);
  });
});
