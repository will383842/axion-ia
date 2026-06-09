/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-expressions, no-empty */
// Seed prod (CommonJS) — exécuté DANS le conteneur app : utilise le client Prisma
// généré (/app/prisma/generated/client) + le DATABASE_URL interne du conteneur
// (jamais affiché). Lit careers_seed_input.json + ./<slug>.json (même dossier).
const { PrismaClient } = require("/app/prisma/generated/client");
const fs = require("fs");
const path = require("path");

const DIR = __dirname; // /tmp/careers-seed (careers-gen + input copiés ici)
const prisma = new PrismaClient();

const stripHtml = (h) =>
  h
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const cut = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…");

async function main() {
  const input = JSON.parse(
    fs.readFileSync(path.join(DIR, "careers_seed_input.json"), "utf8"),
  );
  const ALL_CITIES = [
    { city: "Saint-Marcellin", region: "Isère — Auvergne-Rhône-Alpes" },
    ...input.cities,
  ];
  let created = 0,
    updated = 0;
  const missing = [];
  for (const p of input.postes) {
    const genPath = path.join(DIR, p.slug + ".json");
    if (!fs.existsSync(genPath)) {
      missing.push(p.slug);
      continue;
    }
    const c = JSON.parse(fs.readFileSync(genPath, "utf8"));
    const bodyText = stripHtml(c.bodyFrHtml);
    const salaryVisible = Boolean(p.sal_min || p.sal_max);
    const jobLocations = p.multiCity ? ALL_CITIES : null;
    const data = {
      slug: p.slug,
      status: "published",
      category: p.categorie,
      titleFr: cut(c.titleFr, 160),
      titleEn: cut(c.titleFr, 160),
      summaryFr: cut(c.summaryFr, 320),
      summaryEn: cut(c.summaryFr, 320),
      bodyFr: c.bodyFrHtml,
      bodyTextFr: bodyText,
      bodyEn: c.bodyFrHtml,
      bodyTextEn: bodyText,
      employmentType: p.emploi,
      workMode: p.workMode,
      city: p.city,
      region: p.city === "Saint-Marcellin" ? "Isère" : null,
      country: "FR",
      salaryMin: p.sal_min || null,
      salaryMax: p.sal_max || null,
      salaryVisible,
      salaryPeriod: "YEAR",
      salaryCurrency: "EUR",
      metaTitle: cut(c.metaTitle, 70),
      metaDescription: cut(c.metaDescription, 160),
      indexationTier: "tier_1_indexable",
      displayOrder: p.num,
      publishedAt: new Date(),
    };
    if (jobLocations) data.jobLocations = jobLocations;
    const existing = await prisma.jobOffer.findUnique({
      where: { slug: p.slug },
      select: { id: true },
    });
    const upd = Object.assign({}, data);
    delete upd.publishedAt; // ne pas réécraser la date de 1re publication
    let jlNote = jobLocations ? " (41 villes)" : "";
    try {
      await prisma.jobOffer.upsert({
        where: { slug: p.slug },
        create: data,
        update: upd,
      });
    } catch (e) {
      // Client prod pas encore migré (jobLocations) → on insère sans, le re-run après
      // déploiement complétera les 41 villes (idempotent).
      if (String((e && e.message) || e).includes("jobLocations")) {
        delete data.jobLocations;
        delete upd.jobLocations;
        await prisma.jobOffer.upsert({
          where: { slug: p.slug },
          create: data,
          update: upd,
        });
        jlNote = jobLocations
          ? " (SANS villes — re-run apres deploiement)"
          : "";
      } else throw e;
    }
    if (existing) updated++;
    else created++;
    console.log("  ok " + p.slug + jlNote);
  }
  const total = await prisma.jobOffer.count();
  console.log(
    "\n=== SEED TERMINE : " +
      created +
      " creees, " +
      updated +
      " maj" +
      (missing.length ? ", manquantes: " + missing.join(",") : "") +
      ". Total offres en DB: " +
      total +
      " ===",
  );
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error("ERREUR SEED:", e && e.message ? e.message : e);
  process.exit(1);
});
