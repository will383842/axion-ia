import { beforeEach, describe, expect, it, vi } from "vitest";

// Contrat 2.3, art. 4.5 bis : un manquement ou une fraude prive l'affaire de toute commission ;
// celles déjà versées sont reprises ; l'apporteur reçoit les faits et peut contester (30 jours).

interface Ligne {
  id: string;
  apporteurId: string;
  presentationId: string | null;
  factureId: string;
  parrainage: boolean;
  statut: string;
  montantCents: number | null;
  autofactureNumero: string | null;
  litigeDepuis: Date | null;
  litigeMotif: string | null;
  palier: string | null;
}

const etat = vi.hoisted(() => ({
  lignes: [] as Ligne[],
  presentation: { id: "P1", apporteurId: "APP1", statut: "confirmee" } as Record<string, unknown>,
  annulees: [] as string[],
  reprises: [] as Array<Record<string, unknown>>,
  envoyes: [] as Array<Record<string, unknown>>,
  journal: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("../litige", () => ({ litigeDisponible: async () => true }));
vi.mock("../envois", () => ({
  envoyer: vi.fn(async (e: Record<string, unknown>) => {
    etat.envoyes.push(e);
    return "envoye";
  }),
}));
vi.mock("../ajustement", () => ({
  annulerCommission: vi.fn(async (id: string) => {
    const l = etat.lignes.find((x) => x.id === id)!;
    l.statut = "annulee";
    etat.annulees.push(id);
    return { ok: true };
  }),
}));
vi.mock("../resiliation", () => ({
  PREFIXE_PALIER_REPRISE: "reprise-de:",
  enregistrerReprise: vi.fn(async (e: Record<string, unknown>) => {
    etat.reprises.push(e);
    return { ok: true, message: "ok" };
  }),
}));

function correspond(l: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, c]) => {
    const v = l[k];
    if (c === null) return v === null;
    if (typeof c === "object" && c !== null && "in" in c) return (c.in as unknown[]).includes(v);
    return v === c;
  });
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    presentationEntreprise: {
      findUnique: vi.fn(async () => ({ ...etat.presentation })),
      updateMany: vi.fn(
        async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          if (!correspond(etat.presentation, a.where)) return { count: 0 };
          Object.assign(etat.presentation, a.data);
          return { count: 1 };
        },
      ),
    },
    commissionApporteur: {
      findMany: vi.fn(async (a: { where: Record<string, unknown> }) =>
        etat.lignes.filter((l) => correspond(l as never, a.where)).map((l) => ({ ...l })),
      ),
      updateMany: vi.fn(
        async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          const ls = etat.lignes.filter((l) => correspond(l as never, a.where));
          for (const l of ls) Object.assign(l, a.data);
          return { count: ls.length };
        },
      ),
    },
    apporteurReseau: {
      findUnique: vi.fn(async () => ({ prenom: "Claire", email: "claire@exemple.fr" })),
    },
    activityLog: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        etat.journal.push(a.data);
        return {};
      }),
    },
  },
}));

import { constaterManquement } from "../manquement";

const MAINTENANT = new Date("2026-10-08T09:00:00Z");
const ligne = (id: string, statut: string, extra: Partial<Ligne> = {}): Ligne => ({
  id,
  apporteurId: "APP1",
  presentationId: "P1",
  factureId: `F-${id}`,
  parrainage: false,
  statut,
  montantCents: 40_000,
  autofactureNumero: null,
  litigeDepuis: null,
  litigeMotif: null,
  palier: null,
  ...extra,
});

beforeEach(() => {
  etat.lignes = [];
  etat.presentation = { id: "P1", apporteurId: "APP1", statut: "confirmee" };
  etat.annulees = [];
  etat.reprises = [];
  etat.envoyes = [];
  etat.journal = [];
});

describe("manquement ou fraude (art. 4.5 bis)", () => {
  it("les faits sont obligatoires : sans eux, rien ne bouge", async () => {
    etat.lignes = [ligne("c1", "due")];
    expect(
      await constaterManquement({ presentationId: "P1", faits: "court", maintenant: MAINTENANT }),
    ).toMatchObject({ ok: false });
    expect(etat.lignes[0]!.statut).toBe("due");
    expect(etat.envoyes).toHaveLength(0);
  });

  it("non facturée = annulée ; facturée non versée = bloquée ; versée = reprise, parrain compris", async () => {
    etat.lignes = [
      ligne("a", "due"),
      ligne("b", "due", { autofactureNumero: "AXI-APP-2026-0001" }),
      ligne("v", "versee"),
      ligne("pv", "versee", {
        apporteurId: "APP2",
        presentationId: "P1",
        parrainage: true,
        factureId: "F-v",
        montantCents: 4_000,
      }),
    ];
    const r = await constaterManquement({
      presentationId: "P1",
      faits: "L'entreprise a versé une rétrocession à l'apporteur, non déclarée (art. 8.4).",
      acteurId: "admin-1",
      maintenant: MAINTENANT,
    });
    expect(r).toMatchObject({ ok: true, bilan: { annulees: 1, bloquees: 1, reprises: 2 } });
    expect(etat.annulees).toEqual(["a"]);
    expect(etat.lignes.find((l) => l.id === "b")!.litigeDepuis).toEqual(MAINTENANT);
    expect(etat.reprises.map((x) => [x["commissionId"], x["demandeeCents"]])).toEqual([
      ["v", 40_000],
      ["pv", 4_000],
    ]);
    expect(etat.presentation["statut"]).toBe("dementie");
  });

  it("l'apporteur reçoit les FAITS ; le geste est tracé au journal", async () => {
    etat.lignes = [ligne("a", "due")];
    const faits = "L'entreprise déclare n'avoir jamais échangé avec l'apporteur (art. 3.7).";
    await constaterManquement({
      presentationId: "P1",
      faits,
      acteurId: "admin-1",
      maintenant: MAINTENANT,
    });
    expect(etat.envoyes).toHaveLength(1);
    expect(etat.envoyes[0]).toMatchObject({
      gabarit: "apporteur-manquement",
      destinataire: "claire@exemple.fr",
      payload: { faits },
    });
    expect(etat.journal[0]).toMatchObject({
      adminUserId: "admin-1",
      action: "presentation_entreprise.manquement",
      targetId: "P1",
      changes: { faits, statutAvant: "confirmee" },
    });
  });

  it("une reprise déjà faite n'est pas refaite (montant restant seulement)", async () => {
    etat.lignes = [
      ligne("v", "versee"),
      ligne("r", "reprise", {
        montantCents: -40_000,
        palier: "reprise-de:v",
        presentationId: null,
      }),
    ];
    const r = await constaterManquement({
      presentationId: "P1",
      faits: "Fraude constatée sur la déclaration.",
      maintenant: MAINTENANT,
    });
    expect(r).toMatchObject({ ok: true, bilan: { reprises: 0 } });
  });
});
