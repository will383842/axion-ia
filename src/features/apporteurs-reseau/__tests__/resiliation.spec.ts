import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  apporteurStatut: "signe" as string | null,
  majApporteur: [] as Array<Record<string, unknown>>,
  presentations: [] as Array<Record<string, unknown>>,
  majPresentations: [] as Array<Record<string, unknown>>,
  commissionsExistantes: [] as Array<Record<string, unknown>>,
  origine: null as Record<string, unknown> | null,
  creees: [] as Array<Record<string, unknown>>,
  note: null as string | null,
  noteEcrite: null as string | null,
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    apporteurReseau: {
      findUnique: vi.fn(async (a: { select: Record<string, boolean> }) =>
        "noteInterne" in a.select
          ? { noteInterne: etat.note }
          : etat.apporteurStatut
            ? { id: "APP1", statut: etat.apporteurStatut }
            : null,
      ),
      updateMany: vi.fn(async (a: { where: { statut: string }; data: Record<string, unknown> }) => {
        if (etat.apporteurStatut !== a.where.statut) return { count: 0 };
        etat.majApporteur.push(a.data);
        etat.apporteurStatut = "resilie";
        return { count: 1 };
      }),
      update: vi.fn(async (a: { data: { noteInterne: string } }) => {
        etat.noteEcrite = a.data.noteInterne;
        return {};
      }),
    },
    presentationEntreprise: {
      findMany: vi.fn(async () => etat.presentations),
      update: vi.fn(async (a: Record<string, unknown>) => {
        etat.majPresentations.push(a);
        return {};
      }),
    },
    commissionApporteur: {
      findUnique: vi.fn(async () => etat.origine),
      findMany: vi.fn(async () => etat.commissionsExistantes),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        etat.creees.push(a.data);
        return a.data;
      }),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: async (cb: (tx: unknown) => unknown) => cb(prisma),
  };
  return { prisma };
});

import {
  enregistrerReprise,
  planResiliation,
  resilierApporteur,
  verifierReprise,
} from "../resiliation";
import { prisma } from "@/lib/prisma";

const MAINTENANT = new Date("2026-10-05T10:00:00Z");

beforeEach(() => {
  etat.apporteurStatut = "signe";
  etat.majApporteur = [];
  etat.presentations = [];
  etat.majPresentations = [];
  etat.commissionsExistantes = [];
  etat.origine = null;
  etat.creees = [];
  etat.note = null;
  etat.noteEcrite = null;
  vi.clearAllMocks();
});

describe("résiliation : effets de l'article 12", () => {
  it("12.1 : les attributions réservées ou protégées prennent fin, les autres ne sont pas touchées", () => {
    const plan = planResiliation(
      [
        { id: "r", statut: "reservee", protegeeJusquAt: null },
        { id: "c", statut: "confirmee", protegeeJusquAt: new Date("2027-01-01T00:00:00Z") },
        { id: "t", statut: "terminee", protegeeJusquAt: null },
        { id: "h", statut: "hors_champ", protegeeJusquAt: null },
      ],
      MAINTENANT,
    );
    expect(plan.map((p) => p.id)).toEqual(["r", "c"]);
  });

  it("12.3 : le terme de la protection est ramené à la résiliation, jamais repoussé", () => {
    const [futur, passe] = planResiliation(
      [
        { id: "a", statut: "confirmee", protegeeJusquAt: new Date("2027-01-01T00:00:00Z") },
        { id: "b", statut: "confirmee", protegeeJusquAt: new Date("2026-09-01T00:00:00Z") },
      ],
      MAINTENANT,
    );
    expect(futur!.protegeeJusquAt).toEqual(MAINTENANT);
    expect(passe!.protegeeJusquAt).toEqual(new Date("2026-09-01T00:00:00Z"));
  });

  it("résilier : statut, date, lien révoqué (version +1), attributions terminées", async () => {
    etat.presentations = [
      { id: "r", statut: "reservee", protegeeJusquAt: null },
      { id: "c", statut: "confirmee", protegeeJusquAt: new Date("2027-01-01T00:00:00Z") },
    ];
    const r = await resilierApporteur("APP1", MAINTENANT);
    expect(r.ok).toBe(true);
    expect(etat.majApporteur[0]).toMatchObject({
      statut: "resilie",
      resilieAt: MAINTENANT,
      versionLien: { increment: 1 },
    });
    expect(etat.majPresentations).toHaveLength(2);
    expect(etat.majPresentations[0]).toMatchObject({ data: { statut: "terminee" } });
  });

  it("les commissions acquises ne sont ni supprimées ni annulées", async () => {
    await resilierApporteur("APP1", MAINTENANT);
    expect(prisma.commissionApporteur.deleteMany).not.toHaveBeenCalled();
    expect(prisma.commissionApporteur.updateMany).not.toHaveBeenCalled();
  });

  it("un contrat non signé ne se résilie pas ; deux clics ne résilient pas deux fois", async () => {
    etat.apporteurStatut = "dossier_en_cours";
    expect((await resilierApporteur("APP1", MAINTENANT)).ok).toBe(false);
    etat.apporteurStatut = "signe";
    expect((await resilierApporteur("APP1", MAINTENANT)).ok).toBe(true);
    expect((await resilierApporteur("APP1", MAINTENANT)).ok).toBe(false);
  });
});

describe("reprise (art. 4.5 et 12.4)", () => {
  const ok = {
    statutOrigine: "versee",
    montantOrigineCents: 40_000,
    reprisesDejaCents: 0,
    demandeeCents: 15_000,
    motif: "Avoir de 10 000 € sur la facture",
    annulationLe: MAINTENANT,
    maintenant: MAINTENANT,
  };

  it("acceptée sur une commission versée, dans la limite du montant versé", () => {
    expect(verifierReprise(ok).ok).toBe(true);
    expect(verifierReprise({ ...ok, demandeeCents: 40_000 }).ok).toBe(true);
  });
  it("refusée au-delà du montant versé, reprises déjà faites comprises", () => {
    expect(verifierReprise({ ...ok, demandeeCents: 40_001 }).ok).toBe(false);
    expect(verifierReprise({ ...ok, reprisesDejaCents: 30_000, demandeeCents: 15_000 }).ok).toBe(
      false,
    );
  });
  it("refusée sans motif, sans montant positif, ou sur une commission non versée", () => {
    expect(verifierReprise({ ...ok, motif: "  " }).ok).toBe(false);
    expect(verifierReprise({ ...ok, demandeeCents: 0 }).ok).toBe(false);
    expect(verifierReprise({ ...ok, demandeeCents: -5 }).ok).toBe(false);
    expect(verifierReprise({ ...ok, statutOrigine: "due" }).ok).toBe(false);
  });
  it("contrat 2.3 (art. 4.5) : possible pendant VINGT-QUATRE mois après l'annulation, refusée au-delà", () => {
    // Treize mois : refusée sous l'ancien délai de douze mois, acceptée désormais.
    expect(verifierReprise({ ...ok, annulationLe: new Date("2025-09-01T00:00:00Z") }).ok).toBe(
      true,
    );
    const tard = verifierReprise({ ...ok, annulationLe: new Date("2024-09-01T00:00:00Z") });
    expect(tard).toMatchObject({ ok: false });
    expect((tard as { message: string }).message).toContain("vingt-quatre mois");
  });

  it("la date du JOUR (saisie dans la console, posée à midi UTC) est admise, même à 8 h", () => {
    expect(
      verifierReprise({
        ...ok,
        annulationLe: new Date("2026-10-05T12:00:00.000Z"),
        maintenant: new Date("2026-10-05T06:00:00Z"),
      }).ok,
    ).toBe(true);
  });

  it("la date d'annulation ne peut pas être dans le futur", () => {
    expect(verifierReprise({ ...ok, annulationLe: new Date("2027-06-01T00:00:00Z") }).ok).toBe(
      false,
    );
  });

  it("enregistrée : ligne négative de statut reprise, ligne d'origine intacte, motif tracé", async () => {
    etat.origine = {
      id: "C1",
      apporteurId: "APP1",
      presentationId: "P1",
      statut: "versee",
      parrainage: false,
      montantCents: 40_000,
      autofactureNumero: "AXI-APP-2026-0003",
    };
    const r = await enregistrerReprise({
      commissionId: "C1",
      demandeeCents: 15_000,
      motif: "Avoir sur facture",
      maintenant: MAINTENANT,
    });
    expect(r.ok).toBe(true);
    expect(etat.creees).toHaveLength(1);
    expect(etat.creees[0]).toMatchObject({
      statut: "reprise",
      montantCents: -15_000,
      apporteurId: "APP1",
      palier: "reprise-de:C1",
    });
    expect(etat.creees[0]!.factureId).toMatch(/^[0-9a-f-]{36}$/);
    expect(etat.noteEcrite).toContain("Avoir sur facture");
    expect(prisma.commissionApporteur.updateMany).not.toHaveBeenCalled();
  });

  it("deux reprises cumulées ne dépassent jamais le montant versé", async () => {
    etat.origine = {
      id: "C1",
      apporteurId: "APP1",
      presentationId: "P1",
      statut: "versee",
      parrainage: false,
      montantCents: 40_000,
      autofactureNumero: null,
    };
    etat.commissionsExistantes = [{ montantCents: -30_000 }];
    const r = await enregistrerReprise({
      commissionId: "C1",
      demandeeCents: 15_000,
      motif: "Remboursement",
      maintenant: MAINTENANT,
    });
    expect(r.ok).toBe(false);
    expect(etat.creees).toEqual([]);
  });
});
