/**
 * L5 — LE LIEN DU DOSSIER FORMATEUR EST JOIGNABLE, PRIVÉ ET HORS DE SENTRY.
 *
 * Même méthode que le dossier apporteur : on EXTRAIT le motif réel du `matcher` du proxy
 * et on le fait tourner. Contre-témoins : `/fr/formateurs`, `/fr/espace-formateur/…` et
 * `/apporteur/dossier/…` gardent leur comportement. Angle mort assumé : on lit des
 * sources, pas une réponse HTTP (le « Fini » en prod se vérifie par `curl -sI`).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { estRouteARequeteSecrete } from "@/lib/observability/sentry-pii-scrub";

const RACINE = process.cwd();
const LIEN =
  "/formateur/dossier/6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b/1792000000.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCd";

function matcherRegex(): RegExp {
  const source = readFileSync(join(RACINE, "src/proxy.ts"), "utf8");
  const ligne = source.split("\n").find((l) => l.trim().startsWith('"/((?!'));
  if (!ligne) throw new Error("Motif du matcher introuvable dans src/proxy.ts");
  const pattern = ligne.trim().replace(/^"/, "").replace(/",?$/, "").replace(/\\\\/g, "\\");
  return new RegExp(`^${pattern}$`);
}

describe("le dossier en ligne du formateur reste joignable et privé", () => {
  const matcher = matcherRegex();

  it("le proxy ne capte pas la page (pas de 301 vers /fr)", () => {
    expect(matcher.test(LIEN)).toBe(false);
    expect(matcher.test("/formateur/dossier/x/y")).toBe(false);
  });

  it("contre-témoin : les routes voisines gardent leur comportement", () => {
    expect(matcher.test("/fr/formateurs")).toBe(true);
    expect(matcher.test("/fr/espace-formateur/missions")).toBe(true);
    expect(matcher.test("/formateur")).toBe(true);
    expect(matcher.test("/apporteur/dossier/x/y")).toBe(false);
    expect(matcher.test("/a-propos")).toBe(true);
  });

  it("next.config.ts pose same-origin (jamais no-referrer), noindex et une CSP", () => {
    const conf = readFileSync(join(RACINE, "next.config.ts"), "utf8");
    const i = conf.indexOf('source: "/formateur/dossier/:path*"');
    expect(i).toBeGreaterThan(-1);
    const bloc = conf.slice(i, i + 1200);
    expect(bloc).toContain('"Referrer-Policy", value: "same-origin"');
    expect(bloc).not.toContain("no-referrer");
    expect(bloc).toContain("noindex");
    expect(bloc).toContain("Content-Security-Policy");
    // Après `/:path*` : la règle générale ne doit pas l'écraser.
    expect(i).toBeGreaterThan(conf.indexOf('source: "/:path*"'));
  });

  it("Sentry supprime la requête entière (IBAN, téléphone, pièces)", () => {
    expect(estRouteARequeteSecrete(LIEN)).toBe(true);
    expect(estRouteARequeteSecrete(`POST https://axion-ia.com${LIEN}`)).toBe(true);
    expect(estRouteARequeteSecrete("/fr/formateurs")).toBe(false);
  });

  it("la page sans dossier rend la 404 neutre (notFound), jamais une redirection", () => {
    const page = readFileSync(
      join(RACINE, "src/app/formateur/dossier/[id]/[jeton]/page.tsx"),
      "utf8",
    );
    expect(page).toContain("if (!dossier) notFound();");
    expect(page).not.toMatch(/\bredirect\(/);
  });
});
