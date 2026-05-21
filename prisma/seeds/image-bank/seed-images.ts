/**
 * Seeder image bank — 133 ImageAssets + translations FR
 * Usage (depuis /app dans le container) :
 *   npx tsx prisma/seeds/image-bank/seed-images.ts
 * Idempotent (upsert par slug).
 */
import { PrismaClient } from "../../generated/client";

const prisma = new PrismaClient();

type ImageType =
  | "banniere"
  | "carre"
  | "affiche"
  | "infographie"
  | "editorial"
  | "photo"
  | "dataviz"
  | "logo";

const DIMENSIONS: Record<
  ImageType,
  { width: number; height: number; orientation: string; aspectRatio: string }
> = {
  banniere: { width: 1920, height: 1080, orientation: "landscape", aspectRatio: "16:9" },
  carre: { width: 1200, height: 1200, orientation: "square", aspectRatio: "1:1" },
  affiche: { width: 1080, height: 1920, orientation: "portrait", aspectRatio: "9:16" },
  infographie: { width: 1200, height: 1600, orientation: "portrait", aspectRatio: "3:4" },
  editorial: { width: 1200, height: 800, orientation: "landscape", aspectRatio: "3:2" },
  photo: { width: 1920, height: 1080, orientation: "landscape", aspectRatio: "16:9" },
  dataviz: { width: 1200, height: 900, orientation: "landscape", aspectRatio: "4:3" },
  logo: { width: 500, height: 200, orientation: "landscape", aspectRatio: "5:2" },
};

function detectType(slug: string): ImageType {
  if (slug.endsWith("-banniere") || slug.includes("-banniere-")) return "banniere";
  if (slug.endsWith("-carre") || slug.includes("-carre-")) return "carre";
  if (slug.endsWith("-affiche") || slug.includes("-affiche-")) return "affiche";
  if (slug.endsWith("-infographie")) return "infographie";
  if (slug.endsWith("-editorial")) return "editorial";
  if (slug.endsWith("-dataviz")) return "dataviz";
  if (slug.includes("-logo-") || slug.includes("-icone-")) return "logo";
  if (slug.endsWith("-photo-carre")) return "carre";
  if (slug.endsWith("-photo-banniere") || slug.includes("-photo")) return "photo";
  return "banniere";
}

function slugToTitle(slug: string): string {
  return slug
    .replace(/^axion-ia-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bIa\b/g, "IA")
    .replace(/\bTpe\b/g, "TPE")
    .replace(/\bPme\b/g, "PME")
    .replace(/\bEti\b/g, "ETI")
    .replace(/\bRoi\b/g, "ROI")
    .replace(/\bKpi\b/g, "KPI");
}

const MODULE_LABELS: Record<string, string> = {
  audit: "Audit IA",
  interventions: "Formation IA",
  implementations: "Automatisation IA",
  "un-a-un": "Accompagnement 1-to-1",
  graphique: "Graphique / Dataviz",
  logo: "Logo Axion-IA",
  proposition: "Proposition de valeur",
  ville: "Présence locale",
};

interface ImageEntry {
  slug: string;
  module: string;
  subModule?: string;
  targetCity?: string;
  geoPosition?: string;
  geoPlacename?: string;
  isAiGenerated?: boolean;
  sourceType?: string;
  keywordsPrimary?: string;
  targetFormat?: string;
}

const IMAGE_ENTRIES: ImageEntry[] = [
  // ── AUDIT (17) ────────────────────────────────────────────────────────────
  {
    slug: "axion-ia-audit-ia-entreprise-prete-intelligence-artificielle-banniere",
    module: "audits",
    keywordsPrimary: "audit IA entreprise",
  },
  {
    slug: "axion-ia-audit-ia-avantage-competitif-decisions-resultats-banniere",
    module: "audits",
    keywordsPrimary: "audit IA avantage compétitif",
  },
  {
    slug: "axion-ia-audit-ia-transformer-defis-opportunites-leviers-valeur-banniere",
    module: "audits",
    keywordsPrimary: "audit IA transformation",
  },
  {
    slug: "axion-ia-publicite-outdoor-ia-rapporte-concretement-productivite-affiche",
    module: "audits",
    targetFormat: "affiche",
    keywordsPrimary: "publicité outdoor IA productivité",
  },
  {
    slug: "axion-ia-audit-ia-levier-croissance-mesurable-cartographie-roi-banniere",
    module: "audits",
    keywordsPrimary: "audit IA ROI croissance",
  },
  {
    slug: "axion-ia-audit-ia-solutions-artisans-commercants-tpe-pme-eti-banniere",
    module: "audits",
    keywordsPrimary: "audit IA TPE PME ETI",
  },
  {
    slug: "axion-ia-audit-processus-automatiser-temps-couts-productivite-infographie",
    module: "audits",
    keywordsPrimary: "audit processus automatisation",
  },
  {
    slug: "axion-ia-audit-entreprise-metro-gagner-temps-reduire-couts-affiche",
    module: "audits",
    targetFormat: "affiche",
    keywordsPrimary: "audit IA gagner temps coûts",
  },
  {
    slug: "axion-ia-audit-ia-methode-5-etapes-analyse-roi-recommandations-infographie",
    module: "audits",
    keywordsPrimary: "méthode audit IA 5 étapes",
  },
  {
    slug: "axion-ia-citation-avenir-prepare-aujourd-hui-comprendre-agir-editorial",
    module: "audits",
    keywordsPrimary: "citation IA avenir préparation",
  },
  {
    slug: "axion-ia-citation-clarte-serenite-resultats-toujours-editorial",
    module: "audits",
    keywordsPrimary: "citation IA clarté sérénité",
  },
  {
    slug: "axion-ia-audit-ia-choix-rentable-benefices-immediats-roi-garanti-carre",
    module: "audits",
    keywordsPrimary: "audit IA rentable ROI garanti",
  },
  {
    slug: "axion-ia-audit-ia-vous-gagnez-temps-argent-zero-perte-100-gain-carre",
    module: "audits",
    keywordsPrimary: "audit IA gain temps argent",
  },
  {
    slug: "axion-ia-audit-ia-plus-valeur-moins-perte-performances-decuplees-carre",
    module: "audits",
    keywordsPrimary: "audit IA valeur performance",
  },
  {
    slug: "axion-ia-audit-ia-chaos-ordre-performance-gain-temps-couts-carre",
    module: "audits",
    keywordsPrimary: "audit IA chaos ordre performance",
  },
  {
    slug: "axion-ia-audit-ia-une-journee-mois-gagnes-switch-on-carre",
    module: "audits",
    keywordsPrimary: "audit IA une journée mois gagné",
  },
  {
    slug: "axion-ia-audit-ia-votre-avance-concurrents-benchmark-carre",
    module: "audits",
    keywordsPrimary: "audit IA avance concurrents benchmark",
  },
  // ── FORMATION (15) ────────────────────────────────────────────────────────
  {
    slug: "axion-ia-formation-ia-1-jour-sur-mesure-generique-reserver-carre",
    module: "interventions",
    keywordsPrimary: "formation IA 1 jour sur mesure",
  },
  {
    slug: "axion-ia-intervention-ia-rapide-resultats-concrets-entreprise-carre",
    module: "interventions",
    keywordsPrimary: "intervention IA résultats concrets",
  },
  {
    slug: "axion-ia-formation-ia-comprendre-creer-transformer-humaine-augmentee-banniere",
    module: "interventions",
    keywordsPrimary: "formation IA comprendre créer transformer",
  },
  {
    slug: "axion-ia-intervention-ia-france-toutes-regions-photo-banniere",
    module: "interventions",
    keywordsPrimary: "intervention IA France toutes régions",
  },
  {
    slug: "axion-ia-formation-acculturation-ia-tpe-pme-eti-2026-photo-banniere",
    module: "interventions",
    keywordsPrimary: "formation acculturation IA TPE PME ETI 2026",
  },
  {
    slug: "axion-ia-citation-intelligence-artificielle-valeur-impact-editorial",
    module: "interventions",
    keywordsPrimary: "citation IA valeur impact",
  },
  {
    slug: "axion-ia-citation-ia-ne-remplace-pas-humain-revele-potentiel-editorial",
    module: "interventions",
    keywordsPrimary: "citation IA humain potentiel",
  },
  {
    slug: "axion-ia-formation-ia-vous-gagnez-concretement-5-benefices-banniere",
    module: "interventions",
    keywordsPrimary: "formation IA 5 bénéfices concrets",
  },
  {
    slug: "axion-ia-citation-investir-connaissance-liberte-demain-editorial",
    module: "interventions",
    keywordsPrimary: "citation investir connaissance liberté",
  },
  {
    slug: "axion-ia-formation-ia-benefices-premier-jour-formateur-photo-carre",
    module: "interventions",
    keywordsPrimary: "formation IA bénéfices premier jour",
  },
  {
    slug: "axion-ia-formation-ia-avant-apres-une-journee-resultats-photo-carre",
    module: "interventions",
    keywordsPrimary: "formation IA avant après résultats",
  },
  {
    slug: "axion-ia-formation-ia-moins-stress-clarte-une-journee-photo-banniere",
    module: "interventions",
    keywordsPrimary: "formation IA stress clarté",
  },
  {
    slug: "axion-ia-formation-equipe-ia-40-pourcent-productivite-100-mesure-carre",
    module: "interventions",
    keywordsPrimary: "formation équipe IA productivité 40%",
  },
  {
    slug: "axion-ia-formation-1-jour-progresser-sur-mesure-generique-carre",
    module: "interventions",
    keywordsPrimary: "formation IA 1 jour progresser",
  },
  {
    slug: "axion-ia-formation-ia-1-jour-reserver-session-carre",
    module: "interventions",
    keywordsPrimary: "formation IA 1 jour réserver",
  },
  // ── AUTOMATISATION (4) ────────────────────────────────────────────────────
  {
    slug: "axion-ia-automatisation-ia-benefices-concrets-mesurables-durables-banniere",
    module: "implementations",
    keywordsPrimary: "automatisation IA bénéfices mesurables",
  },
  {
    slug: "axion-ia-automatisation-ia-avant-apres-tableau-bord-45-pourcent-photo-carre",
    module: "implementations",
    keywordsPrimary: "automatisation IA avant après tableau de bord",
  },
  {
    slug: "axion-ia-automatisation-ia-performance-86-pourcent-gain-temps-couts-carre",
    module: "implementations",
    keywordsPrimary: "automatisation IA performance gain temps coûts",
  },
  {
    slug: "axion-ia-automatisation-ia-triangle-temps-couts-resultats-100-gagnant-carre",
    module: "implementations",
    keywordsPrimary: "automatisation IA triangle performance",
  },
  // ── DIRIGEANT (6) ─────────────────────────────────────────────────────────
  {
    slug: "axion-ia-dirigeant-1to1-ouvrir-ralentit-entreprise-12h-semaine-photo-banniere",
    module: "un-a-un",
    subModule: "dirigeant",
    keywordsPrimary: "accompagnement dirigeant 1to1 IA",
  },
  {
    slug: "axion-ia-dirigeant-1to1-reprendre-controle-journee-avant-apres-photo-banniere",
    module: "un-a-un",
    subModule: "dirigeant",
    keywordsPrimary: "dirigeant reprendre contrôle IA",
  },
  {
    slug: "axion-ia-dirigeant-1to1-temps-plus-grand-atout-liberer-sablier-photo-banniere",
    module: "un-a-un",
    subModule: "dirigeant",
    keywordsPrimary: "dirigeant temps atout libérer IA",
  },
  {
    slug: "axion-ia-dirigeant-1to1-moins-stress-clarte-performance-photo-banniere",
    module: "un-a-un",
    subModule: "dirigeant",
    keywordsPrimary: "dirigeant stress clarté performance IA",
  },
  {
    slug: "axion-ia-dirigeant-1to1-moins-subir-plus-piloter-impact-durable-photo-banniere",
    module: "un-a-un",
    subModule: "dirigeant",
    keywordsPrimary: "dirigeant piloter impact durable IA",
  },
  {
    slug: "axion-ia-dirigeant-1to1-15h-liberees-35-efficacite-25-productivite-infographie",
    module: "un-a-un",
    subModule: "dirigeant",
    keywordsPrimary: "dirigeant 15h libérées efficacité productivité",
  },
  // ── ÉQUIPE (2) ────────────────────────────────────────────────────────────
  {
    slug: "axion-ia-equipe-1to1-tous-profils-manager-rh-marketing-ops-photo-banniere",
    module: "un-a-un",
    subModule: "equipe",
    keywordsPrimary: "accompagnement équipe 1to1 IA",
  },
  {
    slug: "axion-ia-equipe-1to1-une-personne-grandir-competence-performance-photo-carre",
    module: "un-a-un",
    subModule: "equipe",
    keywordsPrimary: "équipe 1to1 compétence performance IA",
  },
  // ── GRAPHIQUES (5) ────────────────────────────────────────────────────────
  {
    slug: "axion-ia-graphique-processus-5-etapes-timeline-infographie",
    module: "graphique",
    keywordsPrimary: "processus IA 5 étapes timeline",
  },
  {
    slug: "axion-ia-graphique-performance-ia-kpi-20-60-pourcent-dataviz",
    module: "graphique",
    keywordsPrimary: "performance IA KPI 20-60%",
  },
  {
    slug: "axion-ia-graphique-adoption-ia-72-pourcent-2024-mckinsey-dataviz",
    module: "graphique",
    keywordsPrimary: "adoption IA 72% McKinsey 2024",
  },
  {
    slug: "axion-ia-graphique-ia-imperatif-performance-fosse-concurrentiel-dataviz",
    module: "graphique",
    keywordsPrimary: "IA impératif fossé concurrentiel",
  },
  {
    slug: "axion-ia-graphique-ia-maintenant-attendre-explorer-integrer-dominer-infographie",
    module: "graphique",
    keywordsPrimary: "IA maintenant explorer intégrer dominer",
  },
  // ── LOGOS (7) ─────────────────────────────────────────────────────────────
  {
    slug: "axion-ia-logo-horizontal-fond-blanc-bordure-orange",
    module: "logo",
    isAiGenerated: false,
    sourceType: "original",
    keywordsPrimary: "logo Axion-IA horizontal fond blanc",
  },
  {
    slug: "axion-ia-logo-horizontal-transparent",
    module: "logo",
    isAiGenerated: false,
    sourceType: "original",
    keywordsPrimary: "logo Axion-IA horizontal transparent",
  },
  {
    slug: "axion-ia-logo-horizontal-fond-blanc",
    module: "logo",
    isAiGenerated: false,
    sourceType: "original",
    keywordsPrimary: "logo Axion-IA horizontal",
  },
  {
    slug: "axion-ia-logo-horizontal-fond-blanc-500px",
    module: "logo",
    isAiGenerated: false,
    sourceType: "original",
    keywordsPrimary: "logo Axion-IA 500px",
  },
  {
    slug: "axion-ia-icone-app-fond-creme",
    module: "logo",
    isAiGenerated: false,
    sourceType: "original",
    keywordsPrimary: "icône application Axion-IA fond crème",
  },
  {
    slug: "axion-ia-icone-app-fond-creme-500px",
    module: "logo",
    isAiGenerated: false,
    sourceType: "original",
    keywordsPrimary: "icône application Axion-IA 500px",
  },
  {
    slug: "axion-ia-icone-app-transparent",
    module: "logo",
    isAiGenerated: false,
    sourceType: "original",
    keywordsPrimary: "icône application Axion-IA transparent",
  },
  // ── PROPOSITIONS (11) ─────────────────────────────────────────────────────
  {
    slug: "axion-ia-proposition-outdoor-formations-audit-implementations-affiche",
    module: "proposition",
    targetFormat: "affiche",
    keywordsPrimary: "Axion-IA services formations audit implémentations",
  },
  {
    slug: "axion-ia-proposition-showroom-mur-services-formations-audit-photo",
    module: "proposition",
    keywordsPrimary: "Axion-IA showroom services",
  },
  {
    slug: "axion-ia-proposition-ia-pour-tous-artisans-tpe-pme-banniere",
    module: "proposition",
    keywordsPrimary: "IA pour tous artisans TPE PME",
  },
  {
    slug: "axion-ia-proposition-globe-4-services-formations-audit-implementations-carre",
    module: "proposition",
    keywordsPrimary: "Axion-IA 4 services globe",
  },
  {
    slug: "axion-ia-proposition-booster-productivite-equipes-automatiser-affiche",
    module: "proposition",
    targetFormat: "affiche",
    keywordsPrimary: "booster productivité équipes automatiser IA",
  },
  {
    slug: "axion-ia-proposition-solutions-ia-chaque-realite-5-secteurs-banniere",
    module: "proposition",
    keywordsPrimary: "solutions IA 5 secteurs",
  },
  {
    slug: "axion-ia-proposition-temps-precieux-taches-processus-intelligents-carre",
    module: "proposition",
    keywordsPrimary: "temps précieux processus intelligents IA",
  },
  {
    slug: "axion-ia-proposition-moins-taches-plus-valeur-carre",
    module: "proposition",
    keywordsPrimary: "moins tâches plus valeur IA",
  },
  {
    slug: "axion-ia-proposition-ia-simplifie-interventions-photo-banniere",
    module: "proposition",
    keywordsPrimary: "IA simplifie interventions",
  },
  {
    slug: "axion-ia-proposition-temps-vers-argent-croissance-photo-banniere",
    module: "proposition",
    keywordsPrimary: "temps vers argent croissance IA",
  },
  {
    slug: "axion-ia-equipe-ia-service-humain-12-personnes-photo-groupe",
    module: "proposition",
    keywordsPrimary: "équipe Axion-IA 12 personnes service humain",
  },
  // ── VILLES (5) ────────────────────────────────────────────────────────────
  {
    slug: "axion-ia-paris-consultante-tour-eiffel-performance-28-pourcent-banniere",
    module: "ville",
    targetCity: "Paris",
    geoPosition: "48.8566;2.3522",
    geoPlacename: "Paris, Île-de-France, France",
    keywordsPrimary: "consultant IA Paris Tour Eiffel",
  },
  {
    slug: "axion-ia-paris-ia-reussite-entreprise-sacre-coeur-banniere",
    module: "ville",
    targetCity: "Paris",
    geoPosition: "48.8566;2.3522",
    geoPlacename: "Paris, Île-de-France, France",
    keywordsPrimary: "IA réussite entreprise Paris Sacré-Cœur",
  },
  {
    slug: "axion-ia-paris-tour-eiffel-services-ia-carte-france-carre",
    module: "ville",
    targetCity: "Paris",
    geoPosition: "48.8566;2.3522",
    geoPlacename: "Paris, Île-de-France, France",
    keywordsPrimary: "services IA Paris Tour Eiffel France",
  },
  {
    slug: "axion-ia-paris-formation-ia-haussmann-se-former-comprendre-agir-banniere",
    module: "ville",
    targetCity: "Paris",
    geoPosition: "48.8566;2.3522",
    geoPlacename: "Paris, Île-de-France, France",
    keywordsPrimary: "formation IA Paris Haussmann",
  },
  {
    slug: "axion-ia-lyon-formation-ia-presquile-fourviere-se-former-banniere",
    module: "ville",
    targetCity: "Lyon",
    geoPosition: "45.764;4.8357",
    geoPlacename: "Lyon, Auvergne-Rhône-Alpes, France",
    keywordsPrimary: "formation IA Lyon Presqu'île Fourvière",
  },

  // ── IMPLÉMENTATIONS — Devis & Commercial (4) ─────────────────────────────
  {
    slug: "axion-ia-devis-automatise-30-secondes-envoi-gain-temps-banniere",
    module: "implementations",
    subModule: "devis-auto",
    keywordsPrimary: "devis automatisé 30 secondes envoi IA PME",
  },
  {
    slug: "axion-ia-devis-envoye-28-secondes-avant-raccrochage-client-affiche",
    module: "implementations",
    subModule: "devis-auto",
    keywordsPrimary: "devis envoyé 28 secondes avant raccrochage client IA",
  },
  {
    slug: "axion-ia-transformation-chaos-devis-rentabilite-croissance-banniere",
    module: "implementations",
    subModule: "devis-auto",
    keywordsPrimary: "transformation chaos devis rentabilité croissance IA",
  },
  {
    slug: "axion-ia-5-heures-saisie-supprimees-gain-temps-entreprise-ia-banniere",
    module: "implementations",
    subModule: "saisie-auto",
    keywordsPrimary: "5 heures saisie supprimées gain temps entreprise IA",
  },

  // ── IMPLÉMENTATIONS — Facturation & Comptabilité (4) ─────────────────────
  {
    slug: "axion-ia-facturation-automatique-flux-ia-tva-zero-saisie-infographie",
    module: "implementations",
    subModule: "facturation-auto",
    keywordsPrimary: "facturation automatique IA TVA zéro saisie manuelle",
  },
  {
    slug: "axion-ia-flux-facturation-ia-zero-saisie-manuelle-infographie",
    module: "implementations",
    subModule: "facturation-auto",
    keywordsPrimary: "flux facturation IA zéro saisie manuelle mission encaissement",
  },
  {
    slug: "axion-ia-gestion-factures-comptabilite-capture-extraction-validation-ia-banniere",
    module: "implementations",
    subModule: "comptabilite-auto",
    keywordsPrimary: "gestion factures comptabilité capture extraction validation IA",
  },
  {
    slug: "axion-ia-validation-document-tampon-comptabilite-controle-ia-carre",
    module: "implementations",
    subModule: "comptabilite-auto",
    keywordsPrimary: "validation document tampon comptabilité contrôle IA automatique",
  },

  // ── IMPLÉMENTATIONS — Gestion Emails & Messagerie (5) ────────────────────
  {
    slug: "axion-ia-tri-emails-847-recus-1-compte-ia-carre",
    module: "implementations",
    subModule: "gestion-emails",
    keywordsPrimary: "tri emails 847 reçus 1 compte IA automatique",
  },
  {
    slug: "axion-ia-inondation-emails-mur-brisant-automatisation-ia-banniere",
    module: "implementations",
    subModule: "gestion-emails",
    keywordsPrimary: "inondation emails mur automatisation IA protection",
  },
  {
    slug: "axion-ia-tri-emails-inbox-3h-a-20min-entonnoir-ia-banniere",
    module: "implementations",
    subModule: "gestion-emails",
    keywordsPrimary: "tri emails inbox 3h à 20min entonnoir IA automatique",
  },
  {
    slug: "axion-ia-boite-mail-liberte-automatisation-emails-ia-affiche",
    module: "implementations",
    subModule: "gestion-emails",
    keywordsPrimary: "boîte mail liberté automatisation emails IA",
  },
  {
    slug: "axion-ia-envoi-message-numerique-automatique-campagne-email-affiche",
    module: "implementations",
    subModule: "email-auto",
    keywordsPrimary: "envoi message numérique automatique campagne email IA",
  },

  // ── IMPLÉMENTATIONS — Courrier & Documents (2) ───────────────────────────
  {
    slug: "axion-ia-traitement-courrier-intelligent-ia-3h-a-20min-affiche",
    module: "implementations",
    subModule: "gestion-courrier",
    keywordsPrimary: "traitement courrier intelligent IA 3h à 20min automatique",
  },
  {
    slug: "axion-ia-tampon-validation-encre-terracotta-automatisation-documents-banniere",
    module: "implementations",
    subModule: "gestion-courrier",
    keywordsPrimary: "tampon validation document automatisation IA terracotta",
  },

  // ── IMPLÉMENTATIONS — Relance & CRM Client (5) ───────────────────────────
  {
    slug: "axion-ia-relance-clients-zero-manuel-100-pourcent-automatique-carre",
    module: "implementations",
    subModule: "relance-client",
    keywordsPrimary: "relance clients zéro manuel 100% automatique IA",
  },
  {
    slug: "axion-ia-accueil-client-vip-automatique-onboarding-crm-banniere",
    module: "implementations",
    subModule: "crm-client",
    keywordsPrimary: "accueil client VIP automatique onboarding CRM IA",
  },
  {
    slug: "axion-ia-relance-clients-nuit-virement-3200-euros-ia-carre",
    module: "implementations",
    subModule: "relance-client",
    keywordsPrimary: "relance clients nuit virement 3200€ IA automatique",
  },
  {
    slug: "axion-ia-relance-clients-boutique-sms-anniversaire-fidelisation-ia-carre",
    module: "implementations",
    subModule: "relance-client",
    keywordsPrimary: "relance clients boutique SMS anniversaire fidélisation IA",
  },
  {
    slug: "axion-ia-crm-boutique-12-clients-absents-34-pourcent-retour-relance-carre",
    module: "implementations",
    subModule: "crm-boutique",
    keywordsPrimary: "CRM boutique 12 clients absents 34% retour relance IA",
  },

  // ── IMPLÉMENTATIONS — Réunions & Compte-Rendus (5) ───────────────────────
  {
    slug: "axion-ia-reunion-chaos-ia-clarifie-contexte-decision-actions-affiche",
    module: "implementations",
    subModule: "compte-rendu-ia",
    keywordsPrimary: "réunion chaos IA clarifié contexte décision actions automatisé",
  },
  {
    slug: "axion-ia-reunion-1-heure-compte-rendu-4-minutes-ia-sablier-banniere",
    module: "implementations",
    subModule: "compte-rendu-ia",
    keywordsPrimary: "réunion 1 heure compte-rendu 4 minutes IA sablier",
  },
  {
    slug: "axion-ia-reunion-compte-rendu-ia-vue-aerienne-table-carre",
    module: "implementations",
    subModule: "compte-rendu-ia",
    keywordsPrimary: "réunion compte-rendu IA automatique vue aérienne table",
  },
  {
    slug: "axion-ia-compte-rendu-reunion-ecrit-automatiquement-equipe-bureau-banniere",
    module: "implementations",
    subModule: "compte-rendu-ia",
    keywordsPrimary: "compte-rendu réunion écrit automatiquement équipe bureau IA",
  },
  {
    slug: "axion-ia-transcription-reunion-microphone-60min-a-5min-ia-banniere",
    module: "implementations",
    subModule: "compte-rendu-ia",
    keywordsPrimary: "transcription réunion microphone 60min à 5min IA",
  },

  // ── IMPLÉMENTATIONS — Transcription & Analyse (2) ────────────────────────
  {
    slug: "axion-ia-transcription-audio-flux-donnees-ia-automatique-carre",
    module: "implementations",
    subModule: "transcription-ia",
    keywordsPrimary: "transcription audio flux données IA automatique",
  },
  {
    slug: "axion-ia-cerveau-ia-analyse-donnees-60-min-a-4-min-carre",
    module: "implementations",
    subModule: "analyse-ia",
    keywordsPrimary: "cerveau IA analyse données 60 minutes à 4 minutes",
  },

  // ── IMPLÉMENTATIONS — Commandes Fournisseurs (3) ─────────────────────────
  {
    slug: "axion-ia-commande-fournisseur-45min-a-0min-automatique-boulangerie-carre",
    module: "implementations",
    subModule: "commande-fournisseur",
    keywordsPrimary: "commande fournisseur 45min à 0min automatique boulangerie IA",
  },
  {
    slug: "axion-ia-commande-farine-boulangerie-automatique-sans-saisie-carre",
    module: "implementations",
    subModule: "commande-fournisseur",
    keywordsPrimary: "commande farine boulangerie automatique sans saisie IA",
  },
  {
    slug: "axion-ia-commande-fournisseur-5-etapes-ventes-stock-boulangerie-carre",
    module: "implementations",
    subModule: "commande-fournisseur",
    keywordsPrimary: "commande fournisseur 5 étapes ventes stock boulangerie IA",
  },

  // ── IMPLÉMENTATIONS — Stocks & Boucherie (5) ─────────────────────────────
  {
    slug: "axion-ia-gestion-stocks-boucherie-zero-rupture-zero-surstock-ia-carre",
    module: "implementations",
    subModule: "gestion-stocks",
    keywordsPrimary: "gestion stocks boucherie zéro rupture zéro surstock IA",
  },
  {
    slug: "axion-ia-optimisation-vente-viande-boucherie-flux-ia-carre",
    module: "implementations",
    subModule: "gestion-stocks",
    keywordsPrimary: "optimisation vente viande boucherie flux IA automatisé",
  },
  {
    slug: "axion-ia-reduction-dechets-viande-300-a-47-euros-reassort-ia-carre",
    module: "implementations",
    subModule: "gestion-stocks",
    keywordsPrimary: "réduction déchets viande 300€ à 47€ réassort automatique IA",
  },
  {
    slug: "axion-ia-tableau-bord-boucherie-zero-invendu-zero-rupture-zero-calcul-carre",
    module: "implementations",
    subModule: "gestion-stocks",
    keywordsPrimary: "tableau bord boucherie zéro invendu zéro rupture zéro calcul IA",
  },
  {
    slug: "axion-ia-gestion-stocks-prevision-j45-commandes-automatiques-ia-infographie",
    module: "implementations",
    subModule: "gestion-stocks",
    keywordsPrimary: "gestion stocks prévision J+45 commandes automatiques IA",
  },

  // ── IMPLÉMENTATIONS — Recrutement & RH (6) ───────────────────────────────
  {
    slug: "axion-ia-recrutement-ia-8-semaines-a-3-semaines-80-pourcent-automatise-banniere",
    module: "implementations",
    subModule: "recrutement-auto",
    keywordsPrimary: "recrutement IA 8 semaines à 3 semaines 80% automatisé",
  },
  {
    slug: "axion-ia-onboarding-rh-j-5-j90-90-pourcent-automatise-collaborateur-banniere",
    module: "implementations",
    subModule: "onboarding-rh",
    keywordsPrimary: "onboarding RH J-5 à J+90 90% automatisé collaborateur IA",
  },
  {
    slug: "axion-ia-selection-cv-200-candidatures-3-minutes-entonnoir-ia-banniere",
    module: "implementations",
    subModule: "recrutement-auto",
    keywordsPrimary: "sélection CV 200 candidatures 3 minutes entonnoir IA",
  },
  {
    slug: "axion-ia-meilleur-candidat-etoile-or-parmi-200-cv-3-min-banniere",
    module: "implementations",
    subModule: "recrutement-auto",
    keywordsPrimary: "meilleur candidat étoile or parmi 200 CV 3 minutes IA",
  },
  {
    slug: "axion-ia-selection-meilleur-candidat-pyramide-cv-ia-affiche",
    module: "implementations",
    subModule: "recrutement-auto",
    keywordsPrimary: "sélection meilleur candidat pyramide CV le bon trouvé IA",
  },
  {
    slug: "axion-ia-detection-profil-ideal-foule-ia-ne-cherche-pas-elle-trouve-carre",
    module: "implementations",
    subModule: "recrutement-auto",
    keywordsPrimary: "détection profil idéal foule IA ne cherche pas elle trouve",
  },

  // ── IMPLÉMENTATIONS — Support Client & Réclamations (2) ──────────────────
  {
    slug: "axion-ia-traitement-reclamations-312-semaine-4-minutes-ia-banniere",
    module: "implementations",
    subModule: "support-client",
    keywordsPrimary: "traitement réclamations 312 par semaine 4 minutes IA",
  },
  {
    slug: "axion-ia-support-client-reclamation-reponse-ia-34-secondes-affiche",
    module: "implementations",
    subModule: "support-client",
    keywordsPrimary: "support client réclamation réponse IA 34 secondes automatique",
  },

  // ── IMPLÉMENTATIONS — Analyse Contrats (1) ───────────────────────────────
  {
    slug: "axion-ia-analyse-contrat-clauses-risque-68-pages-2-minutes-ia-banniere",
    module: "implementations",
    subModule: "analyse-contrats",
    keywordsPrimary: "analyse contrat clauses risque 68 pages 2 minutes IA",
  },

  // ── IMPLÉMENTATIONS — Lead & Marketing Automation (3) ────────────────────
  {
    slug: "axion-ia-pipeline-lead-ia-zero-intervention-humaine-7-etapes-banniere",
    module: "implementations",
    subModule: "lead-scoring",
    keywordsPrimary: "pipeline lead IA zéro intervention humaine 7 étapes automatique",
  },
  {
    slug: "axion-ia-pipeline-marketing-lead-qualifie-scoring-crm-ia-banniere",
    module: "implementations",
    subModule: "marketing-auto",
    keywordsPrimary: "pipeline marketing lead qualifié scoring CRM IA",
  },
  {
    slug: "axion-ia-crm-scoring-contacts-action-automatique-bon-moment-banniere",
    module: "implementations",
    subModule: "crm-scoring",
    keywordsPrimary: "CRM scoring contacts action automatique bon moment IA",
  },

  // ── IMPLÉMENTATIONS — Reporting & Tableaux de Bord (4) ───────────────────
  {
    slug: "axion-ia-rapport-performance-hebdomadaire-automatique-lundi-matin-banniere",
    module: "implementations",
    subModule: "reporting-auto",
    keywordsPrimary: "rapport performance hebdomadaire automatique lundi matin IA",
  },
  {
    slug: "axion-ia-reporting-executif-ca-1248000-euros-marge-leads-ia-banniere",
    module: "implementations",
    subModule: "reporting-executif",
    keywordsPrimary: "reporting exécutif CA 1.248.000€ marge brute leads IA",
  },
  {
    slug: "axion-ia-prevision-tresorerie-90-jours-zero-saisie-zero-surprise-banniere",
    module: "implementations",
    subModule: "tresorerie-ia",
    keywordsPrimary: "prévision trésorerie 90 jours zéro saisie zéro surprise IA",
  },
  {
    slug: "axion-ia-gain-productivite-45-pourcent-bureau-implementation-ia-banniere",
    module: "implementations",
    subModule: "productivite",
    keywordsPrimary: "gain productivité 45% bureau implémentation IA",
  },

  // ── IMPLÉMENTATIONS — Veille & Marchés Publics (3) ───────────────────────
  {
    slug: "axion-ia-veille-concurrentielle-847-sources-12-signaux-ia-banniere",
    module: "implementations",
    subModule: "veille-concurrentielle",
    keywordsPrimary: "veille concurrentielle 847 sources 12 signaux détectés IA",
  },
  {
    slug: "axion-ia-veille-marches-publics-47000-sources-opportunites-ia-banniere",
    module: "implementations",
    subModule: "marches-publics",
    keywordsPrimary: "veille marchés publics 47000 sources opportunités IA",
  },
  {
    slug: "axion-ia-marches-publics-score-opportunites-dossier-prepare-ia-banniere",
    module: "implementations",
    subModule: "marches-publics",
    keywordsPrimary: "marchés publics score opportunités dossier préparé IA",
  },

  // ── IMPLÉMENTATIONS — Dispatch & Planning Chantier (2) ───────────────────
  {
    slug: "axion-ia-dispatch-interventions-carte-technicien-bon-endroit-ia-banniere",
    module: "implementations",
    subModule: "dispatch-interventions",
    keywordsPrimary: "dispatch interventions carte technicien bon endroit IA automatique",
  },
  {
    slug: "axion-ia-planning-chantier-gantt-ia-conflits-detectes-temps-reel-banniere",
    module: "implementations",
    subModule: "planification-chantier",
    keywordsPrimary: "planning chantier Gantt IA conflits détectés temps réel",
  },

  // ── IMPLÉMENTATIONS — Web & Personnalisation (1) ─────────────────────────
  {
    slug: "axion-ia-personnalisation-temps-reel-2847-visiteurs-experience-unique-ia-banniere",
    module: "implementations",
    subModule: "personnalisation-web",
    keywordsPrimary: "personnalisation temps réel 2847 visiteurs expérience unique IA",
  },

  // ── IMPLÉMENTATIONS — Contenu, Process & Architecture (4) ────────────────
  {
    slug: "axion-ia-generation-contenu-6-formats-4-minutes-brief-ia-infographie",
    module: "implementations",
    subModule: "generation-contenu",
    keywordsPrimary: "génération contenu 6 formats 4 minutes brief IA automatique",
  },
  {
    slug: "axion-ia-equilibre-moins-effort-plus-resultats-optimisation-ia-carre",
    module: "implementations",
    subModule: "optimisation-processus",
    keywordsPrimary: "équilibre moins effort plus résultats optimisation IA",
  },
  {
    slug: "axion-ia-comparatif-actions-humaines-vs-automatisation-ia-7-etapes-infographie",
    module: "implementations",
    subModule: "comparaison-ia",
    keywordsPrimary: "comparatif actions humaines vs automatisation IA 7 étapes",
  },
  {
    slug: "axion-ia-architecture-groupe-international-consolidation-financiere-rh-banniere",
    module: "implementations",
    subModule: "consolidation-groupe",
    keywordsPrimary: "architecture groupe international consolidation financière RH IA",
  },
];

async function main() {
  console.log("🌱 Axion-IA Image Bank — Seeder 133 images\n");
  let upserted = 0;
  let errors = 0;

  for (const entry of IMAGE_ENTRIES) {
    const imageType = detectType(entry.slug);
    const dims = DIMENSIONS[imageType];
    const isLogo = entry.module === "logo";
    const isAiGenerated = entry.isAiGenerated !== undefined ? entry.isAiGenerated : !isLogo;
    const sourceType = entry.sourceType ?? (isLogo ? "original" : "imported");

    const assetData = {
      filePath: `images/${entry.slug}.webp`,
      thumbnailPath: `images/${entry.slug}-thumb.webp`,
      avifPath: `images/${entry.slug}.avif`,
      fileFormat: "webp",
      fileSize: 0,
      width: dims.width,
      height: dims.height,
      orientation: dims.orientation,
      aspectRatio: dims.aspectRatio,
      keywordsPrimary: entry.keywordsPrimary ?? null,
      licenseType: "cc-by-4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      copyrightHolder: "Axion-IA OÜ",
      sourceType,
      aiModel: null,
      isAiGenerated,
      isActive: true,
      publishedAt: new Date(),
      isFeatured: false,
      module: entry.module,
      subModule: entry.subModule ?? null,
      targetCity: entry.targetCity ?? null,
      geoPosition: entry.geoPosition ?? null,
      geoPlacename: entry.geoPlacename ?? null,
      targetFormat: entry.targetFormat ?? null,
      requiresHumanReview: false,
      watermarkEnabled: false,
      seoScore: 0,
      targetCountries: ["FR", "BE", "CH", "LU"],
      targetLanguages: ["fr"],
    } as const;

    try {
      const asset = await prisma.imageAsset.upsert({
        where: { slug: entry.slug },
        create: { slug: entry.slug, ...assetData },
        update: assetData,
      });

      const titleFr = `Axion-IA — ${slugToTitle(entry.slug)}`;
      const labelFr = MODULE_LABELS[entry.module] ?? "Axion-IA";
      await prisma.imageAssetTranslation.upsert({
        where: { imageId_languageCode: { imageId: asset.id, languageCode: "fr" } },
        create: {
          imageId: asset.id,
          languageCode: "fr",
          slug: entry.slug,
          title: titleFr,
          alt: `${titleFr}`,
          caption: `${labelFr} — ${slugToTitle(entry.slug)}`,
          isPublished: true,
          publishedAt: new Date(),
        },
        update: {
          slug: entry.slug,
          title: titleFr,
          alt: `${titleFr}`,
          caption: `${labelFr} — ${slugToTitle(entry.slug)}`,
          isPublished: true,
          publishedAt: new Date(),
        },
      });

      console.log(`  ✓ [${entry.module}] ${entry.slug}`);
      upserted++;
    } catch (err) {
      console.error(`  ✗ [${entry.module}] ${entry.slug}`, err);
      errors++;
    }
  }

  console.log(`\n── Récap : ${upserted} upserted, ${errors} erreurs ──`);
  if (errors > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error("Erreur fatale :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
