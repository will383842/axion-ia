// @vitest-environment node

/**
 * Garde — une alerte de CLIENT ne fait jamais attendre le visiteur (relecture PR 1553).
 *
 * `notify()` peut durer ~24 s (429, supergroupe migré, plusieurs morceaux, repli).
 * Attendu depuis une requête web, c'est le visiteur qui patiente. Le chemin sûr :
 * `notifyApresReponse` (after()), ou l'option `notifier: "apres-reponse"` des
 * fonctions Calendly. Le worker garde `immediat`, où attendre ne gêne personne.
 *
 * Deux règles, lues sur la SOURCE (limite assumée : pas d'exécution de la requête) :
 *  1. aucun fichier hors `server/notifications` ne combine un `notify(` nu et une
 *     catégorie « client » (CLIENT_* + formulaires du salon Clients) ;
 *  2. chaque appel de `enrichCalendlyEvent` / `discoverNewCalendlyEvents` /
 *     `refreshUpcomingCalendlyEvents` écrit `notifier:` en toutes lettres, et
 *     `immediat` n'est permis que dans le worker.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

function fichiers(dir: string, out: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "__tests__" || nom === "node_modules") continue;
      fichiers(chemin, out);
    } else if (/\.(ts|tsx)$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) {
      out.push(chemin);
    }
  }
  return out;
}

const sansCommentaires = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const SOURCES = fichiers(join(RACINE, "src")).map((f) => ({
  chemin: relative(RACINE, f).replaceAll("\\", "/"),
  code: sansCommentaires(readFileSync(f, "utf8")),
}));

const CATEGORIES_CLIENT =
  /\b(CLIENT_CALL_[A-Z]+|CONTACT_FORM_SUBMITTED|AUDIT_REQUEST_SUBMITTED|INTERVENTION_REQUEST_SUBMITTED|IMPLEMENTATION_REQUEST_SUBMITTED|QUOTE_REQUEST_RECEIVED|CUSTOMER_SUPPORT_REQUEST|CHATBOT_LEAD_CAPTURED|CHATBOT_ESCALATION)\b/;

describe("alertes client — jamais attendues par le visiteur", () => {
  it("aucun `notify(` nu avec une catégorie client hors du hub", () => {
    const fautifs = SOURCES.filter(
      (f) =>
        !f.chemin.startsWith("src/server/notifications/") &&
        !f.chemin.startsWith("src/lib/telegram") &&
        /(^|[^\w.])notify\(/.test(f.code) &&
        CATEGORIES_CLIENT.test(f.code),
    ).map((f) => f.chemin);
    expect(fautifs).toEqual([]);
  });

  it("enrich / discover n'appellent pas `notify` directement (ils passent par le mode)", () => {
    for (const chemin of ["src/server/calendly/enrich.ts", "src/server/calendly/discover.ts"]) {
      const code = SOURCES.find((f) => f.chemin === chemin)?.code ?? "";
      expect(code, chemin).not.toMatch(/(^|[^\w.])notify\(/);
      expect(code, chemin).toMatch(/notifierSelonMode\(/);
    }
  });

  const FONCTIONS = [
    "enrichCalendlyEvent",
    "discoverNewCalendlyEvents",
    "refreshUpcomingCalendlyEvents",
  ];
  // Fichiers qui DÉFINISSENT ou relaient l'option (elle y est passée en variable).
  const RELAIS = new Set([
    "src/server/calendly/enrich.ts",
    "src/server/calendly/discover.ts",
    "src/server/calendly/refresh.ts",
  ]);

  it("chaque appelant choisit son mode en toutes lettres", () => {
    const manques: string[] = [];
    let appels = 0;
    for (const f of SOURCES) {
      if (RELAIS.has(f.chemin)) continue;
      for (const fn of FONCTIONS) {
        const re = new RegExp(`(?<![\\w.])${fn}\\(([^()]*(?:\\([^()]*\\)[^()]*)*)\\)`, "g");
        for (const m of f.code.matchAll(re)) {
          appels += 1;
          if (!/notifier:\s*"(apres-reponse|immediat)"/.test(m[1] ?? "")) {
            manques.push(`${f.chemin} → ${fn}(${m[1]})`);
          }
        }
      }
    }
    expect(appels).toBeGreaterThan(5);
    expect(manques).toEqual([]);
  });

  it("`immediat` est réservé au worker", () => {
    const fautifs = SOURCES.filter(
      (f) =>
        !RELAIS.has(f.chemin) &&
        !f.chemin.startsWith("src/server/queue/workers/") &&
        !f.chemin.startsWith("src/server/notifications/") &&
        /notifier:\s*"immediat"/.test(f.code),
    ).map((f) => f.chemin);
    expect(fautifs).toEqual([]);
  });

  it("les requêtes web annulation / report passent par apres-reponse", () => {
    for (const chemin of [
      "src/app/[locale]/appel/annuler/actions.ts",
      "src/app/[locale]/appel/reporter/actions.ts",
      "src/app/api/calendly/webhook/route.ts",
      "src/app/api/internal/calendly-refresh/route.ts",
      "src/features/admin-calendly/actions.ts",
    ]) {
      const code = SOURCES.find((f) => f.chemin === chemin)?.code ?? "";
      expect(code, chemin).toMatch(/notifier:\s*"apres-reponse"/);
      expect(code, chemin).not.toMatch(/notifier:\s*"immediat"/);
    }
  });
});
