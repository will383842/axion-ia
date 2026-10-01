/**
 * LE LIEN DU QUESTIONNAIRE RESTE JOIGNABLE, PRIVÉ ET HORS DES INDEX
 * (questionnaire en ligne, 2026-10-01).
 *
 * Le lien part dans l'e-mail d'un client. S'il tombe, rien ne le corrige :
 *
 *   · le proxy ne doit PAS le capter — sinon sa règle 0bis le 301 vers
 *     `/fr/questionnaire/…`, qui n'existe pas (le défaut déjà vécu par
 *     `/maintenance` et `/williams-jullin.vcf`). Le test EXTRAIT le motif réel
 *     du `matcher` et le fait tourner (même méthode que la fiche contact) ;
 *   · aucune source de sitemap ne cite la route ;
 *   · `next.config.ts` lui pose sa CSP, `Referrer-Policy: same-origin` et `noindex`, puisque le
 *     proxy ne la voit plus.
 *
 * Contre-témoins : le matcher couvre toujours les pages normales ET une route
 * voisine sans barre (`/questionnaire-satisfaction`) — l'exclusion vise le
 * seul préfixe `questionnaire/`.
 * Angle mort assumé : on lit des SOURCES, pas une réponse HTTP ; la réponse
 * réelle (statut, en-têtes) est mesurée à la main dans la PR.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const LIEN =
  "/questionnaire/6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCd";

/** Le motif du `matcher` tel qu'il est réellement écrit dans proxy.ts. */
function matcherRegex(): RegExp {
  const source = readFileSync(join(RACINE, "src/proxy.ts"), "utf8");
  const ligne = source.split("\n").find((l) => l.trim().startsWith('"/((?!'));
  if (!ligne) throw new Error("Motif du matcher introuvable dans src/proxy.ts");
  const pattern = ligne.trim().replace(/^"/, "").replace(/",?$/, "").replace(/\\\\/g, "\\");
  return new RegExp(`^${pattern}$`);
}

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

describe("le lien du questionnaire reste joignable", () => {
  const matcher = matcherRegex();

  it("le proxy ne capte pas /questionnaire/<id>/<jeton> (pas de 301 vers /fr)", () => {
    expect(matcher.test(LIEN)).toBe(false);
  });

  it("contre-témoin : le matcher couvre les pages normales et la route voisine sans barre", () => {
    expect(matcher.test("/a-propos")).toBe(true);
    expect(matcher.test("/fr/contact")).toBe(true);
    expect(matcher.test("/questionnaire-satisfaction")).toBe(true);
  });

  it("aucune source de sitemap ne cite la route", () => {
    const app = join(RACINE, "src/app");
    const sources = [
      join(app, "sitemap.ts"),
      ...readdirSync(app)
        .filter((n) => n.startsWith("sitemap"))
        .flatMap((n) => {
          const p = join(app, n);
          return statSync(p).isDirectory() ? fichiers(p) : [p];
        }),
      ...fichiers(join(app, "sitemaps")),
      join(RACINE, "src/i18n/routing.ts"),
    ];
    // Témoin : on a bien lu des fichiers (sinon « rien trouvé » ne prouverait rien).
    expect(sources.length).toBeGreaterThan(5);
    for (const f of sources) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/["'`/]questionnaire\//);
    }
  });

  it("next.config.ts pose CSP, same-origin et noindex sur la route (le proxy ne la voit plus)", () => {
    const config = readFileSync(join(RACINE, "next.config.ts"), "utf8");
    const i = config.indexOf('source: "/questionnaire/:path*"');
    expect(i).toBeGreaterThan(0);
    const bloc = config.slice(i, i + 1200);
    // ⚠️ `same-origin`, PAS `no-referrer` : avec `no-referrer`, le navigateur
    // envoie `Origin: null` sur le POST du formulaire, et Next refuse l'action
    // serveur (« Invalid Server Actions request », mesuré en local le
    // 2026-10-01). `same-origin` ne transmet rien hors du site.
    expect(bloc).toContain('{ key: "Referrer-Policy", value: "same-origin" }');
    expect(bloc).not.toContain("no-referrer");
    expect(bloc).toMatch(/X-Robots-Tag", value: "noindex/);
    expect(bloc).toContain('key: "Content-Security-Policy"');
    expect(bloc).toContain("frame-ancestors 'none'");
    expect(bloc).toContain("form-action 'self'");
    // La règle doit venir APRÈS la règle globale `/:path*` : la dernière gagne.
    expect(i).toBeGreaterThan(config.indexOf('{ source: "/:path*"'));
  });

  it("la CSP tolère le script en ligne de Next : aucun HTML injecté sous la route", () => {
    // `'unsafe-inline'` est le prix d'une route sans proxy (pas de nonce). Il
    // reste acceptable tant qu'aucun HTML n'y est injecté.
    const dossier = join(RACINE, "src/app/questionnaire");
    const sources = fichiers(dossier).filter((f) => /\.tsx?$/.test(f) && !f.includes("__tests__"));
    expect(sources.length).toBeGreaterThan(4);
    for (const f of sources)
      expect(readFileSync(f, "utf8"), f).not.toContain("dangerouslySetInnerHTML");
  });

  it("la page est rendue à la demande et jamais indexée", () => {
    const page = readFileSync(join(RACINE, "src/app/questionnaire/[id]/[jeton]/page.tsx"), "utf8");
    expect(page).toContain('export const dynamic = "force-dynamic"');
    expect(page).toContain("index: false");
    expect(page).not.toContain("generateStaticParams");
  });
});
