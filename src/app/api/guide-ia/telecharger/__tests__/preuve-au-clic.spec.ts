// @vitest-environment node
//
// La confirmation de la preuve se fait au POST du bouton du lien du guide, quel que soit
// l'état de l'interrupteur du CRM, jamais au GET, et sans jamais retarder ni faire échouer la
// redirection vers le PDF.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const bd = vi.hoisted(() => ({
  appels: [] as { id: string; clic: Date }[],
  panne: false,
  ordre: [] as string[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    guideRequest: {
      findUnique: async () => ({ id: "demande-1", locale: "fr", source: "guide-ia" }),
      updateMany: async () => ({ count: 1 }),
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/analytics/plausible-serveur", () => ({
  emettreEvenementPlausible: async () => true,
}));
vi.mock("@/server/guides-reseau/preuve-page-guide", () => ({
  confirmerPreuvesAuClic: async (id: string, clic: Date) => {
    bd.ordre.push("preuve");
    bd.appels.push({ id, clic });
    if (bd.panne) throw new Error("base indisponible");
  },
}));
// Interrupteur du CRM FERMÉ : `transmettreClicGuide` sort immédiatement, sans rien faire.
vi.mock("@/server/crm-sync/lettre-guide", () => ({
  transmettreClicGuide: async () => {
    bd.ordre.push("crm");
    return "ferme";
  },
}));

import { GET, POST } from "../route";

const BASE = "https://axion-ia.com";
const JETON = "b2".repeat(32);

beforeEach(() => {
  bd.appels.length = 0;
  bd.ordre.length = 0;
  bd.panne = false;
});

describe("preuve de l'accord au clic", () => {
  it("🔴 un POST confirme, AVANT le CRM, interrupteur CRM fermé", async () => {
    const res = await POST(
      new NextRequest(`${BASE}/api/guide-ia/telecharger`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `t=${JETON}`,
      }),
    );
    expect(res.status).toBe(303);
    expect(bd.appels).toHaveLength(1);
    expect(bd.appels[0]!.id).toBe("demande-1");
    expect(bd.ordre).toEqual(["preuve", "crm"]);
  });

  it("chaque POST appelle la confirmation (un second dépôt se confirme au clic suivant)", async () => {
    for (let i = 0; i < 2; i++) {
      await POST(
        new NextRequest(`${BASE}/api/guide-ia/telecharger`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: `t=${JETON}`,
        }),
      );
    }
    expect(bd.appels).toHaveLength(2);
  });

  it("🔴 un GET ne confirme JAMAIS", async () => {
    await GET(new NextRequest(`${BASE}/api/guide-ia/telecharger?t=${JETON}`));
    expect(bd.appels).toHaveLength(0);
  });

  it("🔴 panne pendant la confirmation : la redirection vers le PDF part quand même", async () => {
    bd.panne = true;
    const res = await POST(
      new NextRequest(`${BASE}/api/guide-ia/telecharger`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `t=${JETON}`,
      }),
    );
    expect(res.status).toBe(303);
    expect(bd.ordre).toContain("crm");
  });
});
