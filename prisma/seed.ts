/**
 * Axion-IA · Prisma seed FR+EN (Sprint 15 / M8)
 *
 * Données de démo :
 * - 1 super-admin (password: AdminAxion2026! → à changer en prod)
 * - 13 catégories (5 modules + 5 blog + 3 aide)
 * - 6 article_tags
 * - 1 author (Will)
 * - 5 articles + translations FR/EN
 * - 6 témoignages bilingues
 * - 3 cas concrets + translations FR/EN
 * - 20 FAQ bilingues
 * - 10 articles aide + translations FR/EN
 * - settings clés (pricing, ROI, CTA central, mode maintenance)
 *
 * Idempotent : utilise `upsert` partout. Run: `pnpm db:seed`.
 */
/* eslint-disable no-console */

import { PrismaClient } from "./generated/client";
import { hashPassword } from "../src/lib/auth-password";
import { seedAuthorProfile } from "./seeds/content-gen/author-profile";

const prisma = new PrismaClient();

// ============================================================
// 1. Admin user
// ============================================================

async function seedAdmin() {
  // Sprint 15 fix Fork 3 N8-3 : utilise SSOT lib/auth-password (Argon2id
  // params OWASP 2024 centralises au lieu de duplicates).
  const passwordHash = await hashPassword("AdminAxion2026!");

  const email = "admin@axion-ia.com";
  await prisma.adminUser.upsert({
    where: { email },
    update: {},
    create: {
      name: "Will (Super Admin)",
      email,
      passwordHash,
      role: "super_admin",
      status: "active",
      twoFactorEnabled: false,
    },
  });
  console.log("✓ Admin user seeded (admin@axion-ia.com / AdminAxion2026!)");
}

// ============================================================
// 2. Settings (pricing, ROI, CTA central, maintenance)
// ============================================================

async function seedSettings() {
  const settings = [
    {
      key: "pricing.intervention.essentielle",
      value: { tier1: 49000, tier2: 79000, tier3: 119000 } as object,
      description: "Tarifs HT en cents pour Essentielle (tier1=1-10p, tier2=11-30p, tier3=31+)",
    },
    {
      key: "pricing.audit.flash",
      value: { remote: 29000, onsite: 49000 } as object,
      description: "Audit flash TPE/Artisan en cents HT",
    },
    {
      key: "cta.central",
      value: {
        textFr: "Réserver une intervention",
        textEn: "Book a session",
        priceCents: 49000,
        href: "/interventions/essentielle",
      } as object,
      description: "CTA central header (sticky toutes pages)",
    },
    {
      key: "roi.simulator",
      value: { hourlyCost: 35, deploymentWeeks: 6, gainPct: 0.18 } as object,
      description: "Paramètres simulateur ROI homepage",
    },
    {
      key: "site.maintenance",
      value: { enabled: false, message: "" } as object,
      description: "Mode maintenance global",
    },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value, description: s.description },
      create: s,
    });
  }
  console.log(`✓ ${settings.length} settings seeded`);
}

// ============================================================
// 3. Categories (modules + blog + aide)
// ============================================================

async function seedCategories() {
  const cats = [
    // Modules
    {
      slug: "interventions",
      nameFr: "Interventions",
      nameEn: "Interventions",
      module: "intervention",
      icon: "users-round",
    },
    {
      slug: "implementation",
      nameFr: "Implémentation IA",
      nameEn: "AI implementation",
      module: "implementation",
      icon: "code",
    },
    {
      slug: "audit",
      nameFr: "Audit & optimisation",
      nameEn: "AI audit",
      module: "audit",
      icon: "search",
    },
    // Blog
    { slug: "blog-strategie", nameFr: "Stratégie", nameEn: "Strategy" },
    { slug: "blog-cas-usage", nameFr: "Cas d'usage", nameEn: "Use cases" },
    { slug: "blog-techno", nameFr: "Technologies", nameEn: "Technology" },
    { slug: "blog-roi", nameFr: "ROI & coûts", nameEn: "ROI & costs" },
    { slug: "blog-rh-orga", nameFr: "RH & organisation", nameEn: "HR & organization" },
    // Aide
    { slug: "aide-demarrage", nameFr: "Démarrage", nameEn: "Getting started" },
    { slug: "aide-reservation", nameFr: "Réservation", nameEn: "Booking" },
    { slug: "aide-facturation", nameFr: "Facturation", nameEn: "Billing" },
  ] as const;

  for (const c of cats) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        slug: c.slug,
        nameFr: c.nameFr,
        nameEn: c.nameEn,
        // @ts-expect-error - optional fields per row
        module: c.module ?? null,
        // @ts-expect-error - optional fields per row
        icon: c.icon ?? null,
        status: "published",
      },
    });
  }
  console.log(`✓ ${cats.length} categories seeded`);
}

// ============================================================
// 4. Author
// ============================================================

async function seedAuthor() {
  await prisma.author.upsert({
    where: { slug: "will" },
    update: {},
    create: {
      slug: "will",
      name: "Will",
      email: "will@axion-ia.com",
      bioFr:
        "Fondateur d'Axion-IA, cabinet IA opérationnel pour entreprises. 10+ ans terrain dans la digitalisation et l'IA appliquée aux PME et ETI européennes.",
      bioEn:
        "Founder of Axion-IA, an operational AI consultancy. 10+ years of hands-on experience digitizing and bringing applied AI to European SMEs and mid-market companies.",
      linkedinUrl: "https://www.linkedin.com/company/axionia",
    },
  });
  console.log("✓ Author 'Will' seeded");
}

// ============================================================
// 5. Article tags
// ============================================================

async function seedTags() {
  const tags = [
    { slug: "quick-wins", nameFr: "Quick-wins", nameEn: "Quick wins" },
    { slug: "automatisation", nameFr: "Automatisation", nameEn: "Automation" },
    { slug: "pme", nameFr: "PME", nameEn: "SME" },
    { slug: "audit", nameFr: "Audit", nameEn: "Audit" },
    { slug: "ia-custom", nameFr: "IA Custom", nameEn: "Custom AI" },
    { slug: "roi", nameFr: "ROI", nameEn: "ROI" },
  ];
  for (const t of tags) {
    await prisma.articleTag.upsert({
      where: { slug: t.slug },
      update: {},
      create: t,
    });
  }
  console.log(`✓ ${tags.length} article tags seeded`);
}

// ============================================================
// 6. Articles (5) + translations FR/EN
// ============================================================

async function seedArticles() {
  const author = await prisma.author.findUnique({ where: { slug: "will" } });
  const catStrat = await prisma.category.findUnique({ where: { slug: "blog-strategie" } });
  const catUse = await prisma.category.findUnique({ where: { slug: "blog-cas-usage" } });
  const catRoi = await prisma.category.findUnique({ where: { slug: "blog-roi" } });
  if (!author || !catStrat || !catUse || !catRoi)
    throw new Error("seedArticles: missing category/author");

  type ArticleSeed = {
    slugFr: string;
    slugEn: string;
    titleFr: string;
    titleEn: string;
    excerptFr: string;
    excerptEn: string;
    bodyFr: string;
    bodyEn: string;
    categoryId: string;
    publishedAt: Date;
    readingTime: number;
    tagSlugs: ReadonlyArray<string>;
  };

  const articles: ReadonlyArray<ArticleSeed> = [
    {
      slugFr: "pourquoi-auditer-avant-implementer",
      slugEn: "why-audit-before-implementing",
      titleFr: "Pourquoi auditer avant d'implémenter",
      titleEn: "Why audit before implementing",
      excerptFr:
        "Un audit réduit le coût total d'implémentation de 30 à 50 % et évite les paris technologiques ratés.",
      excerptEn: "An audit cuts total implementation cost by 30-50% and avoids failed tech bets.",
      bodyFr:
        "Avant tout déploiement IA significatif, un audit cadré 5 à 10 jours permet de cartographier les flux, identifier les ROI immédiats, et qualifier les zones non-IA. Sur 30 missions menées par Axion-IA en 2025-2026, les organisations ayant fait l'audit en amont ont divisé par deux la durée moyenne d'implémentation et abandonné en moyenne 2 idées sur 5 — économie nette estimée 50 000 €+ par projet PME.",
      bodyEn:
        "Before any significant AI deployment, a 5-10 day audit maps your flows, identifies immediate ROI, and qualifies non-AI zones. Across 30 missions led by Axion-IA in 2025-2026, organizations that audited upfront halved their implementation timeline and dropped on average 2 ideas out of 5 — net savings estimated at €50K+ per SME project.",
      categoryId: catStrat.id,
      publishedAt: new Date("2026-04-15T08:00:00Z"),
      readingTime: 7,
      tagSlugs: ["audit", "roi"],
    },
    {
      slugFr: "3-quick-wins-2026",
      slugEn: "3-quick-wins-2026",
      titleFr: "3 quick-wins IA opérationnels en 2026",
      titleEn: "3 operational AI quick-wins in 2026",
      excerptFr:
        "Lecture de factures, comptes-rendus de réunion, qualification de leads — déployables en moins d'un mois.",
      excerptEn:
        "Invoice reading, meeting minutes, lead qualification — deployable in under a month.",
      bodyFr:
        "En 2026, les modèles IA matures permettent trois quick-wins déployables sous 30 jours dans presque toute organisation : 1) Lecture automatisée des factures entrantes (gain 30-50 % temps comptable). 2) Génération de comptes-rendus de réunions (gain 1-2 h/jour/cadre). 3) Qualification IA des leads entrants (gain 30 % conversion). Chacun coûte moins de 5 000 € à déployer pour une PME.",
      bodyEn:
        "In 2026, mature AI models enable three quick-wins deployable within 30 days in almost any organization: 1) Automated reading of incoming invoices (30-50% accounting time savings). 2) Meeting minute generation (1-2h/day/manager savings). 3) AI lead qualification (30% conversion uplift). Each costs less than €5k to deploy for an SME.",
      categoryId: catUse.id,
      publishedAt: new Date("2026-04-22T08:00:00Z"),
      readingTime: 8,
      tagSlugs: ["quick-wins", "automatisation", "pme"],
    },
    {
      slugFr: "ia-custom-quand-vraiment",
      slugEn: "custom-ai-when-really",
      titleFr: "IA custom : quand est-ce vraiment justifié ?",
      titleEn: "Custom AI: when is it really justified?",
      excerptFr:
        "Trois critères discriminants pour décider entre solution prête-à-l'emploi et IA sur mesure.",
      excerptEn: "Three discriminating criteria to choose between off-the-shelf and custom AI.",
      bodyFr:
        "L'IA custom 8 000 - 50 000 € se justifie sur trois critères seulement : 1) volumétrie données propriétaire > 10K documents/jour. 2) règle métier non couverte par les modèles SaaS. 3) confidentialité critique imposant on-premise / Hetzner UE. Hors ces trois cas, un assemblage de SaaS (ChatGPT Enterprise + n8n + Airtable) résout 80 % des besoins pour un dixième du budget.",
      bodyEn:
        "Custom AI in the €8K-50K range is justified by only three criteria: 1) proprietary data volume > 10K docs/day. 2) business rule not covered by SaaS models. 3) critical confidentiality requiring on-premise / EU Hetzner hosting. Outside these three cases, a SaaS stack (ChatGPT Enterprise + n8n + Airtable) solves 80% of needs at one-tenth the budget.",
      categoryId: catStrat.id,
      publishedAt: new Date("2026-04-29T08:00:00Z"),
      readingTime: 9,
      tagSlugs: ["ia-custom", "roi"],
    },
    {
      slugFr: "automatisation-comptable-roi",
      slugEn: "accounting-automation-roi",
      titleFr: "Automatisation comptable : calcul du ROI sur 12 mois",
      titleEn: "Accounting automation: 12-month ROI calculation",
      excerptFr: "Modèle ROI détaillé sur 1500 factures/mois — break-even atteint à 4 mois.",
      excerptEn: "Detailed ROI model on 1500 invoices/month — break-even reached at 4 months.",
      bodyFr:
        "Sur une PME industrielle de 80 personnes traitant 1500 factures/mois, l'investissement automatisation IA (12 000 € one-shot + 290 €/mois maintenance) rapporte 3,2 ETP libérés sur les flux fournisseurs — soit 96 000 €/an d'économie. Break-even atteint à 4 mois, gain net année 1 ≈ 80 000 €. ROI 24 mois ≈ 580 %.",
      bodyEn:
        "For an 80-person industrial SME processing 1500 invoices/month, the AI automation investment (€12k one-time + €290/month maintenance) frees 3.2 FTEs from supplier flows — equivalent to €96K/year savings. Break-even at 4 months, net year-1 gain ≈ €80K. 24-month ROI ≈ 580%.",
      categoryId: catRoi.id,
      publishedAt: new Date("2026-05-01T08:00:00Z"),
      readingTime: 6,
      tagSlugs: ["automatisation", "roi", "pme"],
    },
    {
      slugFr: "intervention-essentielle-jour-type",
      slugEn: "essentielle-typical-day",
      titleFr: "Intervention Essentielle : à quoi ressemble une journée type",
      titleEn: "Essentielle session: what a typical day looks like",
      excerptFr:
        "9h-18h sur site ou en distanciel, 5 phases concrètes, 1 plan d'action signé en sortie.",
      excerptEn: "9am-6pm on-site or remote, 5 concrete phases, 1 signed action plan delivered.",
      bodyFr:
        "Intervention Essentielle 490-1190 €. Format : 1 journée full sur site ou distanciel. Découpage : 1) immersion équipe (1h30) — observation des flux concrets. 2) cartographie pain points (1h30). 3) atelier IA opérationnelle (3h) — 5 quick-wins identifiés et budgétés. 4) plan d'action 90 jours (1h30) signé. 5) restitution dirigeant (1h). Livrable J+2 : rapport 15 pages + recommandations chiffrées.",
      bodyEn:
        "Essentielle session €490-1190. Format: 1 full day on-site or remote. Breakdown: 1) team immersion (1h30) — observing concrete flows. 2) pain point mapping (1h30). 3) operational AI workshop (3h) — 5 quick-wins identified and budgeted. 4) signed 90-day action plan (1h30). 5) executive debrief (1h). Day+2 deliverable: 15-page report + costed recommendations.",
      categoryId: catUse.id,
      publishedAt: new Date("2026-05-05T08:00:00Z"),
      readingTime: 5,
      tagSlugs: ["pme"],
    },
  ];

  for (const a of articles) {
    // Idempotency : check by FR slug on translation (locale+slug is @@unique)
    const existing = await prisma.articleTranslation.findUnique({
      where: { locale_slug: { locale: "fr", slug: a.slugFr } },
    });
    if (existing) continue;

    const tagIds = await prisma.articleTag.findMany({
      where: { slug: { in: [...a.tagSlugs] } },
      select: { id: true },
    });

    await prisma.article.create({
      data: {
        authorId: author.id,
        categoryId: a.categoryId,
        status: "published",
        publishedAt: a.publishedAt,
        readingTime: a.readingTime,
        translations: {
          create: [
            {
              locale: "fr",
              title: a.titleFr,
              slug: a.slugFr,
              excerpt: a.excerptFr,
              body: a.bodyFr,
              metaTitle: a.titleFr.slice(0, 70),
              metaDescription: a.excerptFr.slice(0, 160),
            },
            {
              locale: "en",
              title: a.titleEn,
              slug: a.slugEn,
              excerpt: a.excerptEn,
              body: a.bodyEn,
              metaTitle: a.titleEn.slice(0, 70),
              metaDescription: a.excerptEn.slice(0, 160),
            },
          ],
        },
        tags: {
          create: tagIds.map((t) => ({ tagId: t.id })),
        },
      },
    });
  }
  console.log(`✓ ${articles.length} articles + translations seeded`);
}

// ============================================================
// 7. Testimonials (6 bilingues)
// ============================================================

async function seedTestimonials() {
  const ts = [
    {
      slug: "marie-dupont-industrie",
      firstName: "Marie",
      lastName: "Dupont",
      role: "DAF",
      company: "Indus·PME",
      sector: "Industrie",
      companySize: "10-49",
      shortQuoteFr: "Axion-IA a divisé par 3 notre temps de traitement comptable.",
      shortQuoteEn: "Axion-IA cut our accounting processing time by 3x.",
      fullQuoteFr:
        "Audit en 5 jours, déploiement en 6 semaines. ROI atteint en 4 mois sur le périmètre fournisseurs. Les équipes ont enfin du temps pour les sujets à valeur ajoutée.",
      fullQuoteEn:
        "Audit in 5 days, deployment in 6 weeks. ROI reached in 4 months on the supplier scope. Teams finally have time for value-add topics.",
      rating: 5,
      module: "implementation",
      resultHighlight: "-32% temps admin",
    },
    {
      slug: "jean-martin-distribution",
      firstName: "Jean",
      lastName: "Martin",
      role: "Dirigeant",
      company: "Distribut·SARL",
      sector: "Distribution",
      companySize: "50-249",
      shortQuoteFr: "Le diagnostic a évité 2 paris technologiques que nous regrettions déjà.",
      shortQuoteEn: "The diagnostic avoided 2 tech bets we were already regretting.",
      fullQuoteFr:
        "L'audit nous a fait abandonner deux projets IA mal cadrés et concentrer le budget sur trois quick-wins concrets. Économie estimée : 80 K€ sur l'année.",
      fullQuoteEn:
        "The audit made us drop two poorly scoped AI projects and focus budget on three concrete quick-wins. Estimated savings: €80K over the year.",
      rating: 5,
      module: "audit",
      resultHighlight: "-80 K€ paris évités",
    },
    {
      slug: "sophie-bernard-services",
      firstName: "Sophie",
      lastName: "Bernard",
      role: "DRH",
      company: "Services·SAS",
      sector: "Services B2B",
      companySize: "10-49",
      shortQuoteFr: "L'intervention Essentielle a aligné le CODIR en une journée.",
      shortQuoteEn: "The Essentielle session aligned the executive committee in one day.",
      fullQuoteFr:
        "490 € pour faire converger six dirigeants sur une feuille de route IA — incomparable. Le plan 90 jours a été tenu intégralement, livrables compris.",
      fullQuoteEn:
        "€490 to converge six executives on an AI roadmap — incomparable. The 90-day plan was fully delivered.",
      rating: 5,
      module: "intervention",
      resultHighlight: "1 journée → roadmap CODIR",
    },
    {
      slug: "ahmed-belkacem-tech",
      firstName: "Ahmed",
      lastName: "Belkacem",
      role: "CTO",
      company: "ScaleUp·SAS",
      sector: "Tech B2B",
      companySize: "50-249",
      shortQuoteFr: "IA Custom livrée en 8 semaines, déjà ROI sur le 4e mois.",
      shortQuoteEn: "Custom AI delivered in 8 weeks, ROI on month 4.",
      fullQuoteFr:
        "Modèle propriétaire de scoring lead, déployé sur Hetzner UE pour la conformité. Les commerciaux gagnent 1h/jour de qualification, le pipeline se concentre sur les opportunités gagnables.",
      fullQuoteEn:
        "Proprietary lead scoring model, deployed on EU Hetzner for compliance. Sales reps save 1h/day of qualification, the pipeline focuses on winnable opportunities.",
      rating: 5,
      module: "implementation",
      resultHighlight: "+30 % conv. lead",
    },
    {
      slug: "claire-leroy-cabinet",
      firstName: "Claire",
      lastName: "Leroy",
      role: "Associée",
      company: "Cabinet·SCP",
      sector: "Conseil",
      companySize: "10-49",
      shortQuoteFr: "Le rapport d'audit fait référence en interne, on s'y appuie 6 mois après.",
      shortQuoteEn: "The audit report is our internal reference, we still use it 6 months later.",
      fullQuoteFr:
        "Audit cabinet 990 € HT, livré en 5 jours ouvrés. Cartographie 18 flux, 12 quick-wins identifiés, 6 implémentés. Très en deçà de ce qu'un Big4 aurait facturé.",
      fullQuoteEn:
        "€990 audit, delivered in 5 working days. 18 flows mapped, 12 quick-wins identified, 6 implemented. Far below what a Big4 would have charged.",
      rating: 5,
      module: "audit",
      resultHighlight: "12 quick-wins / 18 flux",
    },
    {
      slug: "nicolas-faure-retail",
      firstName: "Nicolas",
      lastName: "Faure",
      role: "Directeur Général",
      company: "Retail·SARL",
      sector: "Retail",
      companySize: "1-9",
      shortQuoteFr:
        "Conférence demi-journée, 12 collaborateurs convaincus que l'IA n'est pas une menace.",
      shortQuoteEn: "Half-day conference, 12 colleagues convinced that AI is not a threat.",
      fullQuoteFr:
        "Format conférence + atelier sur site. L'effet déclic chez l'équipe a été immédiat. Trois projets IA ont été lancés dans le mois, portés par les opérationnels eux-mêmes.",
      fullQuoteEn:
        "Conference + on-site workshop format. The team's lightbulb moment was immediate. Three AI projects launched within the month, owned by the operational teams themselves.",
      rating: 5,
      module: "intervention",
      resultHighlight: "3 projets dans le mois",
    },
  ] as const;

  for (const t of ts) {
    await prisma.testimonial.upsert({
      where: { slug: t.slug },
      update: {},
      create: {
        slug: t.slug,
        firstName: t.firstName,
        lastName: t.lastName,
        role: t.role,
        company: t.company,
        sector: t.sector,
        companySize: t.companySize,
        shortQuoteFr: t.shortQuoteFr,
        shortQuoteEn: t.shortQuoteEn,
        fullQuoteFr: t.fullQuoteFr,
        fullQuoteEn: t.fullQuoteEn,
        rating: t.rating,
        module: t.module,
        resultHighlight: t.resultHighlight,
        status: "published",
      },
    });
  }
  console.log(`✓ ${ts.length} testimonials seeded`);
}

// ============================================================
// 8. Case studies (3 + translations)
// ============================================================

async function seedCaseStudies() {
  const cases = [
    {
      slugFr: "cabinet-comptable-220h-an",
      slugEn: "accounting-firm-220h-year",
      titleFr: "Cabinet comptable récupère 220 h/an",
      titleEn: "Accounting firm recovers 220h/year",
      sector: "Conseil",
      companySizeRange: "10-49",
      region: "Bretagne",
      modulesUsed: ["audit", "implementation"],
      resultsQuantified: [
        { label: "Heures récupérées", value: 220, unit: "h/an" },
        { label: "ROI", value: 380, unit: "% sur 24 mois" },
      ],
      problemFr:
        "Cabinet 18 collaborateurs, 4 ETP saturés sur saisie comptable répétitive, taux d'erreur 1,8 %.",
      solutionFr:
        "Audit 5 jours → automatisation lecture factures + push Sage. 6 semaines déploiement. Maintenance 290 €/mois.",
      problemEn:
        "18-person accounting firm, 4 FTEs saturated on repetitive bookkeeping, 1.8% error rate.",
      solutionEn:
        "5-day audit → invoice reading automation + Sage push. 6-week deployment. €290/month maintenance.",
      durationWeeks: 6,
      roiWeeks: 16,
      testimonialSlug: "claire-leroy-cabinet",
      publishedAt: new Date("2026-04-10T08:00:00Z"),
    },
    {
      slugFr: "industriel-32pct-temps-admin",
      slugEn: "industrial-32pct-admin-time",
      titleFr: "Industriel · -32 % temps administratif comptable",
      titleEn: "Industrial · -32% accounting admin time",
      sector: "Industrie",
      companySizeRange: "50-249",
      region: "Auvergne-Rhône-Alpes",
      modulesUsed: ["implementation"],
      resultsQuantified: [
        { label: "Temps admin", value: -32, unit: "%" },
        { label: "ETP libérés", value: 3.2, unit: "ETP" },
      ],
      problemFr:
        "PME industrielle 80 personnes, 2 sites. 4 ETP affectés au tri/validation/saisie de 1500 factures/mois.",
      solutionFr:
        "Lecture IA factures (PDF/scan/email) + extraction structurée + push ERP. Workflow validation 2 niveaux > 5 K€.",
      problemEn:
        "80-person industrial SME, 2 sites. 4 FTEs handling sorting/validation/entry of 1500 invoices/month.",
      solutionEn:
        "AI invoice reading (PDF/scan/email) + structured extraction + ERP push. 2-level validation workflow > €5K.",
      durationWeeks: 8,
      roiWeeks: 18,
      testimonialSlug: "marie-dupont-industrie",
      publishedAt: new Date("2026-04-18T08:00:00Z"),
    },
    {
      slugFr: "scaleup-tech-30pct-conv-lead",
      slugEn: "scaleup-tech-30pct-lead-conv",
      titleFr: "Scale-up tech · +30 % conversion leads",
      titleEn: "Tech scale-up · +30% lead conversion",
      sector: "Tech B2B",
      companySizeRange: "50-249",
      region: "Île-de-France",
      modulesUsed: ["audit", "implementation"],
      resultsQuantified: [
        { label: "Conversion leads", value: 30, unit: "%" },
        { label: "Temps qualif.", value: -1, unit: "h/jour/SDR" },
      ],
      problemFr:
        "Scale-up SaaS B2B 110 collaborateurs. Pipeline saturé, SDR perdent 1h/jour à qualifier des leads non-fit.",
      solutionFr:
        "IA Custom scoring lead déployée sur Hetzner UE (conformité RGPD). Modèle propriétaire entraîné sur 18 mois CRM.",
      problemEn:
        "B2B SaaS scale-up, 110 staff. Saturated pipeline, SDRs losing 1h/day qualifying non-fit leads.",
      solutionEn:
        "Custom AI lead scoring deployed on EU Hetzner (GDPR-compliant). Proprietary model trained on 18 months CRM.",
      durationWeeks: 8,
      roiWeeks: 14,
      testimonialSlug: "ahmed-belkacem-tech",
      publishedAt: new Date("2026-04-25T08:00:00Z"),
    },
  ];

  for (const c of cases) {
    const testimonial = await prisma.testimonial.findUnique({
      where: { slug: c.testimonialSlug },
    });

    // Check if already exists by slug fr
    const existing = await prisma.caseStudyTranslation.findUnique({
      where: { locale_slug: { locale: "fr", slug: c.slugFr } },
    });
    if (existing) continue;

    await prisma.caseStudy.create({
      data: {
        sector: c.sector,
        companySizeRange: c.companySizeRange,
        region: c.region,
        modulesUsed: c.modulesUsed,
        resultsQuantified: c.resultsQuantified,
        durationWeeks: c.durationWeeks,
        roiWeeks: c.roiWeeks,
        testimonialId: testimonial?.id ?? null,
        status: "published",
        publishedAt: c.publishedAt,
        translations: {
          create: [
            {
              locale: "fr",
              title: c.titleFr,
              slug: c.slugFr,
              problem: c.problemFr,
              solution: c.solutionFr,
              metaTitle: c.titleFr.slice(0, 70),
              metaDescription: c.problemFr.slice(0, 160),
            },
            {
              locale: "en",
              title: c.titleEn,
              slug: c.slugEn,
              problem: c.problemEn,
              solution: c.solutionEn,
              metaTitle: c.titleEn.slice(0, 70),
              metaDescription: c.problemEn.slice(0, 160),
            },
          ],
        },
      },
    });
  }
  console.log(`✓ ${cases.length} case studies + translations seeded`);
}

// ============================================================
// 9. FAQ (20 bilingues)
// ============================================================

async function seedFAQs() {
  const faqs = [
    {
      slug: "qu-est-ce-qu-axionia",
      category: "general",
      qFr: "Qu'est-ce qu'Axion-IA ?",
      qEn: "What is Axion-IA?",
      aFr: "Axion-IA est un cabinet IA opérationnel pour entreprises, basé en Estonie (UE). Nous intervenons sur trois modules : interventions sur site, audit, et implémentation IA.",
      aEn: "Axion-IA is an operational AI consultancy for companies, based in Estonia (EU). We deliver across three modules: on-site sessions, audits, and AI implementation.",
    },
    {
      slug: "qui-est-derriere-axionia",
      category: "general",
      qFr: "Qui est derrière Axion-IA ?",
      qEn: "Who is behind Axion-IA?",
      aFr: "Will, fondateur, 10+ ans d'expérience terrain en digitalisation et IA appliquée. Axion-IA OÜ est constituée en Estonie, conforme RGPD et droit européen.",
      aEn: "Will, founder, with 10+ years of hands-on experience in digitization and applied AI. Axion-IA OÜ is incorporated in Estonia, GDPR-compliant and aligned with EU law.",
    },
    {
      slug: "ou-intervenez-vous",
      category: "general",
      qFr: "Où intervenez-vous ?",
      qEn: "Where do you operate?",
      aFr: "France, Belgique, Luxembourg, Suisse, et UE. Pages dédiées par ville sur les villes de plus de 5 000 habitants.",
      aEn: "France, Belgium, Luxembourg, Switzerland, and the EU. Dedicated city pages for towns above 5,000 inhabitants.",
    },
    {
      slug: "qu-est-ce-qu-une-intervention",
      category: "interventions",
      qFr: "Qu'est-ce qu'une intervention Axion-IA ?",
      qEn: "What is an Axion-IA session?",
      aFr: "Une intervention est une journée chez vous (ou en distanciel) pour cartographier vos flux, identifier les quick-wins IA et signer un plan d'action 90 jours.",
      aEn: "A session is one day at your premises (or remote) mapping your flows, identifying AI quick-wins, and signing a 90-day action plan.",
    },
    {
      slug: "combien-coute-essentielle",
      category: "pricing",
      qFr: "Combien coûte l'intervention Essentielle ?",
      qEn: "How much does the Essentielle session cost?",
      aFr: "490 € HT pour 1-10 participants, 790 € HT pour 11-30, 1 190 € HT au-delà. TVA estonienne en sus selon résidence du client.",
      aEn: "€490 excl. VAT for 1-10 participants, €790 for 11-30, €1,190 above. Estonian VAT extra depending on client residence.",
    },
    {
      slug: "qu-est-ce-qu-un-audit",
      category: "audit",
      qFr: "Qu'est-ce qu'un audit Axion-IA ?",
      qEn: "What is an Axion-IA audit?",
      aFr: "Un audit est un diagnostic 5-10 jours qui cartographie vos flux, identifie les opportunités IA chiffrées, et livre un rapport actionnable.",
      aEn: "An audit is a 5-10 day diagnostic mapping your flows, identifying quantified AI opportunities, and delivering an actionable report.",
    },
    {
      slug: "combien-coute-audit",
      category: "pricing",
      qFr: "Combien coûte un audit ?",
      qEn: "How much does an audit cost?",
      aFr: "De 290 € HT (TPE distance) à 1 990 € HT (moyenne entreprise sur site). Grandes entreprises sur devis.",
      aEn: "From €290 excl. VAT (small business remote) to €1,990 (mid-sized on-site). Large companies on request.",
    },
    {
      slug: "qu-est-ce-qu-une-implementation",
      category: "implementation",
      qFr: "Qu'est-ce qu'une implémentation IA ?",
      qEn: "What is an AI implementation?",
      aFr: "C'est le déploiement d'une solution IA chez vous : automatisation, agents, IA custom. De 990 € à 50 000 € HT selon ambition.",
      aEn: "It's the deployment of an AI solution at your premises: automation, agents, custom AI. From €990 to €50K depending on scope.",
    },
    {
      slug: "qu-est-ce-que-l-ia-custom",
      category: "implementation",
      qFr: "Qu'est-ce que l'IA custom ?",
      qEn: "What is custom AI?",
      aFr: "Une IA développée sur mesure pour votre entreprise, hébergée sur infrastructure UE (Hetzner), pour les cas où le SaaS ne couvre pas le besoin (8-50 K€).",
      aEn: "Custom-developed AI for your company, hosted on EU infrastructure (Hetzner), for cases where SaaS doesn't fit the need (€8-50K).",
    },
    {
      slug: "delais-implementation",
      category: "implementation",
      qFr: "Quels sont vos délais d'implémentation ?",
      qEn: "What are your implementation timelines?",
      aFr: "1 à 3 semaines pour une automatisation simple, 6 à 10 semaines pour un projet complet, 4 à 12 semaines pour une IA custom.",
      aEn: "1-3 weeks for a simple automation, 6-10 weeks for a complete project, 4-12 weeks for custom AI.",
    },
    {
      slug: "comment-reserver",
      category: "process",
      qFr: "Comment réserver une intervention ?",
      qEn: "How do I book a session?",
      aFr: "Via le calendrier sur /interventions. Trois états visibles : RÉSERVÉ, OPTION (48 h), DISPONIBLE. Vous posez une option qui devient ferme après validation admin.",
      aEn: "Via the calendar on /interventions. Three visible states: BOOKED, OPTION (48h), AVAILABLE. You place an option that becomes firm after admin validation.",
    },
    {
      slug: "qu-est-ce-qu-une-option-48h",
      category: "process",
      qFr: "Qu'est-ce qu'une option 48h ?",
      qEn: "What is a 48-hour option?",
      aFr: "Vous bloquez un créneau pour 48 h sans engagement. Si l'admin valide, l'option devient une réservation ferme. Sinon, le créneau redevient disponible.",
      aEn: "You hold a slot for 48h without commitment. If admin validates, the option becomes a firm booking. Otherwise, the slot returns to available.",
    },
    {
      slug: "comment-payer",
      category: "pricing",
      qFr: "Comment puis-je payer ?",
      qEn: "How can I pay?",
      aFr: "Virement bancaire UE (IBAN estonien fourni). Facture émise par Axion-IA OÜ avec TVA EE selon résidence.",
      aEn: "EU bank transfer (Estonian IBAN provided). Invoice issued by Axion-IA OÜ with Estonian VAT depending on residence.",
    },
    {
      slug: "donnees-rgpd",
      category: "general",
      qFr: "Comment protégez-vous mes données ?",
      qEn: "How do you protect my data?",
      aFr: "Hébergement Hetzner Allemagne (UE), conformité RGPD intégrale, chiffrement au repos et en transit. Politique complète sur /politique-confidentialite.",
      aEn: "Hetzner Germany (EU) hosting, full GDPR compliance, encryption at rest and in transit. Full policy at /politique-confidentialite.",
    },
    {
      slug: "facturation-tva",
      category: "pricing",
      qFr: "Comment est appliquée la TVA ?",
      qEn: "How is VAT applied?",
      aFr: "TVA estonienne 22 % par défaut (sauf B2B intra-UE avec numéro TVA valide → autoliquidation). Hors UE : exonération.",
      aEn: "Default 22% Estonian VAT (except intra-EU B2B with valid VAT number → reverse charge). Outside EU: exempt.",
    },
    {
      slug: "annulation-report",
      category: "process",
      qFr: "Puis-je annuler ou reporter ?",
      qEn: "Can I cancel or postpone?",
      aFr: "Annulation gratuite jusqu'à J-7. Entre J-7 et J-2 : 50 % facturés. Moins de J-2 : 100 % sauf cas force majeure documenté.",
      aEn: "Free cancellation up to D-7. Between D-7 and D-2: 50% charged. Less than D-2: 100% unless documented force majeure.",
    },
    {
      slug: "ia-formation-difference",
      category: "interventions",
      qFr: "Quelle différence entre intervention et formation ?",
      qEn: "What's the difference between a session and training?",
      aFr: "Une intervention est concrète, opérationnelle, livre des résultats immédiats. Axion-IA ne fait pas de formation académique mais un coaching terrain en entreprise.",
      aEn: "A session is concrete, operational, and delivers immediate results. Axion-IA does not run academic training but on-site corporate coaching.",
    },
    {
      slug: "qui-utilise-axionia",
      category: "general",
      qFr: "Qui sont vos clients types ?",
      qEn: "Who are your typical clients?",
      aFr: "PME et ETI 10-249 personnes, secteurs variés (industrie, services, conseil, distribution, tech). Dirigeants et directions opérationnelles principalement.",
      aEn: "SMEs and mid-market 10-249 staff, varied sectors (industry, services, consulting, distribution, tech). Mostly executives and operational directors.",
    },
    {
      slug: "support-apres-vente",
      category: "process",
      qFr: "Quel support après l'implémentation ?",
      qEn: "What support after implementation?",
      aFr: "Maintenance optionnelle 290 €/mois HT (correctifs + monitoring + 2 h/mois d'évolution). Sans engagement, résiliable mensuellement.",
      aEn: "Optional maintenance €290/month excl. VAT (fixes + monitoring + 2h/month of evolution). No commitment, monthly cancellation.",
    },
    {
      slug: "garantie-resultat",
      category: "general",
      qFr: "Avez-vous une garantie de résultat ?",
      qEn: "Do you offer a results guarantee?",
      aFr: "Sur l'audit : si le rapport ne contient pas au moins 5 quick-wins chiffrés, il est refait gratuitement. Sur l'implémentation : engagement délai et budget contractuels.",
      aEn: "Audit: if the report doesn't contain at least 5 quantified quick-wins, it's redone for free. Implementation: contractual deadline and budget commitments.",
    },
  ] as const;

  for (const [i, f] of faqs.entries()) {
    await prisma.fAQ.upsert({
      where: { slug: f.slug },
      update: {},
      create: {
        slug: f.slug,
        category: f.category,
        questionFr: f.qFr,
        questionEn: f.qEn,
        answerFr: f.aFr,
        answerEn: f.aEn,
        displayOrder: i,
        status: "published",
      },
    });
  }
  console.log(`✓ ${faqs.length} FAQs seeded`);
}

// ============================================================
// 10. Help articles (10 bilingues)
// ============================================================

async function seedHelpArticles() {
  const catDemarrage = await prisma.category.findUnique({ where: { slug: "aide-demarrage" } });
  const catReservation = await prisma.category.findUnique({ where: { slug: "aide-reservation" } });
  const catFacturation = await prisma.category.findUnique({ where: { slug: "aide-facturation" } });
  if (!catDemarrage || !catReservation || !catFacturation)
    throw new Error("seedHelpArticles: categories missing");

  const helps = [
    {
      categoryId: catDemarrage.id,
      isTutorial: true,
      slugFr: "premiere-intervention-comment-preparer",
      slugEn: "first-session-how-to-prepare",
      titleFr: "Première intervention : comment se préparer",
      titleEn: "First session: how to prepare",
      bodyFr:
        "Avant l'intervention, identifiez 3 zones de friction concrètes (ex. comptable, commercial, support) et préparez les chiffres correspondants : volume hebdo, ETP affectés, taux d'erreur estimé. La journée n'a besoin que de ça pour démarrer.",
      bodyEn:
        "Before the session, identify 3 concrete friction areas (e.g. accounting, sales, support) and prepare the matching numbers: weekly volume, allocated FTEs, estimated error rate. That's all the day needs to kick off.",
    },
    {
      categoryId: catDemarrage.id,
      isTutorial: false,
      slugFr: "checklist-avant-audit",
      slugEn: "pre-audit-checklist",
      titleFr: "Checklist avant un audit",
      titleEn: "Pre-audit checklist",
      bodyFr:
        "Identifier 3 secteurs prioritaires, exporter les volumes 12 mois, préparer accès aux outils SaaS clés, désigner un référent interne disponible 1h/jour pendant la mission.",
      bodyEn:
        "Identify 3 priority areas, export 12-month volumes, prepare access to key SaaS tools, designate an internal lead available 1h/day during the mission.",
    },
    {
      categoryId: catReservation.id,
      isTutorial: true,
      slugFr: "comment-poser-une-option-48h",
      slugEn: "how-to-place-a-48h-option",
      titleFr: "Comment poser une option 48h",
      titleEn: "How to place a 48-hour option",
      bodyFr:
        "Sur /interventions, cliquez sur un créneau DISPONIBLE. Remplissez le formulaire (société, secteur, contact). Vous recevez immédiatement une confirmation. L'admin valide ou refuse sous 48 h, sinon le créneau redevient libre.",
      bodyEn:
        "On /interventions, click an AVAILABLE slot. Fill the form (company, sector, contact). You get an immediate confirmation. Admin validates or refuses within 48h, otherwise the slot returns to available.",
    },
    {
      categoryId: catReservation.id,
      isTutorial: false,
      slugFr: "modifier-ma-reservation",
      slugEn: "modify-my-booking",
      titleFr: "Modifier ma réservation",
      titleEn: "Modify my booking",
      bodyFr:
        "Pour modifier une réservation confirmée, écrivez à contact@axion-ia.com avec votre numéro de réservation. Délai de réponse < 24 h ouvrées.",
      bodyEn:
        "To modify a confirmed booking, email contact@axion-ia.com with your booking number. Response time < 24 working hours.",
    },
    {
      categoryId: catReservation.id,
      isTutorial: false,
      slugFr: "annuler-ma-reservation",
      slugEn: "cancel-my-booking",
      titleFr: "Annuler ma réservation",
      titleEn: "Cancel my booking",
      bodyFr:
        "Annulation gratuite jusqu'à J-7. Entre J-7 et J-2, 50 % facturés. Moins de J-2, 100 % facturés. Cas de force majeure documentés acceptés sans frais.",
      bodyEn:
        "Free cancellation up to D-7. Between D-7 and D-2, 50% charged. Less than D-2, 100% charged. Documented force majeure cases accepted free of charge.",
    },
    {
      categoryId: catFacturation.id,
      isTutorial: false,
      slugFr: "comprendre-ma-facture-axionia",
      slugEn: "understanding-my-axionia-invoice",
      titleFr: "Comprendre ma facture Axion-IA",
      titleEn: "Understanding my Axion-IA invoice",
      bodyFr:
        "Facture émise par Axion-IA OÜ (Estonie) en EUR, TVA EE 22 % par défaut. Pour clients B2B intra-UE avec numéro TVA, autoliquidation appliquée (TVA 0 %). Mention 'reverse charge' obligatoire.",
      bodyEn:
        "Invoice issued by Axion-IA OÜ (Estonia) in EUR, default 22% Estonian VAT. For intra-EU B2B clients with VAT number, reverse charge applies (0% VAT). 'Reverse charge' mention is mandatory.",
    },
    {
      categoryId: catFacturation.id,
      isTutorial: true,
      slugFr: "comment-payer-en-virement",
      slugEn: "how-to-pay-by-transfer",
      titleFr: "Comment payer par virement",
      titleEn: "How to pay by transfer",
      bodyFr:
        "Coordonnées bancaires fournies sur la facture (IBAN estonien LHV ou Wise Business). Délai règlement standard : 14 jours. Référence : numéro de facture obligatoire.",
      bodyEn:
        "Bank details provided on invoice (Estonian LHV or Wise Business IBAN). Standard payment term: 14 days. Reference: invoice number required.",
    },
    {
      categoryId: catFacturation.id,
      isTutorial: false,
      slugFr: "factures-acompte-et-solde",
      slugEn: "deposit-and-balance-invoices",
      titleFr: "Factures d'acompte et solde",
      titleEn: "Deposit and balance invoices",
      bodyFr:
        "Pour implémentations > 5 000 €, 30 % d'acompte à la signature, 40 % à la livraison V1, 30 % à la recette finale. Audit et interventions : facturation à 100 % à la livraison.",
      bodyEn:
        "For implementations > €5K, 30% deposit on signature, 40% on V1 delivery, 30% on final acceptance. Audits and sessions: 100% billing on delivery.",
    },
    {
      categoryId: catDemarrage.id,
      isTutorial: false,
      slugFr: "differences-3-modules-axionia",
      slugEn: "axionia-3-modules-differences",
      titleFr: "Différences entre les 3 modules Axion-IA",
      titleEn: "Differences between Axion-IA's 3 modules",
      bodyFr:
        "Module 1 (Interventions) = exploration et alignement, 1 jour. Module 2 (Audit) = diagnostic 5-10 jours avec rapport. Module 3 (Implémentation) = déploiement IA concret 1 sem. à 12 sem.",
      bodyEn:
        "Module 1 (Sessions) = exploration and alignment, 1 day. Module 2 (Audit) = 5-10 day diagnostic with report. Module 3 (Implementation) = concrete AI deployment 1 week to 12 weeks.",
    },
    {
      categoryId: catDemarrage.id,
      isTutorial: false,
      slugFr: "qui-est-mon-interlocuteur",
      slugEn: "who-is-my-contact",
      titleFr: "Qui est mon interlocuteur ?",
      titleEn: "Who is my contact?",
      bodyFr:
        "Will, fondateur, est votre interlocuteur direct sur toutes les interventions et audits. Sur les implémentations longues, un chef de projet Axion-IA dédié vous est assigné, Will reste sponsor.",
      bodyEn:
        "Will, founder, is your direct contact on all sessions and audits. On long implementations, a dedicated Axion-IA project manager is assigned, with Will as sponsor.",
    },
  ];

  for (const h of helps) {
    // Idempotency via translation slug
    const existing = await prisma.helpArticleTranslation.findUnique({
      where: { locale_slug: { locale: "fr", slug: h.slugFr } },
    });
    if (existing) continue;

    await prisma.helpArticle.create({
      data: {
        categoryId: h.categoryId,
        isTutorial: h.isTutorial,
        status: "published",
        publishedAt: new Date(),
        translations: {
          create: [
            {
              locale: "fr",
              title: h.titleFr,
              slug: h.slugFr,
              excerpt: h.bodyFr.slice(0, 160),
              body: h.bodyFr,
              metaTitle: h.titleFr.slice(0, 70),
              metaDescription: h.bodyFr.slice(0, 160),
            },
            {
              locale: "en",
              title: h.titleEn,
              slug: h.slugEn,
              excerpt: h.bodyEn.slice(0, 160),
              body: h.bodyEn,
              metaTitle: h.titleEn.slice(0, 70),
              metaDescription: h.bodyEn.slice(0, 160),
            },
          ],
        },
      },
    });
  }
  console.log(`✓ ${helps.length} help articles + translations seeded`);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("→ Axion-IA · seed FR+EN starting…");
  await seedAdmin();
  await seedSettings();
  await seedCategories();
  await seedAuthor();
  await seedTags();
  await seedArticles();
  await seedTestimonials();
  await seedCaseStudies();
  await seedFAQs();
  await seedHelpArticles();
  // AuthorProfile Manon — débloque /fr/equipe/manon (404 sinon, AI Act art. 50).
  // Audit AEO/GEO 2026-05-15 §3.4 P0-3.
  const manon = await seedAuthorProfile(prisma);
  console.log(`✓ AuthorProfile seeded (slug=${manon.slug}, aiGenerated=${manon.aiGenerated})`);
  console.log("✓ Seed complete.");
}

main()
  .catch((e) => {
    console.error("✗ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
