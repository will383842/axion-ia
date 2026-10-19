/**
 * La page « Interrupteurs Qualiopi » rend sans base (build `stub.invalid`) :
 * chaque lot s'affiche « éteint », sans aucune lecture au chargement du module.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/garde-page", () => ({
  gardePage: vi.fn(async () => ({ autorise: true, role: "admin" })),
}));
vi.mock("@/server/actions/qualiopi/interrupteurs-qualiopi", () => ({
  basculerInterrupteurQualiopiAction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: {
      findUnique: vi.fn(async () => {
        throw new Error("base injoignable");
      }),
    },
  },
}));

import Page, { dynamic } from "./page";
import { LOTS_INTERRUPTEURS } from "@/server/qualiopi/socle/lots-interrupteurs";

describe("page Interrupteurs Qualiopi", () => {
  it("est force-dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("rend tous les lots à « Éteint » quand la base est injoignable, et la mention de l'essai", async () => {
    const el = await Page({ params: Promise.resolve({ locale: "fr", adminPrefix: "p" }) });
    const html = renderToStaticMarkup(el);
    for (const l of LOTS_INTERRUPTEURS) expect(html).toContain(`qualiopi.${l.lot}.actif`);
    expect(html).not.toContain("formateurs.");
    expect(html).toContain("uniquement sur les sessions marquées ESSAI, jamais sur de vrais");
    expect(html.match(/Éteint<\/span>|>Éteint</g)?.length ?? 0).toBeGreaterThanOrEqual(
      LOTS_INTERRUPTEURS.length,
    );
  });
});
