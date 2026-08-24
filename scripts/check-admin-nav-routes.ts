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
const externesInvalides: string[] = [];

// 🔴 2026-08-24 — cette garde a rougi à l'ajout du premier lien EXTERNE (Tiime,
// notre plateforme agréée de facturation). Elle n'avait pas tort : jusque-là,
// toute entrée de nav était une route de cette application, et une entrée sans
// fichier de route était forcément un lien mort.
//
// On ne l'affaiblit donc pas en excluant simplement le cas. On lui apprend les
// DEUX natures, et on exige de chacune ce qui lui correspond :
//   · une entrée INTERNE doit avoir son fichier de route ;
//   · une entrée EXTERNE doit être une URL absolue en https, et ne peut pas
//     être une route interne déguisée — ce qui produirait un `target="_blank"`
//     sur notre propre console.
const internes = items.filter((it) => it.external !== true);
const externes = items.filter((it) => it.external === true);

for (const item of internes) {
  if (!routeExists(ADMIN_ROOT, navSegments(item.href))) {
    missing.push(`${item.label} → ${item.href}`);
  }
}

for (const item of externes) {
  if (!item.href.startsWith("https://")) {
    externesInvalides.push(`${item.label} → ${item.href} (doit être une URL absolue https)`);
  }
}

// Contre-témoin : si `external` était posé en masse par erreur, la boucle
// ci-dessus n'examinerait presque plus rien et la garde passerait au vert en
// n'ayant rien vérifié.
if (internes.length < items.length - 10) {
  console.error(
    `❌ [admin-nav:routes] ${externes.length} entrées marquées \`external\` sur ${items.length} : ` +
      `beaucoup trop. Cette garde ne vérifierait plus rien.`,
  );
  process.exit(1);
}

if (missing.length > 0 || externesInvalides.length > 0) {
  if (missing.length > 0) {
    console.error(`❌ [admin-nav:routes] ${missing.length} entrée(s) sans route :`);
    for (const m of missing) console.error(`  - ${m}`);
  }
  if (externesInvalides.length > 0) {
    console.error(
      `❌ [admin-nav:routes] ${externesInvalides.length} lien(s) externe(s) invalide(s) :`,
    );
    for (const m of externesInvalides) console.error(`  - ${m}`);
  }
  process.exit(1);
}

console.log(
  `✅ [admin-nav:routes] OK — ${internes.length} routes internes résolues, ` +
    `${externes.length} lien(s) externe(s) valides.`,
);
