// Marker ES module — isolation namespace vs autres scripts dossier `scripts/`
// (avoid duplicate `INDEXNOW_ENDPOINT` global redecl with daily-indexnow-resubmit.ts).
export {};

// IndexNow ping post-build — patch C1+C6 cert 2026-05-08.
//
// Critère 5.2 audit C6 : « IndexNow endpoint passif sans caller » → résolu.
// Lance `pnpm postbuild` (hook automatique) et POST batch URLs stratégiques
// à api.indexnow.org pour signaler à Bing/Yandex que les pages sont fraîches.
//
// Bénéfice : time-to-index ≤ 24-48h sur Bing au lieu de 7+ jours en crawl
// passif (cible cert : ≥ 80 % indexation J+30 sur nouvelles URLs).
//
// Comportement :
//   - Si `INDEXNOW_KEY` ou `NEXT_PUBLIC_SITE_URL` non définis → no-op exit 0.
//     C'est attendu en dev / preview Vercel / CI sans secret.
//   - Sinon → POST URLs stratégiques + villes indexable + services × villes.
//   - Errors non-fatales (log warn + exit 0 — un build ne doit pas échouer
//     parce qu'IndexNow est down).
//
// Audit indexation 2026-05-18 P0-5 — découverte dynamique villes indexable.
// Avant ce patch, seules les 15 STRATEGIC_PATHS (avec Paris hardcodé) étaient
// pingées post-build. Toute nouvelle ville promue via `content/villes.ts`
// (copy + copy.services) restait invisible à IndexNow jusqu'au prochain
// publish factory. Maintenant, on enrichit dynamiquement avec :
//   - 1 URL hub par ville indexable : `/implantations/<region>/<ville>`
//   - 3 URLs services × ville si `copy.services.<svc>` présent
//   - Respect EN_LOCALE_ENABLED (strip /en/* si toggle OFF, 2026-05-16 EN OFF)
//
// V1 = ping fixe top-15 + villes dynamique. V2 (Sprint 17) = diff git changed-routes only.
// Sprint 21 = diff RSS feed lastModified field.

import { submitToIndexNow } from "../src/lib/indexnow";

const STRATEGIC_PATHS = [
  "/",
  "/audit",
  "/interventions",
  "/implementation",
  "/cas-concrets",
  "/methodologie",
  "/comparaisons",
  "/stack-ia",
  "/implantations",
  "/blog",
] as const;

// Services × villes — émis depuis `getIndexableVilles()` quand
// `ville.copy.services.<svc>` présent (pattern aligné `app/sitemap.ts`).
const SERVICE_VILLES_PATHS = {
  audit: "/audit/par-ville",
  interventions: "/interventions/par-ville",
  implementation: "/implementation/par-ville",
} as const;

async function main(): Promise<void> {
  const key = process.env["INDEXNOW_KEY"];
  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"];

  if (!key || !siteUrl) {
    console.log(
      "[indexnow-ping] skipped — INDEXNOW_KEY or NEXT_PUBLIC_SITE_URL not set (dev/preview).",
    );
    return;
  }

  // Skip pinging if we're on localhost (dev / CI without prod env).
  if (siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1")) {
    console.log("[indexnow-ping] skipped — SITE_URL points to localhost.");
    return;
  }

  const host = new URL(siteUrl).host;

  // Audit indexation 2026-05-18 P0-5 — respect EN_LOCALE_ENABLED (2026-05-16 EN OFF).
  // Émet uniquement les URLs des locales effectivement servies en prod.
  const enEnabled = process.env["EN_LOCALE_ENABLED"] === "true";
  const effectiveLocales = enEnabled ? (["fr", "en"] as const) : (["fr"] as const);

  // Build URL list : strategic paths × locales.
  const urlList: string[] = [];
  for (const p of STRATEGIC_PATHS) {
    for (const locale of effectiveLocales) {
      urlList.push(`${siteUrl}/${locale}${p === "/" ? "" : p}`);
    }
  }

  // Audit indexation 2026-05-18 P0-5 — découverte dynamique villes indexable.
  // Aligné `app/sitemap.ts buildVillesByRegionSitemap` + `buildServicesVillesSitemap`.
  const cityUrls = await collectIndexableCityUrls(siteUrl, effectiveLocales);
  urlList.push(...cityUrls);

  // Image-bank Sprint 4 V1 — append URLs des images publiées (FR + EN).
  // Lecture DB best-effort : si Prisma indisponible (stub.invalid / no DB),
  // on continue sans bloquer le ping des STRATEGIC_PATHS.
  const imageBankUrls = await collectImageBankUrls(siteUrl);
  urlList.push(...imageBankUrls);

  // Cascade d'endpoints (SSOT `src/lib/indexnow.ts`) : `api.indexnow.org`
  // renvoie 403 `UserForbiddedToAccessSite` pour ce domaine — problème back-end
  // Microsoft, pas un défaut de notre clé (cf. le commentaire du SSOT).
  const result = await submitToIndexNow(host, key, urlList);
  if (result.accepted) {
    console.log(`[indexnow-ping] OK — ${urlList.length} URLs acceptées par ${result.accepted}.`);
    // Un endpoint a beau accepter, si l'agrégateur refuse c'est que Bing ne
    // reçoit rien : on le dit, sinon le run reste vert et l'anomalie invisible.
    const refus = result.attempts.filter((a) => !a.endsWith("OK"));
    if (refus.length > 0) {
      warn(`endpoint(s) en échec malgré le succès global — ${refus.join(" | ")}`);
    }
  } else {
    // ⚠️ On n'échoue PAS le déploiement pour une indisponibilité tierce, mais on
    // laisse une annotation VISIBLE dans le résumé du run. Le `|| true` du
    // workflow rendait ce cas totalement muet auparavant.
    warn(`AUCUN endpoint n'a accepté les ${urlList.length} URLs — ${result.attempts.join(" | ")}`);
  }
}

/** Annotation GitHub Actions — visible dans le résumé du run, pas noyée dans le log. */
function warn(message: string): void {
  console.warn(
    process.env["GITHUB_ACTIONS"] === "true"
      ? `::warning title=IndexNow::${message}`
      : `[indexnow-ping] ${message}`,
  );
}

/**
 * Audit indexation 2026-05-18 P0-5 — discovery dynamique villes indexable.
 *
 * Récupère via `getIndexableVilles()` (FS, pas DB) toutes les villes ayant
 * un `copy` substantiel + leurs services × ville quand `copy.services.<svc>`
 * est présent. Pattern identique à `app/sitemap.ts` builders :
 *   - Hub ville : `/{locale}/implantations/{region}/{ville}`
 *   - Services × ville : `/{locale}/{service}/par-ville/{ville}`
 *
 * Import dynamique car le script est exécuté postbuild (Node.js), pas Next
 * runtime — pas de `@/` alias direct, mais `../src/...` relative OK.
 * Fail-soft : si import échoue (path issue ou dep manquant), on continue
 * sans bloquer les STRATEGIC_PATHS.
 */
async function collectIndexableCityUrls(
  siteUrl: string,
  effectiveLocales: ReadonlyArray<"fr" | "en">,
): Promise<string[]> {
  try {
    // Drip indexation (Will 2026-05-28) — on ne signale à IndexNow (Bing/Yandex)
    // QUE la cohorte indexable du jour (`getVillesIndexableNow`), pas les 2157
    // villes éligibles. Cohérent avec le sitemap + les meta robots : on ne pousse
    // jamais plus de villes au crawl que ce qui est réellement index:true
    // aujourd'hui. La cohorte s'élargissant (+50/jour), les pings successifs
    // couvrent progressivement tout le corpus.
    const { getVillesIndexableNow } = await import("../src/content/villes");
    const villes = getVillesIndexableNow();
    const urls: string[] = [];
    for (const ville of villes) {
      // Hub ville : /{locale}/implantations/{region}/{ville}
      for (const locale of effectiveLocales) {
        const segment = locale === "fr" ? "implantations" : "locations";
        urls.push(`${siteUrl}/${locale}/${segment}/${ville.region}/${ville.slug}`);
      }
      // Services × ville : /{locale}/{service}/par-ville/{ville} (EN: /by-city/).
      // Aligné `app/sitemap.ts SERVICE_VILLES_PATHS` (pathFr / pathEn miroir).
      for (const [svc, pathFr] of Object.entries(SERVICE_VILLES_PATHS)) {
        const svcKey = svc as keyof typeof SERVICE_VILLES_PATHS;
        if (!ville.copy?.services?.[svcKey]) continue;
        for (const locale of effectiveLocales) {
          const path = locale === "fr" ? pathFr : pathFr.replace("/par-ville", "/by-city");
          urls.push(`${siteUrl}/${locale}${path}/${ville.slug}`);
        }
      }
    }
    return urls;
  } catch (err) {
    console.warn(
      `[indexnow-ping] dynamic city URLs skipped :`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

async function collectImageBankUrls(siteUrl: string): Promise<string[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return [];
  }
  try {
    const { prisma } = await import("../src/lib/prisma");
    const translations = await prisma.imageAssetTranslation.findMany({
      where: {
        isPublished: true,
        image: {
          deletedAt: null,
          isActive: true,
          publishedAt: { not: null },
        },
      },
      select: { slug: true, languageCode: true },
      take: 1000,
    });
    const urls: string[] = [];
    for (const t of translations) {
      const segment = t.languageCode === "fr" ? "galerie" : "gallery";
      urls.push(`${siteUrl}/${t.languageCode}/${segment}/${t.slug}`);
    }
    return urls;
  } catch (err) {
    console.warn(
      `[indexnow-ping] image-bank URLs skipped :`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

void main();
