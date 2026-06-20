#!/usr/bin/env node
// @ts-check
/**
 * Cloudflare Cache Rule — couvre TOUTES les pages HTML publiques en cache edge.
 *
 * Contexte (audit indexation 2026-06-20) : les curls prod montrent que le HTML
 * EST déjà caché (cf-cache-status: HIT au 2e hit, s-maxage respecté) — donc une
 * règle cacheEverything existe probablement DÉJÀ. Ce script :
 *   1. INSPECTE le ruleset cache existant (phase http_request_cache_settings) et
 *      affiche les règles en place — pour ne RIEN casser à l'aveugle.
 *   2. En dry-run (défaut) : montre la règle qu'il POSERAIT, sans rien écrire.
 *   3. Avec `--apply` : upsert idempotent d'UNE règle gérée (marquée par sa
 *      description) couvrant le GET HTML public, en EXCLUANT les chemins sensibles.
 *
 * Sûreté (anti-fuite de pages authentifiées) :
 *   - `edge_ttl.mode = "respect_origin"` → Cloudflare respecte le `Cache-Control`
 *     de l'origine. Les réponses admin/privées renvoient `private, no-store`
 *     (posé par `src/proxy.ts`) → JAMAIS cachées, même si elles matchent l'expr.
 *   - Exclusion explicite des préfixes sensibles dans l'expression (ceinture +
 *     bretelles) : /api, admin, /mes-donnees, /reserver, espaces, /_next/data.
 *   - `--apply` requis pour écrire ; dry-run par défaut.
 *
 * Usage :
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ZONE_ID=... node scripts/cf-cache-rule.mjs
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ZONE_ID=... node scripts/cf-cache-rule.mjs --apply
 *
 * Token requis : permission « Zone › Cache Rules › Edit » (ou Zone.Cache Settings).
 */

const API = "https://api.cloudflare.com/client/v4";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ZONE = process.env.CLOUDFLARE_ZONE_ID;
const APPLY = process.argv.includes("--apply");

const RULE_DESCRIPTION = "axion-ia: cache HTML public (managed by scripts/cf-cache-rule.mjs)";

// Expression Cloudflare : GET, et PAS un chemin sensible. On laisse `respect_origin`
// trancher la cacheabilité fine via le Cache-Control (no-store → non caché).
const EXPRESSION = [
  '(http.request.method eq "GET")',
  "and not (",
  '  starts_with(http.request.uri.path, "/api/")',
  '  or starts_with(http.request.uri.path, "/_next/data/")',
  '  or http.request.uri.path contains "/mes-donnees"',
  '  or http.request.uri.path contains "/reserver"',
  '  or http.request.uri.path contains "/espace-"',
  '  or http.request.uri.path contains "admin"',
  '  or http.request.uri.path contains "/api/auth"',
  ")",
].join("\n");

if (!TOKEN || !ZONE) {
  console.error("✖ CLOUDFLARE_API_TOKEN et CLOUDFLARE_ZONE_ID requis dans l'env.");
  process.exit(1);
}

/** @param {string} path @param {RequestInit} [init] */
async function cf(path, init) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    console.error(`✖ CF API ${res.status} ${path}`);
    console.error(JSON.stringify(json.errors ?? json, null, 2));
    process.exit(1);
  }
  return json.result;
}

const CACHE_PHASE = "http_request_cache_settings";

async function main() {
  console.log(
    `Zone: ${ZONE}  —  mode: ${APPLY ? "APPLY (écriture)" : "DRY-RUN (lecture seule)"}\n`,
  );

  // 1) Inspecter le ruleset cache existant (entrypoint de la phase).
  let ruleset;
  try {
    ruleset = await cf(`/zones/${ZONE}/rulesets/phases/${CACHE_PHASE}/entrypoint`);
  } catch {
    ruleset = null;
  }
  const existingRules = ruleset?.rules ?? [];
  console.log(`── Règles cache existantes (${existingRules.length}) ──`);
  for (const r of existingRules) {
    console.log(
      `  • [${r.enabled === false ? "OFF" : "ON "}] ${r.description || "(sans description)"}`,
    );
    console.log(`      expr: ${String(r.expression).replace(/\s+/g, " ").slice(0, 120)}`);
    const ap = r.action_parameters ?? {};
    console.log(
      `      action: ${r.action}  cache=${ap.cache}  edge_ttl=${ap.edge_ttl?.mode ?? "-"}`,
    );
  }
  console.log("");

  // 2) Construire la règle gérée.
  const managedRule = {
    description: RULE_DESCRIPTION,
    expression: EXPRESSION,
    action: "set_cache_settings",
    action_parameters: {
      cache: true, // cacheEverything : rend le HTML éligible (CF skip le HTML par défaut)
      edge_ttl: { mode: "respect_origin" }, // respecte s-maxage/no-store de l'origine
      browser_ttl: { mode: "respect_origin" },
    },
    enabled: true,
  };

  console.log("── Règle gérée (cible) ──");
  console.log(`  description: ${managedRule.description}`);
  console.log(
    `  expression:\n${EXPRESSION.split("\n")
      .map((l) => "    " + l)
      .join("\n")}`,
  );
  console.log(`  cache=true  edge_ttl=respect_origin  browser_ttl=respect_origin\n`);

  if (!APPLY) {
    console.log(
      "DRY-RUN : aucune écriture. Relance avec --apply pour poser/mettre à jour la règle.",
    );
    console.log(
      "⚠️ Si une règle cacheEverything existe DÉJÀ ci-dessus, vérifie qu'elle ne fait pas",
    );
    console.log("   doublon avant d'appliquer (le cache HTML marche déjà en prod = HIT mesuré).");
    return;
  }

  // 3) Upsert idempotent : remplacer la règle gérée si déjà présente, sinon append.
  const others = existingRules
    .filter((r) => r.description !== RULE_DESCRIPTION)
    .map((r) => ({
      // On ré-émet les règles existantes telles quelles (préserve l'ordre/contenu).
      description: r.description,
      expression: r.expression,
      action: r.action,
      action_parameters: r.action_parameters,
      enabled: r.enabled,
    }));
  const nextRules = [...others, managedRule];

  await cf(`/zones/${ZONE}/rulesets/phases/${CACHE_PHASE}/entrypoint`, {
    method: "PUT",
    body: JSON.stringify({ rules: nextRules }),
  });
  console.log(`✅ Règle posée/mise à jour. Total règles cache: ${nextRules.length}`);
  console.log("Vérifie ensuite :");
  console.log(
    "  curl -sI https://axion-ia.com/fr/audit | grep -i cf-cache-status   # attendu: HIT (2e hit)",
  );
  console.log(
    "  curl -sI https://axion-ia.com/<adminPrefix>/login | grep -i cf-cache # attendu: BYPASS/MISS (no-store)",
  );
}

main();
