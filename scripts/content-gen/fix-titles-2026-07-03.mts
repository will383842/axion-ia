/**
 * Ops (audit blog 2026-07-03) — raccourcit les titres > 60 car. (tronqués en SERP)
 * et corrige le Title Case anglais → sentence case FR. Mot-clé en tête préservé.
 * title = affichage/H1 ; metaTitle = balise <title> SERP. Dry-run par défaut ; --apply.
 */
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

// slug → [nouveau title, nouveau metaTitle]
const MAP: Record<string, [string, string]> = {
  "alternatives-formation-ia-nanterre": [
    "Formation IA Nanterre : le comparatif des alternatives",
    "Formation IA Nanterre : comparatif des alternatives",
  ],
  "atelier-ia-grenoble-entreprise": [
    "Atelier IA Grenoble : définition, format et utilité",
    "Atelier IA Grenoble entreprise : définition et format",
  ],
  "formation-ia-aix-en-provence": [
    "Formation IA Aix-en-Provence : définition et méthode",
    "Formation IA Aix-en-Provence : enjeux et méthode",
  ],
  "formation-ia-ajaccio-guide-pas-a-pas": [
    "Formation IA Ajaccio : le guide pas-à-pas pour se former",
    "Formation IA Ajaccio : guide pas-à-pas",
  ],
  "formation-ia-angers": [
    "Formation IA Angers : quelle formule pour votre profil ?",
    "Formation IA Angers : quelle formule choisir ?",
  ],
  "formation-ia-boulogne-billancourt": [
    "Formation IA Boulogne-Billancourt : former vos équipes",
    "Formation IA Boulogne-Billancourt : accompagner vos équipes",
  ],
  "formation-ia-colombes": [
    "Formation IA Colombes : définition, méthode, pratique",
    "Formation IA Colombes : définition et méthode",
  ],
  "formation-ia-la-rochelle": [
    "Formation IA La Rochelle : définition, contenu, utilité",
    "Formation IA La Rochelle : contenu et utilité",
  ],
  "formation-ia-le-mans": [
    "Formation IA Le Mans : définition, méthodes, bénéfices",
    "Formation IA Le Mans : méthodes et bénéfices concrets",
  ],
  "formation-ia-lille-cas-concret-pme-commerce": [
    "Formation IA Lille : une PME du commerce forme ses équipes",
    "Formation IA Lille : cas concret d'une PME du commerce",
  ],
  "formation-ia-merignac-cas-concret-pme": [
    "Formation IA Mérignac : cas concret d'une PME industrielle",
    "Formation IA Mérignac : cas concret PME industrielle",
  ],
  "formation-ia-orleans-cas-client-pme-loiret": [
    "Formation IA Orléans : une PME du Loiret forme ses équipes",
    "Formation IA Orléans : cas client d'une PME du Loiret",
  ],
  "formation-ia-poitiers-axion-ia-vs-openclassrooms-comparatif": [
    "Formation IA Poitiers : Axion-IA vs OpenClassrooms",
    "Formation IA Poitiers : Axion-IA vs OpenClassrooms",
  ],
  "formation-ia-rueil-malmaison": [
    "Formation IA Rueil-Malmaison : du blocage à l'adoption",
    "Formation IA Rueil-Malmaison : du blocage à l'adoption réelle",
  ],
  "formation-ia-saint-denis-comparatif-axion-ia-vs-generalistes": [
    "Formation IA Saint-Denis : Axion-IA vs les généralistes",
    "Formation IA Saint-Denis : Axion-IA vs généralistes",
  ],
  "formation-ia-saint-etienne-guide-pratique": [
    "Formation IA Saint-Étienne : le guide pas-à-pas 2026",
    "Formation IA Saint-Étienne : guide pratique 2026",
  ],
  "formation-ia-vitry-sur-seine": [
    "Formation IA Vitry-sur-Seine : quelle formule pour vous ?",
    "Formation IA Vitry-sur-Seine : quelle formule choisir ?",
  ],
  "formation-intelligence-artificielle-entreprise-grenoble": [
    "Formation IA entreprise Grenoble : la FAQ complète",
    "Formation IA entreprise Grenoble : FAQ complète",
  ],
  "mentor-ia-dirigeant-auvergne-rhone-alpes-grenoble": [
    "Mentor IA dirigeant Auvergne-Rhône-Alpes : la FAQ",
    "Mentor IA dirigeant Auvergne-Rhône-Alpes : FAQ",
  ],
  // Title Case anglais → sentence case FR (+ raccourcis). Routent vers /guides.
  "guide-audit-ia-grenoble": [
    "Guide complet de l'audit IA à Grenoble",
    "Audit IA à Grenoble : le guide complet pour entreprises",
  ],
  "guide-integration-ia-grenoble": [
    "Intégrer l'IA dans les entreprises de Grenoble",
    "Intégrer l'IA à Grenoble : opportunités et défis",
  ],
  "guide-agence-web-ia-auvergne-rhone-alpes": [
    "Agence web en Auvergne-Rhône-Alpes : le levier IA",
    "Optimiser votre agence web en ARA grâce à l'IA",
  ],
  "coach-ia-grenoble-guide-pratique": [
    "Coach IA Grenoble : bien choisir en 7 étapes",
    "Coach IA Grenoble : comment choisir en 7 étapes",
  ],
  // Title Case (article noindexé mais on corrige quand même).
  "automatisation-comptable-ia-pme": [
    "Comprendre l'automatisation comptable par l'IA (PME)",
    "Automatisation comptable par l'IA : guide PME",
  ],
};

const rows = await prisma.articleTranslation.findMany({
  where: { locale: "fr", slug: { in: Object.keys(MAP) } },
  select: { id: true, slug: true, title: true, metaTitle: true },
});

for (const r of rows) {
  const [newTitle, newMeta] = MAP[r.slug]!;
  console.log(
    JSON.stringify({
      slug: r.slug,
      title_avant: r.title,
      len_avant: r.title.length,
      title_apres: newTitle,
      len_apres: newTitle.length,
    }),
  );
  if (APPLY) {
    await prisma.articleTranslation.update({
      where: { id: r.id },
      data: { title: newTitle, metaTitle: newMeta, updatedAt: new Date() },
    });
  }
}
console.log(JSON.stringify({ mode: APPLY ? "APPLIED" : "DRY_RUN", count: rows.length }));
await prisma.$disconnect();
process.exit(0);
