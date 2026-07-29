// Vérifie que CHAQUE entrée de la navigation admin pointe sur une route qui
// existe réellement sur le disque (refonte « Boîte de réception » 2026-07-29).
//
// Pourquoi : `buildAdminNav()` est un SSOT de chaînes de caractères. Rien, ni le
// compilateur ni les tests d'origine, ne relie ces chaînes aux fichiers
// `page.tsx` correspondants — un renommage de dossier laisse donc une entrée de
// menu qui mène à un 404, en silence. C'est exactement le risque qu'introduit un
// déplacement de routes ; ce script le ferme.
//
// Résolution : on retire le préfixe `/fr/<adminPrefix>` puis on cherche, sous
// `src/app/[locale]/(admin)/[adminPrefix]/`, un `page.tsx` dont le chemin
// correspond segment à segment — un segment dynamique `[x]` acceptant n'importe
// quel segment concret.

import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildAdminNav } from "../src/lib/admin-nav";

const ADMIN_ROOT = resolve(process.cwd(), "src/app/[locale]/(admin)/[adminPrefix]");
const PREFIX = "test-prefix";

/** Segments concrets d'une route de nav (`/fr/p/a/b` → ["a","b"]). */
function navSegments(href: string): string[] {
  const withoutBase = href.replace(`/fr/${PREFIX}`, "");
  return withoutBase.split("/").filter(Boolean);
}

/**
 * Vrai s'il existe un `page.tsx` atteignable pour ces segments.
 * Les dossiers de groupe `(x)` sont transparents ; `[x]` matche tout segment.
 */
function routeExists(dir: string, segments: string[]): boolean {
  if (segments.length === 0) return existsSync(join(dir, "page.tsx"));
  const [head, ...tail] = segments as [string, ...string[]];

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return false;
  }

  for (const entry of entries) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    // Groupe de route « (admin) » : invisible dans l'URL, on descend sans
    // consommer de segment.
    if (entry.startsWith("(") && entry.endsWith(")")) {
      if (routeExists(full, segments)) return true;
      continue;
    }
    const isDynamic = entry.startsWith("[") && entry.endsWith("]");
    if (entry === head || isDynamic) {
      if (routeExists(full, tail)) return true;
    }
  }
  return false;
}

const items = buildAdminNav(PREFIX);
const missing: string[] = [];

for (const item of items) {
  if (!routeExists(ADMIN_ROOT, navSegments(item.href))) {
    missing.push(`${item.label} → ${item.href}`);
  }
}

if (missing.length > 0) {
  console.error(`❌ [admin-nav:routes] ${missing.length} entrée(s) sans route :`);
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}

console.log(`✅ [admin-nav:routes] OK — ${items.length} entrées, toutes résolues.`);
