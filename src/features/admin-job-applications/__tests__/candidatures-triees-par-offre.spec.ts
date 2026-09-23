/**
 * LA LISTE « TOUTES OFFRES » EST TRIÉE PAR OFFRE, PAS SEULEMENT PAR DATE.
 *
 * ── Pourquoi ─────────────────────────────────────────────────────────────
 * Mesuré en production le 2026-09-23 : 164 candidatures sur 34 offres,
 * triées par seule date (`submittedAt desc`), se lisaient comme un tas — la
 * même offre revient toutes les cinq lignes en moyenne, jamais groupée. Le
 * remplacement de l'onglet « Monteur vidéo » par un sélecteur (33 offres +
 * 1 bucket « Candidature spontanée ») ne suffit pas seul : sans le tri, la
 * réponse à « qui a postulé à Rédacteur web ? » resterait éparpillée sur
 * toutes les pages tant qu'on ne filtre pas explicitement.
 *
 * ⚠️ CE QUE CE FICHIER EXISTE POUR EMPÊCHER : que le tri par offre déborde
 * sur les appelants qui veulent la CHRONOLOGIE pure — la Boîte de réception
 * (`admin-inbox/queries.ts`, `view` par défaut = `standard`) et les vues
 * mono-offre (lien depuis une fiche d'offre, `offerId` explicite). Un tri
 * qui s'appliquerait partout casserait silencieusement « les candidatures
 * les plus récentes » ailleurs dans la console.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
const countMock = vi.fn();
const activityCreateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: {
      findMany: (...a: unknown[]) => findManyMock(...a),
      count: (...a: unknown[]) => countMock(...a),
    },
    activityLog: { create: (...a: unknown[]) => activityCreateMock(...a) },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => `clair:${v}` }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));

import { listApplications } from "../reads";

beforeEach(() => {
  vi.clearAllMocks();
  countMock.mockResolvedValue(0);
  findManyMock.mockResolvedValue([]);
  activityCreateMock.mockResolvedValue({});
});

describe("tri de la liste des candidatures", () => {
  it("« Toutes offres » (view=all, sans offerId) : trie par offre PUIS par date", async () => {
    await listApplications({ view: "all" }, { role: "admin", acteurId: "u1" });

    const appelFindMany = findManyMock.mock.calls[0]?.[0] as { orderBy: unknown };
    expect(appelFindMany.orderBy).toEqual([{ offerTitleSnap: "asc" }, { submittedAt: "desc" }]);
  });

  it("une offre CHOISIE (offerId posé) : redevient une pure chronologie", async () => {
    await listApplications(
      { view: "all", offerId: "11111111-1111-1111-1111-111111111111" },
      { role: "admin", acteurId: "u1" },
    );

    const appelFindMany = findManyMock.mock.calls[0]?.[0] as { orderBy: unknown };
    expect(appelFindMany.orderBy).toEqual([{ submittedAt: "desc" }]);
  });

  it("le bucket « Candidature spontanée » (offerId=spontanee) : pure chronologie aussi", async () => {
    await listApplications(
      { view: "all", offerId: "spontanee" },
      { role: "admin", acteurId: "u1" },
    );

    const appelFindMany = findManyMock.mock.calls[0]?.[0] as { orderBy: unknown };
    expect(appelFindMany.orderBy).toEqual([{ submittedAt: "desc" }]);
  });

  it("🔑 CONTRE-TÉMOIN — vue « standard » (Boîte de réception, défaut) : jamais retriée par offre", async () => {
    await listApplications({}, { role: "admin", acteurId: "u1" });

    const appelFindMany = findManyMock.mock.calls[0]?.[0] as { orderBy: unknown };
    expect(appelFindMany.orderBy).toEqual([{ submittedAt: "desc" }]);
  });

  it("🔑 CONTRE-TÉMOIN — vue « monteur » : jamais retriée par offre", async () => {
    await listApplications({ view: "monteur" }, { role: "admin", acteurId: "u1" });

    const appelFindMany = findManyMock.mock.calls[0]?.[0] as { orderBy: unknown };
    expect(appelFindMany.orderBy).toEqual([{ submittedAt: "desc" }]);
  });
});
