/**
 * CLIQUET — tout lien interne écrit dans les contenus statiques (`src/content/**`)
 * doit pointer vers une route qui existe.
 *
 * Périmètre : les motifs sans ambiguïté d'un lien rendu au visiteur —
 * `href: "/chemin"` (et toute clé `*href*`), `href="/chemin"` et `](/chemin)` (Markdown). Les champs
 * `en:` (miroirs anglais, redirigés en 301 vers le FR) et les cibles de la
 * console admin (`voirAussi` de `imprimes.ts`, relatives au préfixe admin) ne
 * sont donc pas lus. Un chemin est valide s'il correspond à une entrée FR de
 * `routing.pathnames`, à un fichier `page.tsx`/`route.ts` de `src/app`, ou à un
 * fichier de `public/`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";

const RACINE = process.cwd();

function lister(dossier: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) lister(chemin, sortie);
    else sortie.push(chemin);
  }
  return sortie;
}

function enMotif(chemin: string): RegExp {
  const corps = chemin
    .split("/")
    .map((seg) =>
      /^\[\.\.\./.test(seg)
        ? ".+"
        : seg.startsWith("[")
          ? "[^/]+"
          : seg.replace(/[.*+?^${}()|\\]/g, "\\$&"),
    )
    .join("/");
  return new RegExp(`^${corps}$`);
}

const motifsPathnames = Object.values(
  routing.pathnames as Record<string, string | { fr: string; en: string }>,
).map((v) => enMotif(typeof v === "string" ? v : v.fr));

const motifsApp = lister(join(RACINE, "src", "app"))
  .filter((f) => /[\\/](page|route)\.(tsx|ts)$/.test(f))
  .map((f) =>
    relative(join(RACINE, "src", "app"), join(f, ".."))
      .split(/[\\/]/)
      .filter((s) => s && s !== "[locale]" && !/^\(.*\)$/.test(s))
      .join("/"),
  )
  .map((c) => `/${c}`)
  // Segment racine dynamique = console admin (`/[adminPrefix]/…`) : jamais une cible de contenu public.
  .filter((c) => !c.startsWith("/["))
  .map(enMotif);

function routeExiste(cible: string): boolean {
  if (cible === "/") return true;
  if (existsSync(join(RACINE, "public", cible))) return true;
  return [...motifsPathnames, ...motifsApp].some((m) => m.test(cible));
}

// Fichiers dont les `href` visent la console admin (relatifs au préfixe admin).
const EXCLUS = new Set(["src/content/imprimes.ts"]);

// Morts connus tolérés (vide : le dernier, `/sites-web` dans careers/categories.ts, est corrigé).
const MORTS_CONNUS = new Set<string>();

const MOTIF_LIEN =
  /(?:\b\w*[Hh]ref(?!En\b)\w*\s*[:=]\s*\{?\s*["'`]|\]\()(\/(?:fr\/)?[a-z0-9][A-Za-z0-9_\-/.]*)(?:[#?][^"'`)\s]*)?["'`)]/g;

describe("liens internes des contenus statiques", () => {
  it("pointent tous vers une route existante", () => {
    const morts: string[] = [];
    const fichiers = lister(join(RACINE, "src", "content")).filter(
      (f) => /\.(ts|tsx|md|mdx)$/.test(f) && !/\.(spec|test)\./.test(f) && !f.includes("__tests__"),
    );
    for (const f of fichiers) {
      const rel = relative(RACINE, f).replace(/\\/g, "/");
      if (EXCLUS.has(rel)) continue;
      const texte = readFileSync(f, "utf8");
      for (const m of texte.matchAll(MOTIF_LIEN)) {
        // /en/* est redirigé en 301 vers le FR (EN désactivé) : pas un mort.
        if (/^\/en(?:\/|$)/.test(m[1] ?? "")) continue;
        const cible = (m[1] ?? "").replace(/^\/fr(?=\/|$)/, "").replace(/\/$/, "") || "/";
        if (!routeExiste(cible) && !MORTS_CONNUS.has(`${rel} → ${m[1]}`)) {
          morts.push(`${rel} → ${m[1]}`);
        }
      }
    }
    expect(morts).toEqual([]);
  });
});
