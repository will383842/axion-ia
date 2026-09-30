/**
 * 🔴 Lot L4 (2026-09-30) — aucun lien interne cassé sur les pages touchées.
 *
 * La refonte « une seule porte » déplace des cibles (fiche 360° → fiche
 * session) et en ajoute (liens retour depuis les fiches formation, formateur,
 * les registres de l'auditeur, « À traiter »). Chaque adresse écrite dans ces
 * pages est ici résolue contre l'ARBRE DES ROUTES réel, sur le modèle de
 * `scripts/check-admin-nav-routes.ts` : un dossier renommé ferait rougir ce
 * test au lieu de laisser un lien vers une 404.
 *
 * Contre-témoin : un extracteur qui ne trouverait plus rien rendrait « 0 lien
 * cassé ». On exige donc un nombre minimal de liens examinés.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ADMIN_ROOT = resolve(process.cwd(), "src/app/[locale]/(admin)/[adminPrefix]");
const A = (p: string) => join(ADMIN_ROOT, p);

const PAGES_TOUCHEES = [
  "qualiopi/sessions/page.tsx",
  "qualiopi/a-traiter/page.tsx",
  "qualiopi/stagiaires/[id]/page.tsx",
  "qualiopi/formations/[id]/page.tsx",
  "qualiopi/formateurs/[id]/page.tsx",
  "qualiopi/mode-auditeur/page.tsx",
  "qualiopi/mode-auditeur/signatures/page.tsx",
  "qualiopi/mode-auditeur/emargement/page.tsx",
  "planning/[type]/[id]/page.tsx",
  "_v2/pilotage/CalendrierPrevisionnel.tsx",
].map(A);

const COMPOSANTS_TOUCHES = [
  "src/components/admin/qualiopi/SessionsLiees.tsx",
  "src/components/admin/qualiopi/ParcoursStagiaire.tsx",
].map((p) => resolve(process.cwd(), p));

/** Retire les commentaires : une route RETIRÉE y est souvent citée, à dessein. */
function sansCommentaires(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/(^|[^:"'`])\/\/.*$/, "$1"))
    .join("\n");
}

/**
 * Les chemins de la console écrits dans une source : `/qualiopi/…`,
 * `/planning/…`, `/coaching/…` — hors `/api/…`, qui n'est pas une page.
 * Un segment `${…}` devient `*` (segment quelconque).
 */
function chemins(src: string): string[] {
  const out = new Set<string>();
  const re = /(?<![\w-])(\/(?:qualiopi|planning|coaching)(?:\/(?:\$\{[^}]*\}|[\w-]+))*)/g;
  for (const m of sansCommentaires(src).matchAll(re)) {
    const debut = m.index ?? 0;
    const avant = src.length > 0 ? sansCommentaires(src).slice(Math.max(0, debut - 4), debut) : "";
    if (avant.endsWith("/api")) continue;
    out.add((m[1] ?? "").replace(/\$\{[^}]*\}/g, "*"));
  }
  return [...out];
}

function routeExiste(dir: string, segments: string[]): boolean {
  if (segments.length === 0) return existsSync(join(dir, "page.tsx"));
  const [tete, ...reste] = segments as [string, ...string[]];
  let entrees: string[];
  try {
    entrees = readdirSync(dir);
  } catch {
    return false;
  }
  for (const e of entrees) {
    const plein = join(dir, e);
    if (!statSync(plein).isDirectory()) continue;
    if (e.startsWith("(") && e.endsWith(")")) {
      if (routeExiste(plein, segments)) return true;
      continue;
    }
    const dynamique = e.startsWith("[") && e.endsWith("]");
    if (e === tete || dynamique || tete === "*") {
      if (routeExiste(plein, reste)) return true;
    }
  }
  return false;
}

describe("lot L4 — liens internes des pages touchées", () => {
  it("chaque adresse de la console se résout sur une page réelle", () => {
    const casses: string[] = [];
    let examines = 0;
    for (const f of [...PAGES_TOUCHEES, ...COMPOSANTS_TOUCHES]) {
      for (const c of chemins(readFileSync(f, "utf8"))) {
        examines++;
        if (!routeExiste(ADMIN_ROOT, c.split("/").filter(Boolean))) {
          casses.push(`${f.replace(process.cwd(), "")} → ${c}`);
        }
      }
    }
    expect(casses).toEqual([]);
    // Contre-témoin : l'extracteur voit bien les liens des pages.
    expect(examines).toBeGreaterThan(20);
  });

  it("l'extracteur n'est pas aveugle : il voit une route absente", () => {
    expect(routeExiste(ADMIN_ROOT, ["qualiopi", "sessions", "*"])).toBe(true);
    expect(routeExiste(ADMIN_ROOT, ["qualiopi", "route-qui-n-existe-pas"])).toBe(false);
    expect(chemins("href={`${base}/qualiopi/sessions/${s.id}/emargement`}")).toEqual([
      "/qualiopi/sessions/*/emargement",
    ]);
    expect(chemins("href={`/api/qualiopi/documents/${id}`}")).toEqual([]);
  });
});

describe("lot L4 — une seule porte vers la fiche session", () => {
  it("la liste des sessions n'a qu'UN lien d'action par ligne", () => {
    const src = readFileSync(A("qualiopi/sessions/page.tsx"), "utf8");
    const corps = src.slice(src.indexOf("<tbody>"), src.indexOf("</tbody>"));
    expect(corps.length).toBeGreaterThan(0);
    expect(corps.match(/<Link\b/g) ?? []).toHaveLength(1);
    expect(corps).not.toMatch(/\/emargement`|\/evaluations`|\/financement`/);
  });

  it("le Calendrier prévisionnel n'écrit plus aucune cible /planning/ en dur", () => {
    const src = sansCommentaires(readFileSync(A("_v2/pilotage/CalendrierPrevisionnel.tsx"), "utf8"));
    expect(src).not.toMatch(/\/planning\/(formation|\$\{)/);
  });

  it("les registres de l'auditeur renvoient à la fiche session", () => {
    for (const f of ["signatures", "emargement"]) {
      const src = sansCommentaires(
        readFileSync(A(`qualiopi/mode-auditeur/${f}/page.tsx`), "utf8"),
      );
      expect(src, f).toMatch(/\$\{sessionsHref\}\/\$\{[^}]*sessionId\}/);
    }
  });

  it("les fiches stagiaire, formation et formateur listent leurs sessions avec un lien", () => {
    const composant = readFileSync(COMPOSANTS_TOUCHES[0] as string, "utf8");
    expect(composant).toMatch(/href=\{`\$\{sessionsHref\}\/\$\{s\.id\}`\}/);
    for (const f of ["qualiopi/formations/[id]/page.tsx", "qualiopi/formateurs/[id]/page.tsx"]) {
      expect(readFileSync(A(f), "utf8"), f).toContain("<SessionsLieesSection");
    }
    expect(readFileSync(A("qualiopi/stagiaires/[id]/page.tsx"), "utf8")).toContain(
      "sessionsHref={`/${locale}/${adminPrefix}/qualiopi/sessions`}",
    );
    const parcours = readFileSync(COMPOSANTS_TOUCHES[1] as string, "utf8");
    expect(parcours).toMatch(/href=\{`\$\{sessionsHref\}\/\$\{i\.sessionId\}`\}/);
  });
});
