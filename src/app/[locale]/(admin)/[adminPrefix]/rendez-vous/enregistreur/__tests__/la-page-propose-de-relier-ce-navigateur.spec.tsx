/**
 * Page « Enregistreur » ouverte par l'extension (« Relier à ma console »,
 * 1.4.0) : `?relier=<nonce>` affiche EN TÊTE le bloc « Relier ce navigateur
 * à la console ». Sans nonce, ou avec un nonce mal formé, rien de tel. Le
 * texte d'aide décrit l'installation réduite (installer, relier, micro).
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

vi.mock("@/features/dossier-client/acces", () => ({
  gardeLectureEchanges: () => Promise.resolve({ autorise: true }),
}));
vi.mock("@/features/admin-enregistreur/actions", () => ({
  creerJetonAction: vi.fn(),
  renouvelerJetonAction: vi.fn(),
  revoquerJetonAction: vi.fn(),
  relierPosteAction: vi.fn(),
}));
vi.mock("@/components/admin/visio/JetonAppareilForm", () => ({
  JetonAppareilForm: ({ libelle }: { libelle: string }) => <button type="button">{libelle}</button>,
}));
vi.mock("@/components/admin/visio/RelierPosteForm", () => ({
  RelierPosteForm: ({ nonce }: { nonce: string }) => <form data-nonce-test={nonce}>Relier</form>,
}));
vi.mock("@/features/admin-enregistreur/queries", () => ({
  lireEtatEnregistreur: () =>
    Promise.resolve({
      drapeau: { effectif: "ferme", motif: null },
      preavis: "—",
      temoinSite: "absent",
      temoinWorkerOkLe: null,
      drapeauVuParWorker: null,
      appareils: [],
    }),
}));

import Page from "../page";

const NONCE = "0123456789abcdef0123456789abcdef";
const params = Promise.resolve({ locale: "fr", adminPrefix: "p" });

async function rendre(q: Record<string, string>): Promise<string> {
  return renderToStaticMarkup(
    (await Page({ params, searchParams: Promise.resolve(q) })) as ReactElement,
  );
}

describe("la page propose de relier ce navigateur", () => {
  it("avec ?relier=<nonce> : le bloc en tête, le nonce transmis au formulaire", async () => {
    const html = await rendre({ relier: NONCE });
    expect(html).toContain("Relier ce navigateur à la console");
    expect(html).toContain(`data-nonce-test="${NONCE}"`);
    expect(html.indexOf("Relier ce navigateur")).toBeLessThan(html.indexOf("Est-ce prêt ?"));
  });

  it.each([{}, { relier: "pas-un-nonce" }, { relier: `${NONCE}0` }])(
    "sans nonce valide (%o) : pas de bloc",
    async (q) => {
      const html = await rendre(q);
      expect(html).not.toContain("Relier ce navigateur");
    },
  );

  it("aide : le dossier de l'extension et les trois étapes", async () => {
    const html = await rendre({});
    expect(html).toContain(String.raw`Documents\Projets\Axion-IA\_ENREGISTREUR-VISIO\extension`);
    expect(html).not.toContain("AxionVisio");
    expect(html).toContain("Relier à ma console");
    expect(html).toContain("Autoriser le micro");
  });
});
