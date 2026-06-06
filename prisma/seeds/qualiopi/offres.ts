/**
 * Qualiopi — Seed du référentiel offres_site (T1).
 *
 * Dérivé de la taxonomie réelle `src/content/pricing.ts` (INTERVENTION_TIERS).
 * Le PRIX n'est PAS stocké : seul `tierId` lie au SSOT. Idempotent et non
 * destructif : crée les offres manquantes (par tierId), préserve les existantes
 * (édition admin conservée).
 *
 * Codes AXI-OFF-NNN (séquence non datée, cf. spec PART5).
 */

import type { PrismaClient, OffreFormatPedagogique, OffreTarifType } from "../../generated/client";

interface OffreSeed {
  tierId: string;
  titreFr: string;
  slug: string;
  formatPedagogique: OffreFormatPedagogique;
  publicViseFr: string;
  dureeHeuresMin: number;
  dureeHeuresMax: number;
  modalites: string[];
  tarifType: OffreTarifType;
  promessePrincipaleFr: string;
  nbModulesMin: number;
  nbModulesMax: number;
  anglePedagogiqueFr: string;
}

const PRESENTIEL_DISTANCIEL = ["presentiel", "distanciel"];
const TOUTES_MODALITES = ["presentiel", "distanciel", "hybride"];

/** Catalogue offres (ordre = code AXI-OFF-001 → 011). */
export const OFFRES_SEED: ReadonlyArray<OffreSeed> = [
  {
    tierId: "intervention-4h",
    titreFr: "Formation 4 heures",
    slug: "demarrage-ia-express",
    formatPedagogique: "collectif_4h",
    publicViseFr:
      "TPE/PME et équipes souhaitant découvrir l'IA ou cadrer un cas d'usage métier précis.",
    dureeHeuresMin: 4,
    dureeHeuresMax: 4,
    modalites: PRESENTIEL_DISTANCIEL,
    tarifType: "fixe",
    promessePrincipaleFr:
      "Découvrir l'IA opérationnelle ou cadrer un cas d'usage métier en une demi-journée.",
    nbModulesMin: 2,
    nbModulesMax: 3,
    anglePedagogiqueFr: "decouverte_pratique",
  },
  {
    tierId: "intervention-essentielle",
    titreFr: "Essentielle",
    slug: "essentielle",
    formatPedagogique: "collectif_1jour",
    publicViseFr: "Équipes de 2 à 30 personnes découvrant l'IA opérationnelle.",
    dureeHeuresMin: 6,
    dureeHeuresMax: 8,
    modalites: TOUTES_MODALITES,
    tarifType: "a_partir_de",
    promessePrincipaleFr: "Maîtriser les usages IA opérationnels en une journée sur site.",
    nbModulesMin: 3,
    nbModulesMax: 5,
    anglePedagogiqueFr: "pratique_immersive",
  },
  {
    tierId: "intervention-temps",
    titreFr: "Gagner du temps",
    slug: "gagner-du-temps",
    formatPedagogique: "collectif_1jour",
    publicViseFr: "Équipes opérationnelles souhaitant automatiser leurs tâches récurrentes.",
    dureeHeuresMin: 6,
    dureeHeuresMax: 8,
    modalites: TOUTES_MODALITES,
    tarifType: "a_partir_de",
    promessePrincipaleFr:
      "Automatiser les tâches récurrentes et intégrer l'IA au flux de travail quotidien.",
    nbModulesMin: 3,
    nbModulesMax: 5,
    anglePedagogiqueFr: "productivite_metier",
  },
  {
    tierId: "intervention-approfondie",
    titreFr: "Approfondie",
    slug: "approfondie",
    formatPedagogique: "collectif_2jours",
    publicViseFr: "Équipes de 2 à 30 personnes visant un ancrage durable des pratiques IA.",
    dureeHeuresMin: 12,
    dureeHeuresMax: 14,
    modalites: TOUTES_MODALITES,
    tarifType: "a_partir_de",
    promessePrincipaleFr:
      "Deux journées pour ancrer durablement les pratiques IA dans les métiers.",
    nbModulesMin: 4,
    nbModulesMax: 6,
    anglePedagogiqueFr: "approfondissement",
  },
  {
    tierId: "intervention-conference",
    titreFr: "Conférence",
    slug: "conference",
    formatPedagogique: "conference",
    publicViseFr: "Grands effectifs (séminaires, kick-off annuels).",
    dureeHeuresMin: 6,
    dureeHeuresMax: 8,
    modalites: ["presentiel"],
    tarifType: "sur_devis",
    promessePrincipaleFr: "Embarquer un grand collectif autour de l'IA en une journée plénière.",
    nbModulesMin: 2,
    nbModulesMax: 4,
    anglePedagogiqueFr: "sensibilisation",
  },
  {
    tierId: "intervention-dirigeants",
    titreFr: "Dirigeants",
    slug: "dirigeants",
    formatPedagogique: "dirigeant_1to1",
    publicViseFr: "Dirigeant en accompagnement individuel (1-to-1).",
    dureeHeuresMin: 6,
    dureeHeuresMax: 8,
    modalites: PRESENTIEL_DISTANCIEL,
    tarifType: "fixe",
    promessePrincipaleFr: "Structurer l'entreprise et chiffrer les gains d'implémentation IA.",
    nbModulesMin: 2,
    nbModulesMax: 4,
    anglePedagogiqueFr: "strategique_executif",
  },
  {
    tierId: "intervention-membre-equipe",
    titreFr: "Membre d'équipe",
    slug: "membre-equipe",
    formatPedagogique: "individuel",
    publicViseFr: "Collaborateur clé en accompagnement individuel (1-to-1).",
    dureeHeuresMin: 6,
    dureeHeuresMax: 8,
    modalites: PRESENTIEL_DISTANCIEL,
    tarifType: "fixe",
    promessePrincipaleFr: "Monter en compétence IA sur ses propres cas métier.",
    nbModulesMin: 2,
    nbModulesMax: 4,
    anglePedagogiqueFr: "montee_competence",
  },
  {
    tierId: "intervention-claude",
    titreFr: "Intervention Claude",
    slug: "intervention-claude",
    formatPedagogique: "collectif_1jour",
    publicViseFr: "Équipes de 2 à 30 personnes outillées sur Claude (Anthropic).",
    dureeHeuresMin: 6,
    dureeHeuresMax: 8,
    modalites: TOUTES_MODALITES,
    tarifType: "a_partir_de",
    promessePrincipaleFr: "Une journée 100 % dédiée à Claude (Anthropic) : Chat, Cowork, Code.",
    nbModulesMin: 3,
    nbModulesMax: 5,
    anglePedagogiqueFr: "outil_claude",
  },
  {
    tierId: "intervention-dirigeant-vision",
    titreFr: "Vision IA stratégique",
    slug: "vision-ia-strategique",
    formatPedagogique: "dirigeant_1to1",
    publicViseFr: "Dirigeant en accompagnement individuel (1-to-1).",
    dureeHeuresMin: 6,
    dureeHeuresMax: 8,
    modalites: PRESENTIEL_DISTANCIEL,
    tarifType: "fixe",
    promessePrincipaleFr:
      "Ouvrir les opportunités IA du secteur du dirigeant et bâtir sa feuille de route.",
    nbModulesMin: 2,
    nbModulesMax: 4,
    anglePedagogiqueFr: "vision_strategique",
  },
  {
    tierId: "intervention-claude-dirigeant",
    titreFr: "Intervention Claude · Dirigeant",
    slug: "intervention-claude-dirigeant",
    formatPedagogique: "dirigeant_1to1",
    publicViseFr: "Dirigeant en accompagnement individuel (1-to-1), 100 % Claude.",
    dureeHeuresMin: 6,
    dureeHeuresMax: 8,
    modalites: PRESENTIEL_DISTANCIEL,
    tarifType: "fixe",
    promessePrincipaleFr: "Journée 1-to-1 dirigeant 100 % dédiée à Claude (Anthropic).",
    nbModulesMin: 2,
    nbModulesMax: 4,
    anglePedagogiqueFr: "outil_claude_executif",
  },
  {
    tierId: "intervention-sur-demande",
    titreFr: "Sur demande",
    slug: "sur-demande",
    formatPedagogique: "sur_devis",
    publicViseFr:
      "Configurations hors-cadre : multi-sites, multi-jours, offsite, contenus spécifiques.",
    dureeHeuresMin: 4,
    dureeHeuresMax: 21,
    modalites: TOUTES_MODALITES,
    tarifType: "sur_devis",
    promessePrincipaleFr: "Cadrage et programme sur mesure pour les besoins hors standard.",
    nbModulesMin: 2,
    nbModulesMax: 6,
    anglePedagogiqueFr: "sur_mesure",
  },
];

function offreCode(index: number): string {
  return `AXI-OFF-${String(index + 1).padStart(3, "0")}`;
}

/** Seed idempotent : crée les offres manquantes (par tierId), préserve l'existant. */
export async function seedOffresSite(prisma: PrismaClient): Promise<void> {
  let created = 0;
  let kept = 0;
  let index = 0;
  for (const o of OFFRES_SEED) {
    const code = offreCode(index);
    index += 1;
    const existing = await prisma.offreSite.findUnique({ where: { tierId: o.tierId } });
    if (existing) {
      kept += 1;
      continue;
    }
    await prisma.offreSite.create({
      data: {
        code,
        tierId: o.tierId,
        titreFr: o.titreFr,
        slug: o.slug,
        categorie: "intervention",
        formatPedagogique: o.formatPedagogique,
        publicViseFr: o.publicViseFr,
        dureeHeuresMin: o.dureeHeuresMin,
        dureeHeuresMax: o.dureeHeuresMax,
        modalites: o.modalites,
        tarifType: o.tarifType,
        promessePrincipaleFr: o.promessePrincipaleFr,
        nbModulesMin: o.nbModulesMin,
        nbModulesMax: o.nbModulesMax,
        anglePedagogiqueFr: o.anglePedagogiqueFr,
      },
    });
    created += 1;
  }
  console.log(
    `✅ [qualiopi:seed] offres_site — ${created} créée(s), ${kept} préservée(s) (total ${OFFRES_SEED.length}).`,
  );
}
