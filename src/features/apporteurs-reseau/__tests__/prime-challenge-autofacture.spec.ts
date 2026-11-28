import { beforeEach, describe, expect, it, vi } from "vitest";

// PR H (#2464) : la prime d'un challenge est une `CommissionApporteur` (`activite = prime_challenge`,
// `factureId` = identifiant de la prime). Elle se facture sur une LIGNE DISTINCTE de l'autofacture,
// au montant HT exact, avec la TVA du régime du jour d'émission, figée sur la pièce.

const captures = vi.hoisted(() => ({ donnees: [] as Array<Record<string, unknown>> }));
const CHALLENGE = "5b0c7e0e-6f0e-4d57-9a64-0d9d6b1f4a10";
const PRIME = "9c1d0f3a-2b4e-4c8a-8f55-3a7e6d5c4b21";

vi.mock("@/lib/prisma", async () => {
  const h = await import("./simulateur-tva");
  return {
    prisma: {
      ...h.prisma,
      challengeApporteur: {
        findMany: async (a: { where: { id: { in: string[] } } }) =>
          a.where.id.in.includes(CHALLENGE)
            ? [{ id: CHALLENGE, titre: "Challenge de décembre" }]
            : [],
      },
    },
  };
});
vi.mock("../annuaire", () => ({
  lireEntrepriseParSiren: vi.fn(async (siren: string) => ({
    ok: true,
    entreprise: { siren, active: true },
  })),
}));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("@/lib/destinataires-internes", () => ({
  destinataireAlertesInternes: () => "will@interne",
}));
vi.mock("../jeton", () => ({ urlDossier: () => null }));
vi.mock("../envois", () => ({
  envoyer: vi.fn(async () => "envoye"),
  envoyerConfirmationVirement: vi.fn(async () => "envoye"),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(async () => ({ enqueued: true })),
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: async () => ({ raisonSociale: "Axion IA" }),
}));
vi.mock("@/server/qualiopi/documents/render", () => ({
  renderPdfToBuffer: async (el: { props: { data: Record<string, unknown> } }) => {
    captures.donnees.push(el.props.data);
    return { buffer: Buffer.from("pdf") };
  },
  storeAndSignPdf: vi.fn(async () => "https://signe"),
}));
vi.mock("@/server/qualiopi/documents/templates/autofacture-honoraires", () => ({
  AutofactureHonorairesPdf: () => null,
}));

import * as h from "./simulateur-tva";
import { facturerApporteur } from "../facturation";
import { oublierPiecesFigeesDisponible } from "../tva-pieces";
import { oublierLitigeDisponible } from "../litige";

const { etat, ligne } = h;
const MARDI = new Date("2026-10-06T09:00:00Z");
const prime = (id: string, montant: number) =>
  ligne(id, "due", montant, {
    activite: "prime_challenge",
    palier: `challenge:${CHALLENGE}`,
    factureId: PRIME,
    factureHtCents: 0,
  });

beforeEach(() => {
  h.remettreAZero();
  captures.donnees.length = 0;
  oublierPiecesFigeesDisponible();
  oublierLitigeDisponible();
});

describe("la prime d'un challenge sur l'autofacture", () => {
  it("ligne distincte, libellée avec le titre, montant HT exact (franchise 293 B : aucune TVA)", async () => {
    etat.apporteurs["APP1"] = { regimeTva: "franchise_293b", numeroTva: null };
    etat.lignes = [ligne("c1", "due", 12_000), prime("p1", 50_000)];
    const r = await facturerApporteur("APP1", MARDI);
    expect(r).toMatchObject({ ok: true, totalCents: 62_000, commissions: 2 });
    const lignes = captures.donnees[0]!["lignes"] as Array<{
      designation: string;
      montantHtCents: number;
    }>;
    expect(lignes).toHaveLength(2);
    const l = lignes.find((x) => x.designation.startsWith("Prime exceptionnelle"))!;
    expect(l.designation).toBe(
      "Prime exceptionnelle — Challenge de décembre (complément de commission)",
    );
    expect(l.montantHtCents).toBe(50_000);
    expect(captures.donnees[0]!["regimeHonoraires"]).toBe("franchise_293b");
    expect(etat.pieces[0]).toMatchObject({
      genre: "facture",
      regimeTva: "franchise_293b",
      numeroTva: null,
      totalHtCents: 62_000,
      totalTvaCents: 0,
      totalTtcCents: 62_000,
    });
  });

  it("assujetti : TVA 20 % sur la prime, pièce figée au régime du jour d'émission", async () => {
    etat.apporteurs["APP1"] = { regimeTva: "assujetti", numeroTva: "FR00123456782" };
    etat.lignes = [prime("p1", 50_000)];
    const r = await facturerApporteur("APP1", MARDI);
    expect(r).toMatchObject({ ok: true, totalCents: 60_000 });
    expect(etat.pieces[0]).toMatchObject({
      regimeTva: "assujetti",
      numeroTva: "FR00123456782",
      totalHtCents: 50_000,
      totalTvaCents: 10_000,
      totalTtcCents: 60_000,
      origine: "emission",
      emiseAt: MARDI,
    });
    // Le régime change APRÈS l'émission : la pièce reste figée.
    etat.apporteurs["APP1"] = { regimeTva: "franchise_293b", numeroTva: null };
    expect(etat.pieces[0]!.regimeTva).toBe("assujetti");
  });

  it("titre introuvable : repli « Prime exceptionnelle »", async () => {
    etat.apporteurs["APP1"] = { regimeTva: "franchise_293b", numeroTva: null };
    etat.lignes = [
      ligne("p2", "due", 10_000, {
        activite: "prime_challenge",
        palier: "challenge:00000000-0000-4000-8000-000000000000",
        factureId: PRIME,
        factureHtCents: 0,
      }),
    ];
    await facturerApporteur("APP1", MARDI);
    const lignes = captures.donnees[0]!["lignes"] as Array<{ designation: string }>;
    expect(lignes[0]!.designation).toBe("Prime exceptionnelle");
  });

  it("l'échéance d'une prime part de l'émission (aucun paiement client à attendre)", async () => {
    etat.apporteurs["APP1"] = { regimeTva: "franchise_293b", numeroTva: null };
    etat.lignes = [prime("p1", 50_000)];
    await facturerApporteur("APP1", MARDI);
    expect(captures.donnees[0]!["dateEcheance"]).toBe("5 novembre 2026");
  });
});
