/**
 * Garde-fou CI anti-dérive-de-nommage — audit positionnement (Will 2026-07-28).
 *
 * Doctrine : `src/content/services.ts` est la SEULE source de vérité du NOM des
 * 5 services Axion-IA. Ce test échoue si un nom de service réapparaît en dur
 * ailleurs, ou si un ancien nom (abandonné) refait surface.
 *
 * Pourquoi ce test existe — l'audit de positionnement du 2026-07-28 a mesuré,
 * pour un même service, jusqu'à CINQ noms simultanément en production :
 *   « Sites web & SaaS Native IA » (officiel) / « Sites web Native IA » (nav)
 *   / « Sites web & SaaS IA » (footer) / « Sites web augmentés IA » (home)
 *   / « Sites web & SaaS augmentés par l'IA » (title SEO)
 * Conséquence mesurable : les moteurs génératifs (ChatGPT Search, Perplexity,
 * Google AI Overviews) n'arrivaient pas à consolider une entité « service
 * Axion-IA » — chaque variante était traitée comme une offre distincte.
 *
 * Le SSOT existait pourtant depuis le 2026-06-10. Il autorisait 3 variantes
 * d'affichage ; ces variantes ont dérivé en 3 noms réels, puis les pages ont
 * ajouté les leurs. Un SSOT sans enforcement n'est qu'une convention. D'où ce
 * fichier.
 *
 * ── Ce qui est vérifié ─────────────────────────────────────────────────────
 *   1. INVARIANT navShort : la troncature header est un PRÉFIXE STRICT du nom
 *      officiel. Ce n'est jamais « un autre nom », juste le même nom coupé.
 *   2. UNICITÉ : deux services ne partagent pas un nom.
 *   3. NOMS MORTS : aucun libellé abandonné ne subsiste dans les surfaces
 *      publiques scannées.
 *
 * ── Échappatoires légitimes ────────────────────────────────────────────────
 *   (a) le fichier `services.ts` lui-même (la SSOT — il CITE les noms morts
 *       dans son commentaire d'historique, c'est voulu) ;
 *   (b) un marqueur de ligne `service-name-exempt` (commentaire) ;
 *   (c) l'allowlist `EXEMPT_FILES` ci-dessous — miroirs de valeurs PERSISTÉES
 *       en base, qu'on ne peut pas renommer sans migration.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { SERVICES } from "@/content/services";

const SRC = path.resolve(process.cwd(), "src");

// ── Noms abandonnés — ne doivent plus apparaître nulle part ─────────────────
// Chacun a été remplacé par le nom officiel courant. Ajouter ici tout nom
// retiré du SSOT, pour qu'il ne puisse jamais revenir par copier-coller.
const DEAD_NAMES: ReadonlyArray<{ dead: string; replacement: string }> = [
  { dead: "Formations & interventions IA", replacement: "Formations IA" },
  { dead: "AI training & sessions", replacement: "AI training" },
  { dead: "Accompagnement 1 to 1", replacement: "Coaching IA 1-to-1" },
  { dead: "Accompagnement un à un", replacement: "Coaching IA 1-to-1" },
  { dead: "Implémentation & automatisation IA", replacement: "Implémentation IA" },
  { dead: "AI implementation & automation", replacement: "AI implementation" },
  { dead: "Sites web & SaaS Native IA", replacement: "Sites web & SaaS IA" },
  { dead: "Sites web Native IA", replacement: "Sites web & SaaS IA" },
  { dead: "Sites web augmentés IA", replacement: "Sites web & SaaS IA" },
  { dead: "AI-native websites & SaaS", replacement: "AI websites & SaaS" },
];

// ── Fichiers exemptés ───────────────────────────────────────────────────────
// Chemins relatifs à src/, séparateur `/`.
const EXEMPT_FILES: ReadonlySet<string> = new Set([
  // La SSOT elle-même : son en-tête documente l'historique des renommages et
  // cite donc volontairement les noms morts.
  "content/services.ts",
  // Ce test (il liste les noms morts par construction).
  "content/__tests__/services-ssot.spec.ts",
  // ⚠️ MIROIR DB — les libellés de `BLOG_CATEGORY_LABELS` doivent matcher
  // `name_fr`/`name_en` de la migration 20260616180000 déjà appliquée en prod.
  // Les renommer côté code SANS migration désynchroniserait les pages catégorie
  // du blog (résolution de label sans requête DB au build stub, cf. ADR 0026).
  // TODO(Will) : aligner via migration si l'on veut « Implémentation IA » aussi
  // comme nom de catégorie blog. Hors périmètre de l'audit positionnement.
  "server/content-gen/lib/category-mapper.ts",
]);

const EXEMPT_LINE_MARKER = "service-name-exempt";

// ── Surfaces scannées ───────────────────────────────────────────────────────
interface SurfaceRoot {
  dir: string;
  recursive: boolean;
  match: (absPath: string) => boolean;
}

const isSource = (p: string): boolean =>
  (p.endsWith(".ts") || p.endsWith(".tsx")) &&
  !p.endsWith(".test.ts") &&
  !p.endsWith(".test.tsx") &&
  !p.endsWith(".spec.ts") &&
  !p.endsWith(".spec.tsx");

const ROOTS: ReadonlyArray<SurfaceRoot> = [
  // Pages publiques (le route-group (admin) est noindex — hors sujet SEO/AEO).
  {
    dir: path.join(SRC, "app"),
    recursive: true,
    match: (p) => isSource(p) && !p.includes(`${path.sep}(admin)${path.sep}`),
  },
  { dir: path.join(SRC, "components"), recursive: true, match: isSource },
  { dir: path.join(SRC, "content"), recursive: true, match: isSource },
  // Messages i18n — c'est là que vivaient `value1Action`…`value5Action`.
  {
    dir: path.join(SRC, "messages"),
    recursive: false,
    match: (p) => p.endsWith(".json"),
  },
];

function walk(dir: string, recursive: boolean, match: (p: string) => boolean): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    if (statSync(abs).isDirectory()) {
      if (recursive && entry !== "node_modules") out = out.concat(walk(abs, true, match));
    } else if (match(abs)) {
      out.push(abs);
    }
  }
  return out;
}

function relFromSrc(abs: string): string {
  return path.relative(SRC, abs).split(path.sep).join("/");
}

function collectFiles(): string[] {
  const seen = new Set<string>();
  for (const root of ROOTS) {
    for (const f of walk(root.dir, root.recursive, root.match)) seen.add(f);
  }
  return [...seen].filter((f) => !EXEMPT_FILES.has(relFromSrc(f)));
}

describe("SSOT nommage des services", () => {
  it("navShort est un préfixe strict du nom officiel (FR et EN)", () => {
    const violations: string[] = [];
    for (const s of SERVICES) {
      if (!s.officialFr.startsWith(s.navShortFr)) {
        violations.push(
          `[${s.id}] navShortFr « ${s.navShortFr} » n'est pas un préfixe de officialFr « ${s.officialFr} »`,
        );
      }
      if (!s.officialEn.startsWith(s.navShortEn)) {
        violations.push(
          `[${s.id}] navShortEn « ${s.navShortEn} » n'est pas un préfixe de officialEn « ${s.officialEn} »`,
        );
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("aucun nom de service n'est partagé par deux services", () => {
    const fr = SERVICES.map((s) => s.officialFr);
    const en = SERVICES.map((s) => s.officialEn);
    expect(new Set(fr).size).toBe(fr.length);
    expect(new Set(en).size).toBe(en.length);
  });

  it("aucun nom de service abandonné ne subsiste dans les surfaces publiques", () => {
    const violations: string[] = [];

    for (const abs of collectFiles()) {
      const rel = relFromSrc(abs);
      const lines = readFileSync(abs, "utf8").split(/\r?\n/);

      lines.forEach((line, i) => {
        if (line.includes(EXEMPT_LINE_MARKER)) return;
        for (const { dead, replacement } of DEAD_NAMES) {
          if (line.includes(dead)) {
            violations.push(
              `${rel}:${i + 1} — nom abandonné « ${dead} » (utiliser « ${replacement} » via serviceOfficial(), ou marquer la ligne \`${EXEMPT_LINE_MARKER}\`)`,
            );
          }
        }
      });
    }

    expect(
      violations,
      `\n${violations.length} nom(s) de service abandonné(s) encore présent(s) :\n${violations.join("\n")}\n`,
    ).toEqual([]);
  });
});
