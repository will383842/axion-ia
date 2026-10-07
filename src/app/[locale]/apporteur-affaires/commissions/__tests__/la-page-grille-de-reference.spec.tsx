// La page « Grille de référence des commissions » (2026-10-07) : noindex, l'en-tête voulu par
// Will, les six tableaux de l'annexe 1 avec leur date, aucun mot sur le parrainage ni Qualiopi.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({ setRequestLocale: () => undefined }));
vi.mock("@/components/recrutement/TunnelFacebookShell", () => ({
  TunnelFacebookShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import Page, { generateMetadata } from "../page";

const texte = (h: string) =>
  h
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");

describe("page grille de référence", () => {
  it("noindex, nofollow", async () => {
    const m = await generateMetadata({ params: Promise.resolve({ locale: "fr" }) });
    expect(m.robots).toMatchObject({ index: false, follow: false });
  });

  it("l'en-tête renvoie à A1.7 ; les six tableaux, datés ; aucun parrainage ni Qualiopi", async () => {
    const t = texte(
      renderToStaticMarkup(await Page({ params: Promise.resolve({ locale: "fr" }) })),
    );
    expect(t).toContain("Grille de référence des commissions");
    expect(t).toContain("Produits créés après la signature de votre contrat : annexe 1, A1.7.");
    expect(t).toContain("Les produits de votre contrat gardent la commission qui y figure.");
    for (const titre of [
      "Formations collectives",
      "Accompagnement individuel et coaching (1-to-1)",
      "Audits",
      "Implémentations",
      "Conférences",
      "Prestations non commissionnées",
    ]) {
      expect(t).toContain(titre);
    }
    expect(t).toMatch(/Publié le \d{2}\/\d{2}\/\d{4}/);
    expect(t).toContain("Coaching individuel");
    expect(t).toContain("Aucune");
    expect(t).not.toMatch(/parrain|qualiopi|jusqu'à/i);
  });
});
