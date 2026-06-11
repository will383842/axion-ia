// src/content/keywords/g6m-un-a-un-clusters.ts
// Module COACHING_1_TO_1 (vertical un-à-un) — extension keywords 2026-06-02 (Will).
//
// Complète g6c-coaching-clusters.ts. Différence clé : urlCible = ROUTES RÉELLES
// (anti-soft-404), pas des routes planifiées /fr/coaching-ia-dirigeants/*. Les
// vraies pages un-à-un sont :
//   /fr/un-a-un, /fr/un-a-un/par-ville,
//   /fr/interventions/{coaching-decouverte, dirigeant-vision-strategique,
//     claude-implementation-individuel, claude-dirigeant, individuel, dirigeants}
//
// Garde-fous : 0 financement (silence total), dédup vs g6c (phrasings distincts),
// AEO en '?', pas de niveau1+priorite1. Module `coaching-1-to-1`.

import type { KeywordSeed } from "./types";

type SC = Omit<KeywordSeed, "module" | "injection" | "kbType">;
function u(seed: SC): KeywordSeed {
  return {
    ...seed,
    module: "coaching-1-to-1",
    kbType: "competence_boost",
    injection: {},
  } as KeywordSeed;
}

const HUB = "/fr/un-a-un";

export const KW_UN_A_UN_V2: KeywordSeed[] = [
  // ── Pilier / hub un-à-un ───────────────────────────────────────────────────
  u({
    keyword: "coaching IA individuel sur mesure",
    intent: "transactionnel",
    cible: "pme",
    priorite: 1,
    niveau: 2,
    urlCible: HUB,
  }),
  u({
    keyword: "accompagnement IA en tête-à-tête",
    intent: "transactionnel",
    cible: "pme",
    priorite: 2,
    niveau: 2,
    urlCible: HUB,
  }),
  u({
    keyword: "coach IA personnel pour mon métier",
    intent: "transactionnel",
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    urlCible: HUB,
  }),
  u({
    keyword: "à qui s'adresse un coaching IA individuel ?",
    intent: "aeo",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    urlCible: HUB,
  }),
  u({
    keyword: "qu'est-ce qu'un accompagnement IA un-à-un ?",
    intent: "aeo",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    urlCible: HUB,
  }),
  u({
    keyword: "combien coûte un coaching IA individuel ?",
    intent: "aeo",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 2,
    urlCible: HUB,
  }),

  // ── Découverte (débutant) → coaching-decouverte ─────────────────────────────
  u({
    keyword: "coaching IA pour débuter sur son poste",
    intent: "transactionnel",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    urlCible: "/fr/interventions/coaching-decouverte",
  }),
  u({
    keyword: "découvrir l'IA appliquée à mon travail",
    intent: "transactionnel",
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/coaching-decouverte",
  }),
  u({
    keyword: "premier accompagnement IA personnel",
    intent: "transactionnel",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/coaching-decouverte",
  }),
  u({
    keyword: "coaching IA sans connaissance technique",
    intent: "transactionnel",
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/coaching-decouverte",
  }),
  u({
    keyword: "par où commencer avec l'IA sur mon poste ?",
    intent: "aeo",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/coaching-decouverte",
  }),

  // ── Avancé (productivité poussée) → hub individuel ─────────────────────────
  u({
    keyword: "coaching IA avancé workflows multi-outils",
    intent: "transactionnel",
    cible: "startup-scaleup",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/individuel",
  }),
  u({
    keyword: "industrialiser mes usages IA personnels",
    intent: "transactionnel",
    cible: "startup-scaleup",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/individuel",
  }),
  u({
    keyword: "créer mes propres agents IA personnels",
    intent: "transactionnel",
    cible: "startup-scaleup",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/individuel",
  }),
  u({
    keyword: "passer au niveau supérieur sur l'IA",
    intent: "benefice",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/individuel",
  }),
  u({
    keyword: "optimiser ma stack IA personnelle",
    intent: "transactionnel",
    cible: "startup-scaleup",
    priorite: 3,
    niveau: 3,
    urlCible: "/fr/interventions/individuel",
  }),

  // ── Dirigeant — productivité personnelle → hub dirigeants ───────────
  u({
    keyword: "coaching IA productivité du dirigeant",
    intent: "transactionnel",
    cible: "pme",
    priorite: 1,
    niveau: 3,
    urlCible: "/fr/interventions/dirigeants",
  }),
  u({
    keyword: "gagner du temps dirigeant grâce à l'IA",
    intent: "benefice",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/dirigeants",
  }),
  u({
    keyword: "automatiser le quotidien d'un dirigeant",
    intent: "transactionnel",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/dirigeants",
  }),
  u({
    keyword: "assistant IA personnel pour dirigeant",
    intent: "transactionnel",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/dirigeants",
  }),

  // ── Dirigeant — vision stratégique → dirigeant-vision-strategique ───────────
  u({
    keyword: "vision IA stratégique pour un dirigeant",
    intent: "transactionnel",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/dirigeant-vision-strategique",
  }),
  u({
    keyword: "anticiper l'impact de l'IA sur mon secteur",
    intent: "benefice",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/dirigeant-vision-strategique",
  }),
  u({
    keyword: "comment l'IA va changer mon secteur ?",
    intent: "aeo",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/dirigeant-vision-strategique",
  }),
  u({
    keyword: "journée stratégie IA pour dirigeant",
    intent: "transactionnel",
    cible: "eti",
    priorite: 3,
    niveau: 3,
    urlCible: "/fr/interventions/dirigeant-vision-strategique",
  }),

  // ── Claude individuel → claude-implementation-individuel ────────────────────
  u({
    keyword: "coaching Claude individuel sur mon poste",
    intent: "transactionnel",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/claude-implementation-individuel",
  }),
  u({
    keyword: "maîtriser Claude pour mon travail quotidien",
    intent: "transactionnel",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/claude-implementation-individuel",
  }),
  u({
    keyword: "configurer Claude Projects et Code sur mon poste",
    intent: "transactionnel",
    cible: "startup-scaleup",
    priorite: 3,
    niveau: 3,
    urlCible: "/fr/interventions/claude-implementation-individuel",
  }),

  // ── Claude dirigeant → claude-dirigeant ─────────────────────────────────────
  u({
    keyword: "coaching Claude pour un dirigeant",
    intent: "transactionnel",
    cible: "eti",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/claude-dirigeant",
  }),
  u({
    keyword: "utiliser Claude pour mes dossiers confidentiels",
    intent: "transactionnel",
    cible: "eti",
    priorite: 3,
    niveau: 3,
    urlCible: "/fr/interventions/claude-dirigeant",
  }),

  // ── Individuel — tous postes → individuel ───────────────────────────────────
  u({
    keyword: "coaching IA pour une assistante de direction",
    intent: "transactionnel",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/individuel",
  }),
  u({
    keyword: "coaching IA pour un comptable",
    intent: "transactionnel",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/individuel",
  }),
  u({
    keyword: "coaching IA pour un indépendant",
    intent: "transactionnel",
    cible: "tpe",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/individuel",
  }),
  u({
    keyword: "coaching IA adapté à n'importe quel poste",
    intent: "transactionnel",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/individuel",
  }),
  u({
    keyword: "coaching IA pour un manager d'équipe",
    intent: "transactionnel",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/interventions/individuel",
  }),

  // ── Récurrent (abonnement) → hub un-à-un ────────────────────────────────────
  u({
    keyword: "coaching IA régulier tous les mois",
    intent: "transactionnel",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    urlCible: HUB,
  }),
  u({
    keyword: "accompagnement IA individuel dans la durée",
    intent: "transactionnel",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    urlCible: HUB,
  }),
  u({
    keyword: "suivi IA personnel sur plusieurs mois",
    intent: "transactionnel",
    cible: "pme",
    priorite: 3,
    niveau: 3,
    urlCible: HUB,
  }),

  // ── Géo → /un-a-un/par-ville (keyword porte la ville) ───────────────────────
  u({
    keyword: "coaching IA individuel à Paris",
    intent: "local",
    cible: "pme",
    priorite: 2,
    niveau: 3,
    urlCible: "/fr/un-a-un/par-ville",
  }),
  u({
    keyword: "coaching IA individuel à Lyon",
    intent: "local",
    cible: "pme",
    priorite: 3,
    niveau: 3,
    urlCible: "/fr/un-a-un/par-ville",
  }),
  u({
    keyword: "coaching IA individuel à Marseille",
    intent: "local",
    cible: "pme",
    priorite: 3,
    niveau: 3,
    urlCible: "/fr/un-a-un/par-ville",
  }),
  u({
    keyword: "coaching IA individuel à Bordeaux",
    intent: "local",
    cible: "pme",
    priorite: 3,
    niveau: 3,
    urlCible: "/fr/un-a-un/par-ville",
  }),

  // ── AEO d'arbitrage → hub un-à-un ───────────────────────────────────────────
  u({
    keyword: "coaching IA individuel ou formation collective ?",
    intent: "aeo",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    urlCible: HUB,
  }),
  u({
    keyword: "coaching IA ponctuel ou régulier, que choisir ?",
    intent: "aeo",
    cible: "toutes-cibles",
    priorite: 3,
    niveau: 3,
    urlCible: HUB,
  }),
  u({
    keyword: "coaching IA dirigeant ou collaborateur, quelle différence ?",
    intent: "comparatif",
    cible: "pme",
    priorite: 3,
    niveau: 3,
    urlCible: "/fr/interventions/dirigeants",
  }),
  u({
    keyword: "que se passe-t-il pendant un coaching IA individuel ?",
    intent: "aeo",
    cible: "toutes-cibles",
    priorite: 2,
    niveau: 3,
    urlCible: HUB,
  }),
];
