/**
 * Content Generator — 4 templates landing-ville dédiés (Batch 3.B audit
 * 2026-05-15 P0-5 / spec § 6.1 master prompt v2.5).
 *
 * Réimplémentation Option B (audit reco 2026-05-15) : 4 system prompts
 * stockés en code (pas en DB), switchés au runtime via `templateVariant`.
 * Pas de migration Prisma — les variants sont éditables uniquement par
 * commit code, ce qui est OK pour V1 (les variants sont stables doctrine,
 * pas tunables admin).
 *
 * Migration vers ContentTemplate DB-managed = Sprint S7 (Option A) si
 * besoin émerge d'A/B tester les system prompts sans deploy.
 *
 * Convention slugs (= valeurs `templateVariant` accepted) :
 *   - "default"               → focus équilibré, KPIs des 3 modules
 *   - "focus_audit"           → tone audit-first, CTA → /audit
 *   - "focus_interventions"   → tone intervention-first, CTA → /interventions/essentielle
 *   - "focus_implementation"  → tone implementation-first, CTA → /implementation
 *
 * Fallback : si `templateVariant` est null/inconnu → "default".
 */

export type LandingVilleVariantSlug =
  | "default"
  | "focus_audit"
  | "focus_interventions"
  | "focus_implementation";

interface LandingVilleVariant {
  readonly slug: LandingVilleVariantSlug;
  readonly label: string;
  /** Override total du system prompt (override BASE doctrine). */
  readonly systemPromptOverride: string;
  /** Bloc additionnel injecté dans le user prompt (focus produit/CTA/KPI). */
  readonly userPromptFocusSection: string;
  /** CTA principal recommandé (consommé par enrichissement post-gen). */
  readonly recommendedCtaHref: string;
  readonly recommendedCtaLabel: string;
}

// Doctrine commune §21 + §1 — identique aux 4 variants. Différenciation = focus.
//
// City Domination 2026-05-18 P1-2 (audit A4 P1 + décision Will Option A) —
// Levée du ban absolu du mot "formation" : le mot est désormais AUTORISÉ en
// copy quand pertinent (description sessions interventions collectives qui
// SONT des formations dans le fond), mais le positionnement brand/URL reste
// "intervention" / "cabinet IA opérationnel". Schema.org `Course` activé sur
// les pages `/interventions/collectives/[duration]` pour citation AEO
// "formation IA" sans dilution du naming.
//
// Le mot reste contrôlé éditorialement (pas de spam) via banned-phrases côté
// quality-loop si fréquence anormale détectée.
const DOCTRINE_INTOUCHABLE = `Tu es Manon, plume éditoriale d'Axion-IA (société française).
Cabinet IA opérationnel français. Doctrine v2.5 stricte :
- Axion-IA-centric ≥ 95 % (méthodologie + cas concrets + tarifs SSOT)
- ≤ 5 % données INSEE (population, secteurs dominants)
- Anti-doorway HCU 2024 : angle unique par ville
- SIREN : [SIREN à compléter] (utiliser le placeholder jusqu'à réception du numéro définitif)
- Positionnement brand : "cabinet IA opérationnel" + "interventions" (ne pas dire "agence de formation")
- Le mot "formation" est autorisé en copy quand pertinent (descriptif sessions interventions collectives), mais "intervention" reste le naming canonique
- FR uniquement (FR-FR + x-default)`;

export const LANDING_VILLE_VARIANTS: Record<LandingVilleVariantSlug, LandingVilleVariant> = {
  default: {
    slug: "default",
    label: "Équilibré (3 modules)",
    systemPromptOverride: `${DOCTRINE_INTOUCHABLE}

Variant landing-ville : DEFAULT (équilibré).
Couvre les 3 modules à parts ~égales :
- Module 1 Interventions : présence opérationnelle, dirigeants/managers/équipes
- Module 2 Audit : grille 290-1990 € selon taille TPE/PME/ETI
- Module 3 Implémentation : automatisations + agents + IA Custom

Mention systématique : tarif Essentielle 490 € HT (offre phare entrée gamme).
Sub-prompt complet : prompts/landing-ville.md megapack (variant default).`,
    userPromptFocusSection: `## Focus DEFAULT (équilibré)
Couvre les 3 modules sans favoritisme. Mention 1× chacun avec exemple concret.
CTA principal : /interventions/essentielle (offre phare 490 €).
Sections obligatoires : Hero · 3 modules cards · cas concret local · FAQ × 8 · CTA final.`,
    recommendedCtaHref: "/interventions/essentielle",
    recommendedCtaLabel: "Réserver une intervention · 490 €",
  },

  focus_audit: {
    slug: "focus_audit",
    label: "Focus Audit (Module 2)",
    systemPromptOverride: `${DOCTRINE_INTOUCHABLE}

Variant landing-ville : FOCUS_AUDIT.
Pivote sur le Module 2 Audit & optimisation entreprise. Les 2 autres modules
sont mentionnés en cross-sell discret (footer rappel offre intervention).

KPIs centraux : gain de temps mesurable, économies cachées identifiées,
optimisation main-d'œuvre. Tarifs Audit (TPE 290 € · PME 690 € · ETI 1290 €
à distance ; +200/300/700 € sur site).

Tone : analytique, ROI-focused, "diagnostic complet en 5 jours ouvrés".
Sub-prompt complet : prompts/landing-ville.md megapack (variant focus_audit).`,
    userPromptFocusSection: `## Focus AUDIT (Module 2)
Pivote sur l'audit IA d'optimisation. Tone diagnostic, ROI, gain temps/argent.
Mention : grille 4 tailles entreprise × 2 modalités (à distance / sur site).
CTA principal : /audit (formulaire 5 étapes → rapport 5 jours ouvrés).
Sections obligatoires : Hero audit · 4 tailles entreprise · ROI estimé · FAQ
audit × 8 · CTA audit final.`,
    recommendedCtaHref: "/audit",
    recommendedCtaLabel: "Demander un audit IA",
  },

  focus_interventions: {
    slug: "focus_interventions",
    label: "Focus Interventions (Module 1)",
    systemPromptOverride: `${DOCTRINE_INTOUCHABLE}

Variant landing-ville : FOCUS_INTERVENTIONS.
Pivote sur le Module 1 Interventions entreprise. Les 5 types d'interventions
sont présentés (Essentielle, Équipes, Managers, Conférence, Dirigeants/CODIR).

KPIs centraux : intervention sur site, dès le lendemain, opérationnelle.
Tarif phare Essentielle 490 € HT (mention systématique).

Tone : opérationnel, terrain, "résultats immédiats sans théorie".
Sub-prompt complet : prompts/landing-ville.md megapack (variant focus_interventions).`,
    userPromptFocusSection: `## Focus INTERVENTIONS (Module 1)
Pivote sur les interventions entreprise. Tone opérationnel terrain.
Présente les 5 types : Essentielle (490 €), Équipes 1h/jour, Managers
réduction coûts, Conférence dirigeants, CODIR entreprise IA.
CTA principal : /interventions/essentielle (offre phare 490 €).
Sections obligatoires : Hero intervention · 5 types · cas concret local
post-intervention · FAQ × 8 · CTA Essentielle final.`,
    recommendedCtaHref: "/interventions/essentielle",
    recommendedCtaLabel: "Réserver l'intervention Essentielle · 490 €",
  },

  focus_implementation: {
    slug: "focus_implementation",
    label: "Focus Implémentation (Module 3)",
    systemPromptOverride: `${DOCTRINE_INTOUCHABLE}

Variant landing-ville : FOCUS_IMPLEMENTATION.
Pivote sur le Module 3 Implémentation IA entreprise. Couvre les 4 niveaux :
automatisation simple (à partir 990 €), projet intermédiaire (à partir 2 900 €),
projet complet (à partir 5 900 €), IA custom (8 000-50 000 € — service premium).

KPIs centraux : déploiement effectif, agents IA en production, CRM/ERP intégré,
chatbot opérationnel. Délai de livraison annoncé (1-12 semaines selon niveau).

Tone : technique mais accessible, deliverables concrets, "code livré + maintenance".
Sub-prompt complet : prompts/landing-ville.md megapack (variant focus_implementation).`,
    userPromptFocusSection: `## Focus IMPLÉMENTATION (Module 3)
Pivote sur l'implémentation IA. Tone technique accessible, deliverables concrets.
Présente les 4 niveaux : automatisation simple 990 €, projet intermédiaire
2 900 €, projet complet 5 900 €, IA Custom 8-50k €. Mention service premium.
CTA principal : /implementation (formulaire 4 étapes → étude personnalisée).
Sections obligatoires : Hero implémentation · 4 niveaux · cas concret IA Custom
local · FAQ technique × 8 · CTA implementation final.`,
    recommendedCtaHref: "/implementation",
    recommendedCtaLabel: "Démarrer une implémentation IA",
  },
};

/**
 * Résout le variant à utiliser. Retourne `default` si null/unknown.
 */
export function resolveLandingVilleVariant(
  templateVariant: string | null | undefined,
): LandingVilleVariant {
  if (!templateVariant) return LANDING_VILLE_VARIANTS.default;
  const known = LANDING_VILLE_VARIANTS[templateVariant as LandingVilleVariantSlug];
  return known ?? LANDING_VILLE_VARIANTS.default;
}

/**
 * Liste des slugs supportés (utilisé par UI admin /content-gen/landing-variants).
 */
export const LANDING_VILLE_VARIANT_SLUGS: ReadonlyArray<LandingVilleVariantSlug> = [
  "default",
  "focus_audit",
  "focus_interventions",
  "focus_implementation",
];
