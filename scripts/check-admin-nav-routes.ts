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

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
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

// ═════════════════════════════════════════════════════════════════════════════
//  DEUXIÈME PASSE — L'ADAPTATEUR MCP NE DOIT JAMAIS RENDRE UN LIEN D'ADMIN
// ═════════════════════════════════════════════════════════════════════════════
//
// ⚠️ `ADMIN_URL_PREFIX` EST UN SEGMENT DE SÉCURITÉ, pas un chemin ordinaire.
//    En production il vaut quelque chose comme `admin-xxxxxxxx` : c'est ce qui
//    fait qu'un balayeur ne trouve pas la console. Un outil MCP qui rendrait un
//    `detailHref` le recopierait dans une réponse — donc, un jour, dans une
//    transcription, un journal, ou l'écran de quelqu'un d'autre.
//
//    Le cahier des charges le tranche en une phrase : « AUCUN outil ne rend de
//    detailHref ». Cette passe le REND VÉRIFIABLE, au lieu de compter sur la
//    relecture.
//
// ⚠️ ELLE ANNONCE COMBIEN DE FICHIERS ELLE A LUS. Sans ce compte, un adaptateur
//    rangé ailleurs rendrait la garde muette sans un mot — le défaut mesuré sur
//    `surface-server-actions.spec.ts`.

const RACINE_MCP = resolve(process.cwd(), "src/server/mcp");

/** Ce qu'un fichier de l'adaptateur ne doit pas contenir, et pourquoi. */
const INTERDITS_DANS_MCP: readonly { readonly motif: RegExp; readonly quoi: string }[] = [
  { motif: /\badminPath\s*\(/, quoi: "adminPath() construit une URL de console" },
  { motif: /ADMIN_URL_PREFIX/, quoi: "le préfixe d'administration est un segment de sécurité" },
  { motif: /detailHref/, quoi: "aucun outil ne rend de detailHref (§ 28)" },
  { motif: /["'`]\/(?:fr|en)\/admin/, quoi: "un chemin de console écrit en dur" },
];

function fichiersDeLAdaptateur(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "__tests__" || nom === "node_modules") continue;
      out.push(...fichiersDeLAdaptateur(chemin));
      continue;
    }
    if (!/\.tsx?$/.test(nom)) continue;
    if (/\.(?:test|spec)\.tsx?$/.test(nom)) continue;
    out.push(chemin);
  }
  return out;
}

const fichiersMcp = fichiersDeLAdaptateur(RACINE_MCP);
const violationsMcp: string[] = [];

for (const chemin of fichiersMcp) {
  const source = readFileSync(chemin, "utf8");
  for (const { motif, quoi } of INTERDITS_DANS_MCP) {
    if (motif.test(source)) {
      violationsMcp.push(`${relative(process.cwd(), chemin)} → ${quoi}`);
    }
  }
}

if (violationsMcp.length > 0) {
  console.error(
    `❌ [admin-nav:routes] ${violationsMcp.length} fuite(s) de chemin d'administration ` +
      `dans l'adaptateur MCP (${fichiersMcp.length} fichier(s) lu(s)) :`,
  );
  for (const v of violationsMcp) console.error(`  - ${v}`);
  process.exit(1);
}

console.log(
  `✅ [admin-nav:routes] OK — ${internes.length} routes internes résolues, ` +
    `${externes.length} lien(s) externe(s) valides · ` +
    `${fichiersMcp.length} fichier(s) d'adaptateur MCP lu(s), ` +
    `${INTERDITS_DANS_MCP.length} motif(s) interdit(s) confronté(s).`,
);
