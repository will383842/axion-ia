/**
 * /catalogue attend la certification Qualiopi (2026-10-14).
 *
 * Le feuilletoir reproduit le catalogue papier : logo Qualiopi et « Jusqu'à
 * 100 % financé ». Tant que `QUALIOPI_CERTIFICATION_OBTENUE` n'est pas "true",
 * la page redirige vers /fr/formations (le QR imprimé mène quelque part
 * d'utile) et sort du sitemap. Le drapeau se lit À LA REQUÊTE : une page figée
 * au build garderait la redirection dans l'image.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("next-intl/server", () => ({ setRequestLocale: () => undefined }));
vi.mock("@/components/nav/Breadcrumbs", () => ({ Breadcrumbs: () => null }));
vi.mock("@/components/marketing/Cta", () => ({
  Cta: ({ href, children }: { href: string; children?: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import Page, { dynamic } from "../page";

const params = (locale: string) => ({ params: Promise.resolve({ locale }) });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/catalogue tant que la certification n'est pas délivrée", () => {
  it("est rendue à la requête, jamais figée au build", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it.each(["fr", "en"])("%s : drapeau absent → redirection vers /fr/formations", async (l) => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "");
    await expect(Page(params(l))).rejects.toThrow("REDIRECT:/fr/formations");
  });

  it("drapeau à false → redirection", async () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "false");
    await expect(Page(params("fr"))).rejects.toThrow("REDIRECT:/fr/formations");
  });

  it("drapeau à true → la page revient, avec le feuilletoir", async () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "true");
    const h = renderToStaticMarkup(await Page(params("fr")));
    expect(h).toContain('href="/catalogue/index.html"');
    expect(h).toContain("Feuilleter le catalogue");
  });
});

describe("sitemap : /catalogue suit le même drapeau", () => {
  // Le sitemap complet tire la base et une douzaine de sources : l'exécuter ici
  // demanderait de tout simuler. On lit donc la garde dans la source, et on
  // vérifie qu’elle porte bien sur CE drapeau.
  const source = readFileSync(join(process.cwd(), "src/app/sitemap.ts"), "utf8");

  it("/catalogue est sautée tant que la certification n'est pas délivrée", () => {
    expect(source).toMatch(
      /if \(key === "\/catalogue" && !isQualiopiCertificationObtenue\(\)\) continue;/,
    );
  });
});
