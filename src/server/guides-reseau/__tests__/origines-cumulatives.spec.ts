// @vitest-environment node
//
// Lot guide réseau 4 (O2) — lecture des origines ACTIVES d'une personne pour un guide : les 20 plus
// récentes (plafond de la charge CRM), jamais une archivée, jamais d'un autre guide.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/crm-sync/enqueue", () => ({ enqueueCrmSyncEvent: async () => null }));

import { lireOriginesActives, type LecteurOrigines, type OrigineLueActive } from "../origines";
import { chargeCrmV3, MAX_ORIGINES_PAR_CHARGE } from "../synchro-v3";

type Ligne = Record<string, unknown>;

function ligne(i: number, sur: Ligne = {}): Ligne {
  return {
    id: `id-${i}`,
    emailKey: "cle-1",
    cleDedoublonnage: `c${i}`.padEnd(64, "0"),
    mot: "GUIDE",
    reseau: "instagram",
    guide: "guide-ia",
    postRef: `post_ref_${String(i).padStart(4, "0")}`,
    postUrl: null,
    canal: null,
    famille: "guide_reseau",
    detail: null,
    compte: "page_principale",
    versionTexte: "m1-v1",
    utmCampagne: null,
    commentaireRefHmac: null,
    occurredAt: new Date(Date.UTC(2026, 10, 1, 0, 0, i)),
    archiveeLe: null,
    ...sur,
  };
}

/** Faux client : applique `where`, `orderBy` et `take` comme Prisma. */
function faux(lignes: Ligne[]): LecteurOrigines {
  return {
    guideReseauOrigine: {
      findMany: async (a: {
        where: { emailKey: string; guide: string; archiveeLe: null };
        orderBy: { occurredAt: "desc" };
        take: number;
      }) =>
        lignes
          .filter(
            (l) =>
              l.emailKey === a.where.emailKey && l.guide === a.where.guide && l.archiveeLe === null,
          )
          .sort((x, y) => +(y.occurredAt as Date) - +(x.occurredAt as Date))
          .slice(0, a.take) as unknown as OrigineLueActive[],
    },
  };
}

describe("lireOriginesActives", () => {
  it("25 origines actives : les 20 plus récentes, la plus récente d'abord", async () => {
    const lignes = Array.from({ length: 25 }, (_, i) => ligne(i));
    const lues = await lireOriginesActives(faux(lignes), "cle-1", "guide-ia");
    expect(lues).toHaveLength(MAX_ORIGINES_PAR_CHARGE);
    expect(lues[0]!.id).toBe("id-24");
    expect(lues[19]!.id).toBe("id-5");
  });

  it("exclut les archivées, un autre guide et une autre personne", async () => {
    const lignes = [
      ligne(1),
      ligne(2, { archiveeLe: new Date() }),
      ligne(3, { guide: "autre-guide" }),
      ligne(4, { emailKey: "cle-2" }),
    ];
    const lues = await lireOriginesActives(faux(lignes), "cle-1", "guide-ia");
    expect(lues.map((l) => l.id)).toEqual(["id-1"]);
  });

  it("la charge issue de 25 origines porte 20 entrées triées par date croissante, contenu = la plus récente", async () => {
    const lignes = Array.from({ length: 25 }, (_, i) => ligne(i));
    const lues = await lireOriginesActives(faux(lignes), "cle-1", "guide-ia");
    const c = chargeCrmV3(lues.map((l) => ({ ...l, cleIdempotence: "" })));
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.charge.origines).toHaveLength(20);
    const dates = c.charge.origines.map((o) => o.date);
    expect([...dates].sort()).toEqual(dates);
    expect(c.charge.origine_contenu.date).toBe(
      new Date(Date.UTC(2026, 10, 1, 0, 0, 24)).toISOString(),
    );
  });
});
