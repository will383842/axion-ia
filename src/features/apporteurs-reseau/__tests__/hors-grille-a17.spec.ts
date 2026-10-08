import { beforeEach, describe, expect, it, vi } from "vitest";

// Annexe 1, A1.7 (et art. 5.4) : une commission « à qualifier » se règle sous soixante jours de
// l'ENCAISSEMENT ; « prestation hors grille de commissions » = produit hors grille constaté par
// Williams, distinct d'un palier encore à choisir ; la constatation « non commissionné » est
// portée à la connaissance de l'apporteur avec son motif.

const etat = vi.hoisted(() => ({
  lignes: [] as Array<Record<string, unknown>>,
  factures: {} as Record<string, Date | null>,
  envoyes: [] as Array<Record<string, unknown>>,
  alertes: [] as Array<Record<string, unknown>>,
  deja: new Set<string>(),
  annulees: [] as string[],
  journal: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("@/lib/destinataires-internes", () => ({
  destinataireAlertesInternes: () => "alertes@exemple.fr",
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(
    async (
      _g: string,
      _d: string,
      _l: string,
      p: Record<string, unknown>,
      o: { jobId: string },
    ) => {
      etat.alertes.push({ ...p, jobId: o.jobId });
      etat.deja.add(o.jobId);
      return { enqueued: true };
    },
  ),
}));
vi.mock("../commissions", () => ({ dejaEnvoye: async (j: string) => etat.deja.has(j) }));
vi.mock("../litige", () => ({ litigeDisponible: async () => true }));
vi.mock("../envois", () => ({
  envoyer: vi.fn(async (e: Record<string, unknown>) => {
    etat.envoyes.push(e);
    return "envoye";
  }),
}));
vi.mock("../ajustement", () => ({
  annulerCommission: vi.fn(async (id: string) => {
    etat.annulees.push(id);
    return { ok: true };
  }),
}));

function vrai(l: Record<string, unknown>, w: Record<string, unknown>): boolean {
  return Object.entries(w).every(([k, c]) =>
    c === null ? l[k] === null || l[k] === undefined : l[k] === c,
  );
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    commissionApporteur: {
      findMany: vi.fn(async (a: { where: Record<string, unknown> }) =>
        etat.lignes.filter((l) => vrai(l, a.where)),
      ),
      findUnique: vi.fn(
        async (a: { where: { id: string } }) =>
          etat.lignes.find((l) => l["id"] === a.where.id) ?? null,
      ),
      updateMany: vi.fn(
        async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          const ls = etat.lignes.filter((l) => vrai(l, a.where));
          for (const l of ls) Object.assign(l, a.data);
          return { count: ls.length };
        },
      ),
    },
    factureFormation: {
      findMany: vi.fn(async () =>
        Object.entries(etat.factures).map(([id, paidAt]) => ({ id, paidAt })),
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

import {
  alerterHorsGrille,
  constaterNonCommissionne,
  etatHorsGrille,
  LIBELLE_ACTIVITE_A_CLASSER,
  LIBELLE_HORS_GRILLE,
  LIBELLE_PALIER_A_CHOISIR,
  libelleAQualifier,
  marquerHorsGrille,
  PALIER_HORS_GRILLE,
} from "../hors-grille";

const CREEE = new Date("2026-07-20T10:00:00Z");
const PAYEE = new Date("2026-08-01T10:00:00Z");
const ligne = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  apporteurId: "APP1",
  statut: "a_qualifier",
  parrainage: false,
  activite: "formation",
  palier: null,
  creeAt: CREEE,
  factureId: `F-${id}`,
  litigeDepuis: null,
  ...extra,
});

beforeEach(() => {
  etat.lignes = [];
  etat.factures = {};
  etat.envoyes = [];
  etat.alertes = [];
  etat.deja = new Set();
  etat.annulees = [];
  etat.journal = [];
});

describe("prestation hors grille (A1.7)", () => {
  it("trois repères distincts : hors grille (geste de Williams), palier à choisir, activité à classer", () => {
    expect(libelleAQualifier({ activite: "formation", palier: PALIER_HORS_GRILLE })).toBe(
      LIBELLE_HORS_GRILLE,
    );
    expect(libelleAQualifier({ activite: "formation", palier: null })).toBe(
      LIBELLE_PALIER_A_CHOISIR,
    );
    expect(libelleAQualifier({ activite: "inconnue", palier: null })).toBe(
      LIBELLE_ACTIVITE_A_CLASSER,
    );
  });

  it("échéance à soixante jours de l'encaissement, préavis à dix jours", () => {
    const e = etatHorsGrille(PAYEE, new Date("2026-09-25T10:00:00Z"));
    expect(e.echeance).toEqual(new Date("2026-09-30T10:00:00Z"));
    expect(e).toMatchObject({ joursRestants: 5, bientot: true, depassee: false });
    expect(etatHorsGrille(PAYEE, new Date("2026-10-01T10:00:00Z"))).toMatchObject({
      depassee: true,
    });
  });

  it("l'alerte compte depuis l'ENCAISSEMENT (paiement de la facture), pas depuis la création de la ligne", async () => {
    etat.lignes = [ligne("c1")];
    etat.factures = { "F-c1": PAYEE };
    // 21/09 : J-9 depuis l'encaissement (01/08), mais J-2 depuis la création (20/07).
    expect(await alerterHorsGrille(new Date("2026-09-21T10:00:00Z"))).toBe(1);
    expect(etat.alertes[0]!["jobId"]).toBe("apporteur-hors-grille-c1-preavis");
    expect(await alerterHorsGrille(new Date("2026-09-22T10:00:00Z"))).toBe(0); // jamais deux fois
    expect(await alerterHorsGrille(new Date("2026-10-02T10:00:00Z"))).toBe(1);
    expect(String(etat.alertes[1]!["message"])).toContain(
      "une fois la prestation réalisée et payée",
    );
  });

  it("une ligne suspendue (contestation, art. 4.2 bis) n'est pas alertée", async () => {
    etat.lignes = [ligne("c1", { litigeDepuis: new Date("2026-09-01T00:00:00Z") })];
    etat.factures = { "F-c1": PAYEE };
    expect(await alerterHorsGrille(new Date("2026-10-02T10:00:00Z"))).toBe(0);
  });

  it("« Produit hors grille » puis « non commissionné » : annulée, apporteur prévenu avec le motif", async () => {
    etat.lignes = [ligne("c1")];
    expect(await constaterNonCommissionne("c1", "produit interne, hors offre")).toMatchObject({
      ok: false,
    }); // pas encore marqué hors grille
    expect(await marquerHorsGrille("c1", "admin-1")).toEqual({ ok: true });
    expect(etat.lignes[0]!["palier"]).toBe(PALIER_HORS_GRILLE);
    expect(await constaterNonCommissionne("c1", "court")).toMatchObject({ ok: false });
    const motif = "Atelier interne réservé aux salariés, hors offre commerciale.";
    expect(await constaterNonCommissionne("c1", motif, "admin-1")).toEqual({ ok: true });
    expect(etat.annulees).toEqual(["c1"]);
    expect(etat.envoyes[0]).toMatchObject({
      gabarit: "apporteur-non-commissionne",
      destinataire: "claire@exemple.fr",
      payload: { motifNonCommissionne: motif },
      jobId: "apporteur-non-commissionne-c1",
    });
  });
});
