// @vitest-environment node
//
// Lot guide réseau 4 (O5) — rattrapage des origines restées en route : une transmission par
// (personne, guide), seulement si la personne a cliqué, jamais avant 10 min, jamais sans date de
// coupure (D3 : décision de Williams en attente), colonne absente tolérée.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;
const m = vi.hoisted(() => ({
  origines: [] as Record<string, unknown>[],
  demandes: new Map<string, Record<string, unknown>>(),
  appels: [] as Record<string, unknown>[],
  erreurColonne: false,
  filtres: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    guideReseauOrigine: {
      findMany: async (a: { where: Record<string, unknown> }) => {
        if (m.erreurColonne) throw Object.assign(new Error("col"), { code: "P2022" });
        m.filtres.push(a.where);
        const w = a.where as {
          createdAt: { lt: Date; gte: Date };
        };
        return m.origines.filter(
          (o) =>
            o.crmStatut === null &&
            o.archiveeLe === null &&
            +(o.createdAt as Date) < +w.createdAt.lt &&
            +(o.createdAt as Date) >= +w.createdAt.gte,
        );
      },
    },
    guideRequest: {
      findUnique: async (a: { where: { emailKey_aimant: { emailKey: string; aimant: string } } }) =>
        m.demandes.get(`${a.where.emailKey_aimant.emailKey}|${a.where.emailKey_aimant.aimant}`) ??
        null,
    },
  },
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "x" }));
vi.mock("@/server/queue/queues", () => ({ crmSyncQueue: null }));
vi.mock("@/server/email/opposition", () => ({ estOpposee: async () => false }));
vi.mock("@/server/guides-reseau/synchro-v3", async (orig) => ({
  ...(await orig<typeof import("@/server/guides-reseau/synchro-v3")>()),
  transmettreOriginesSuivantes: async (a: Record<string, unknown>) => {
    m.appels.push(a);
    return "transmise";
  },
}));

import { rattraperOriginesSuivantes } from "../rattrapage-lettre-guide";

const MAINTENANT = new Date("2026-11-11T12:00:00.000Z");
const il_y_a = (min: number) => new Date(MAINTENANT.getTime() - min * 60_000);
const o = (sur: Ligne = {}): Ligne => ({
  emailKey: "cle-1",
  guide: "guide-ia",
  crmStatut: null,
  archiveeLe: null,
  createdAt: il_y_a(60),
  ...sur,
});

beforeEach(() => {
  m.origines.length = 0;
  m.demandes.clear();
  m.appels.length = 0;
  m.filtres.length = 0;
  m.erreurColonne = false;
  m.demandes.set("cle-1|guide-ia", { email: "p@exemple.test", firstClickAt: il_y_a(500) });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
const lancer = (sur: Record<string, unknown> = {}) =>
  rattraperOriginesSuivantes({
    executer: true,
    depuis: il_y_a(24 * 60),
    maintenant: MAINTENANT,
    ...sur,
  });

describe("rattraperOriginesSuivantes", () => {
  it("origine en attente depuis 1 h d'une personne cliquée : une transmission par (personne, guide)", async () => {
    m.origines.push(o(), o(), o({ guide: "autre" }));
    m.demandes.set("cle-1|autre", { email: "p@exemple.test", firstClickAt: il_y_a(100) });
    const b = await lancer();
    expect(m.appels).toHaveLength(2);
    expect(b.groupes).toBe(2);
    expect(b.transmis).toBe(2);
  });

  it("origine vieille de 2 min : ignorée (le chemin direct finit)", async () => {
    m.origines.push(o({ createdAt: il_y_a(2) }));
    await lancer();
    expect(m.appels).toHaveLength(0);
  });

  it("personne jamais cliquée : rien ne part", async () => {
    m.demandes.set("cle-1|guide-ia", { email: "p@exemple.test", firstClickAt: null });
    m.origines.push(o());
    const b = await lancer();
    expect(m.appels).toHaveLength(0);
    expect(b.nonCliques).toBe(1);
  });

  it("sans date de coupure (D3 en attente) : rien n'est lu ni envoyé", async () => {
    m.origines.push(o());
    const b = await rattraperOriginesSuivantes({ executer: true, maintenant: MAINTENANT });
    expect(b.refus).toBe("coupure-absente");
    expect(m.filtres).toHaveLength(0);
    expect(m.appels).toHaveLength(0);
  });

  it("origine antérieure à la coupure : jamais envoyée", async () => {
    m.origines.push(o({ createdAt: il_y_a(3 * 24 * 60) }));
    await lancer();
    expect(m.appels).toHaveLength(0);
  });

  it("à blanc : compte, n'envoie rien", async () => {
    m.origines.push(o());
    const b = await lancer({ executer: false });
    expect(b.groupes).toBe(1);
    expect(m.appels).toHaveLength(0);
  });

  it("colonne absente (P2022) : sortie propre, aucune exception", async () => {
    m.erreurColonne = true;
    const b = await lancer();
    expect(b.refus).toBe("colonne-absente");
  });

  it("deux passes : la seconde ne trouve plus rien si l'origine est marquée", async () => {
    m.origines.push(o());
    await lancer();
    m.origines.forEach((x) => (x.crmStatut = "transmise"));
    m.appels.length = 0;
    await lancer();
    expect(m.appels).toHaveLength(0);
  });
});
