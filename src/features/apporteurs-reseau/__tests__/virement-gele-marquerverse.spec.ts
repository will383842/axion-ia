// Lot 7 : `marquerVerse` refuse CÔTÉ SERVEUR pendant le gel, et contrôle le compte lu sur le RIB.
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  gel: new Map<string, unknown>(),
  comptes: { actuel: { fin4: "2606", empreinte: "a".repeat(64) }, precedent: null, choixExige: false } as unknown,
  appelsFacturation: 0,
}));

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("../envois", () => ({ envoyer: vi.fn(), envoyerConfirmationVirement: vi.fn() }));
vi.mock("../interrupteur-changement-iban", () => ({
  changementIbanActif: () => true,
  secretEmpreinteDisponible: () => true,
}));
vi.mock("../virement-compte", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../virement-compte")>()),
  demandesQuiGelent: vi.fn(async () => etat.gel),
  lireComptesVirement: vi.fn(async () => etat.comptes),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: {
      findUnique: vi.fn(async () => ({
        id: "x", prenom: "P", nom: "N", email: "e@exemple.test", regimeTva: "franchise", iban: "ibanchiffre",
      })),
    },
    commissionApporteur: {
      count: vi.fn(async () => { etat.appelsFacturation += 1; return 0; }),
      findMany: vi.fn(async () => []),
    },
  },
}));

import { marquerVerse } from "../facturation";
import { MESSAGE_GEL } from "../virement-compte";

const A = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  etat.gel = new Map();
  etat.appelsFacturation = 0;
  etat.comptes = { actuel: { fin4: "2606", empreinte: "a".repeat(64) }, precedent: null, choixExige: false };
});

describe("marquerVerse sous gel", () => {
  it("refuse tant qu'une demande est ouverte, avant toute lecture de commission", async () => {
    etat.gel = new Map([[A, { id: "d", statut: "confirmee", demandeeAt: new Date(), confirmeeAt: new Date() }]]);
    const r = await marquerVerse(A, new Date(), undefined, { fin4Lue: "2606" });
    expect(r).toEqual({ ok: false, message: MESSAGE_GEL });
    expect(etat.appelsFacturation).toBe(0);
  });

  it("gel levé, quatre caractères faux : refus avant toute écriture", async () => {
    const r = await marquerVerse(A, new Date(), undefined, { fin4Lue: "9999" });
    expect(r).toEqual({ ok: false, message: "Le RIB ouvert ne correspond pas au compte attendu." });
    expect(etat.appelsFacturation).toBe(0);
  });

  it("gel levé, interrupteur allumé, aucune saisie : refus", async () => {
    const r = await marquerVerse(A, new Date());
    expect(r.ok).toBe(false);
    expect(etat.appelsFacturation).toBe(0);
  });
});
