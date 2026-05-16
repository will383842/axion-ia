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
//   - Sinon → POST top 15 URLs stratégiques (FR + EN = 30 URLs).
//   - Errors non-fatales (log warn + exit 0 — un build ne doit pas échouer
//     parce qu'IndexNow est down).
//
// V1 = ping fixe top-15. V2 (Sprint 17) = diff git changed-routes only.
// Sprint 21 = diff RSS feed lastModified field.

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

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
  "/implantations/ile-de-france",
  "/implantations/ile-de-france/paris",
  "/audit/par-ville/paris",
  "/interventions/par-ville/paris",
  "/implementation/par-ville/paris",
  "/blog",
] as const;

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
  const keyLocation = `${siteUrl}/${key}.txt`;

  // Build URL list : 15 strategic paths × 2 locales = 30 URLs.
  const urlList = STRATEGIC_PATHS.flatMap((p) => [
    `${siteUrl}/fr${p === "/" ? "" : p}`,
    `${siteUrl}/en${p === "/" ? "" : p}`,
  ]);

  // Image-bank Sprint 4 V1 — append URLs des images publiées (FR + EN).
  // Lecture DB best-effort : si Prisma indisponible (stub.invalid / no DB),
  // on continue sans bloquer le ping des STRATEGIC_PATHS.
  const imageBankUrls = await collectImageBankUrls(siteUrl);
  urlList.push(...imageBankUrls);

  const payload = { host, key, keyLocation, urlList };

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status >= 200 && res.status < 300) {
      console.log(`[indexnow-ping] OK — ${urlList.length} URLs pinged.`);
    } else {
      const body = await res.text().catch(() => "");
      console.warn(
        `[indexnow-ping] non-2xx response : ${res.status} ${res.statusText} — ${body.slice(0, 200)}`,
      );
    }
  } catch (err) {
    console.warn(`[indexnow-ping] error :`, err instanceof Error ? err.message : err);
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
