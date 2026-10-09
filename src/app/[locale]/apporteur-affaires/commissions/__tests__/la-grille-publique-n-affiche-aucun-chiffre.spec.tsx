// La grille de référence est RÉSERVÉE AUX APPORTEURS (décision de Will, 2026-10-09) : l'ancienne
// adresse publique, ouverte par un visiteur anonyme, n'affiche qu'un message sobre — AUCUN
// pourcentage, aucun montant — et reste noindex.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({ setRequestLocale: () => undefined }));
vi.mock("@/components/recrutement/TunnelFacebookShell", () => ({
  TunnelFacebookShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { GRILLE_RESERVEE } from "@/features/apporteurs-reseau/grille-reservee";

import Page, { generateMetadata } from "../page";

describe("/fr/apporteur-affaires/commissions, visiteur anonyme", () => {
  it("noindex, nofollow", async () => {
    const m = await generateMetadata({ params: Promise.resolve({ locale: "fr" }) });
    expect(m.robots).toMatchObject({ index: false, follow: false });
  });

  it("🔴 aucun pourcentage ni montant dans le HTML ; le message « réservée aux apporteurs »", async () => {
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ locale: "fr" }) }));
    // Texte visible seulement : les classes CSS portent des nombres (« max-w-[1366px] »).
    const texte = html.replace(/<[^>]*>/g, " ");
    expect(texte).not.toMatch(/\d\s?%|%|€|\d{3}/);
    expect(html).toContain(GRILLE_RESERVEE.titre.replace(/'/g, "&#x27;"));
    expect(html).not.toContain("Formations collectives");
  });
});
