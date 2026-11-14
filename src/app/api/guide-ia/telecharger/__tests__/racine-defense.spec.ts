// @vitest-environment node
//
// S3-CRM — défense en profondeur de la route : même si `resoudreGuide` laissait passer un chemin
// voisin (« guides-reseau-x/a.pdf »), la route refuse tout fichier hors de « public/guides-reseau/ ».
// `startsWith(racine)` seul acceptait ce voisin ; il faut `racine + path.sep`.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const etat = vi.hoisted(() => ({ chemin: "", stats: [] as string[] }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    guideRequest: {
      findUnique: async () => ({
        id: "demande-1",
        locale: "fr",
        source: "mot-guide:instagram",
        email: "personne@example.test",
        aimant: "gde-essai-01",
      }),
      updateMany: async () => ({ count: 1 }),
    },
  },
}));
vi.mock("node:fs/promises", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  stat: async (p: string) => {
    etat.stats.push(p);
    return { isFile: () => true, size: 10 };
  },
}));
vi.mock("@/server/guides-reseau/guide-a-livrer", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  resoudreGuide: async () => ({
    kind: "catalogue",
    code: "gde-essai-01",
    titre: "Essai",
    chemin: etat.chemin,
  }),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/analytics/plausible-serveur", () => ({
  emettreEvenementPlausible: async () => true,
}));
vi.mock("@/server/guides-reseau/preuve-page-guide", () => ({
  confirmerPreuvesAuClic: async () => undefined,
}));
vi.mock("@/server/crm-sync/lettre-guide", () => ({ transmettreClicGuide: async () => undefined }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string | null | undefined) => (e ? `h:${e}` : null),
}));

import { POST } from "../route";

const post = () =>
  POST(
    new NextRequest("https://axion-ia.com/api/guide-ia/telecharger", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `t=${"a1".repeat(32)}`,
    }),
  );

beforeEach(() => {
  etat.stats.length = 0;
});

describe("route : la racine se compare avec son séparateur", () => {
  it("« guides-reseau-x/a.pdf » (dossier voisin) : refusé, le disque n'est pas touché", async () => {
    etat.chemin = "guides-reseau-x/a.pdf";
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(await res.text()).toContain("Ce guide n&#39;est plus proposé pour le moment.");
    expect(etat.stats).toHaveLength(0);
  });

  it("« guides-reseau/a.pdf » : accepté (303), le disque est lu une fois", async () => {
    etat.chemin = "guides-reseau/a.pdf";
    const res = await post();
    expect(res.status).toBe(303);
    expect(etat.stats).toHaveLength(1);
  });
});
