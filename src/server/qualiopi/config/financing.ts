/**
 * SSOT — Financement PUBLIC des formations (OPCO + France Travail).
 *
 * Module PUR (n'importe QUE `flag.ts`, lui-même pur `process.env`). Importable
 * par les pages publiques (Server Components), la génération de contenu
 * (construction de prompt) et les tests, sans tirer `next/headers` ni Prisma.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTRAT LÉGAL (source de vérité — ne pas contourner) :
 *
 * 1. On ne mentionne le financement QUE lorsque la Phase B est active
 *    (`OF_PUBLIC_DISCLOSURE_ENABLED=true`), c.-à-d. NDA + Qualiopi réellement
 *    obtenus. Avant la certification, toute mention « finançable » est ILLÉGALE
 *    (pratique commerciale trompeuse, C. conso L121-2). Cf. `flag.ts`.
 *
 * 2. Canaux AUTORISÉS avec Qualiopi seul : OPCO + France Travail (AIF/POEI).
 *    Qualiopi est LA condition d'accès aux fonds mutualisés/publics (C. trav.
 *    L6316-1) → l'éligibilité est automatique, aucune démarche auprès de l'OPCO
 *    n'est requise pour la revendiquer.
 *
 * 3. Canal INTERDIT : le CPF. Qualiopi NE SUFFIT PAS — le CPF exige une
 *    certification RNCP/RS + référencement EDOF (Mon Compte Formation) que
 *    l'organisme ne détient pas. `CPF_ELIGIBLE = false`. Aucune formulation ne
 *    doit citer « CPF », « Mon Compte Formation », « compte personnel de
 *    formation ». Le garde-fou `doctrine-check.ts` bloque ces termes.
 *
 * 4. Registre de langage OBLIGATOIRE : « éligible / prise en charge possible /
 *    selon votre situation ». JAMAIS « financé à 100 % automatiquement » :
 *    l'éligibilité est acquise, mais le VERSEMENT dépend toujours d'une demande
 *    préalable + accord de l'OPCO du client (ou du conseiller France Travail).
 *
 * 5. AUCUN numéro (NDA, certificat Qualiopi, SIRET) dans ces textes : ils sont
 *    volontairement absents du code public et des contenus générés.
 *
 * 6. On cite les OPCO/France Travail en TEXTE uniquement — JAMAIS leurs logos
 *    (marques tierces). Être éligible à leur financement ≠ droit d'usage de leur
 *    marque. Les visuels sont des badges « maison » neutres (cf.
 *    `components/qualiopi/FinancingBadges`).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  isQualiopiPublicDisclosureEnabled,
  isQualiopiCertificationObtenue,
} from "@/server/qualiopi/config/flag";

/** Le CPF n'est PAS mobilisable (pas de RNCP/RS + EDOF). Verrou doctrinal. */
export const CPF_ELIGIBLE = false as const;

/** Canaux de financement réellement mobilisables (Qualiopi + NDA). */
export const FINANCING_CHANNELS = {
  opco: {
    id: "opco",
    /** Public visé (salariés, entreprises). */
    audience: "Salariés & entreprises",
    /** Libellé court pour badge neutre. */
    label: "Financement OPCO",
    /** Description accessible (alt / aria / speakable). */
    description:
      "Prise en charge possible par votre opérateur de compétences (OPCO), dans le cadre du plan de développement des compétences.",
  },
  franceTravail: {
    id: "franceTravail",
    audience: "Demandeurs d'emploi",
    label: "France Travail (AIF, POEI)",
    description:
      "Financement mobilisable auprès de France Travail (aide individuelle à la formation, POEI) selon votre situation.",
  },
} as const;

export type FinancingChannelId = keyof typeof FINANCING_CHANNELS;

/**
 * Pool de formulations VARIÉES (registre « éligible / prise en charge possible »).
 * Objectif : ne jamais afficher deux fois la même phrase sur deux surfaces.
 * Toutes conformes : pas de CPF, pas de numéro, pas de sur-promesse « 100 %
 * automatique ». Ajouter des variantes = OK ; en retirer une ne casse rien
 * (le sélecteur borne modulo la longueur).
 */
export const FINANCING_BLURBS: readonly string[] = [
  "Formations éligibles à une prise en charge par votre OPCO, dans le cadre du plan de développement des compétences.",
  "Organisme certifié Qualiopi : nos parcours ouvrent droit à un financement OPCO, selon votre branche et votre situation.",
  "Le coût de la formation peut être pris en charge, en tout ou partie, par votre opérateur de compétences (OPCO).",
  "Financement possible via votre OPCO — nous vous accompagnons dans le montage du dossier de prise en charge.",
  "Salariés comme demandeurs d'emploi : un financement OPCO ou France Travail peut être mobilisé selon votre profil.",
  "Votre entreprise peut solliciter son OPCO pour financer tout ou partie de cette formation.",
  "Un dossier de prise en charge OPCO peut être constitué en amont de la session ; nous le préparons avec vous.",
  "Selon votre branche professionnelle, votre OPCO peut couvrir une partie ou la totalité des frais pédagogiques.",
  "Certifiés Qualiopi, nous rendons nos formations finançables par les fonds de votre opérateur de compétences.",
  "Prise en charge étudiée au cas par cas : nous vous aidons à mobiliser votre OPCO pour réduire le reste à charge.",
  "Demandeur d'emploi ? Un financement France Travail (AIF, POEI) peut être envisagé selon votre projet professionnel.",
  "Formation accessible via un financement OPCO, sous réserve de l'accord de votre opérateur de compétences.",
  "Nos interventions sont éligibles aux dispositifs de financement de la formation professionnelle (OPCO, France Travail).",
  "Nous étudions avec vous les possibilités de prise en charge par votre OPCO avant le démarrage de la formation.",
  "Financement mobilisable auprès de votre OPCO (salariés) ou de France Travail (demandeurs d'emploi), selon votre situation.",
  "En tant qu'organisme certifié Qualiopi, nos formations peuvent être financées par les fonds mutualisés de votre branche.",
  "Le montage du dossier de financement (OPCO, France Travail) est inclus dans notre accompagnement.",
  "Une prise en charge partielle ou totale par votre OPCO est possible : parlons-en avant de démarrer.",
];

/** Micro-mentions courtes (fin de fiche, méta, encart compact). */
export const FINANCING_MICRO: readonly string[] = [
  "Éligible à un financement OPCO.",
  "Prise en charge OPCO possible.",
  "Finançable par votre OPCO (selon situation).",
  "Financement OPCO / France Travail envisageable.",
  "Certifié Qualiopi — finançable OPCO.",
  "Prise en charge OPCO ou France Travail possible.",
];

/**
 * Hash FNV-1a 32 bits d'une chaîne (déterministe, sans `Math.random` ni
 * `Date.now`) → indispensable pour un rendu SSG stable et reproductible.
 */
function fnv1a(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    // multiplication FNV en arithmétique 32 bits non signée
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Choisit une formulation de façon DÉTERMINISTE à partir d'un `seed` stable
 * (slug de page, id de contenu…). Deux pages différentes → deux phrases
 * différentes (variété) ; la même page → toujours la même phrase (SSG stable).
 */
export function pickFinancingBlurb(seed: string): string {
  return FINANCING_BLURBS[fnv1a(seed) % FINANCING_BLURBS.length]!;
}

/** Variante courte, même logique déterministe. */
export function pickFinancingMicro(seed: string): string {
  // décalage de seed pour ne pas corréler micro & blurb sur une même page
  return FINANCING_MICRO[fnv1a(`micro:${seed}`) % FINANCING_MICRO.length]!;
}

/**
 * Renvoie une formulation de financement à afficher publiquement, ou `null` en
 * Phase A (avant certification). Choke-point de gating pour toutes les surfaces
 * publiques : une page qui n'utilise QUE ce helper est automatiquement conforme.
 */
export function getPublicFinancingBlurb(seed: string): string | null {
  if (!isQualiopiPublicDisclosureEnabled()) return null;
  // Le financement mutualise (OPCO / France Travail) SUPPOSE la certification :
  // l'annoncer avant de l'avoir, c'est promettre une eligibilite inexistante.
  // Decouple le 2026-07-25 (audit F13).
  if (!isQualiopiCertificationObtenue()) return null;
  return pickFinancingBlurb(seed);
}

/** Idem, variante courte. */
export function getPublicFinancingMicro(seed: string): string | null {
  if (!isQualiopiPublicDisclosureEnabled()) return null;
  if (!isQualiopiCertificationObtenue()) return null;
  return pickFinancingMicro(seed);
}

/**
 * Fait canonique injecté dans les prompts de génération de contenu (blog, etc.)
 * pour que le LLM tisse une mention financement REFORMULÉE à chaque fois (variété
 * naturelle), en respectant strictement le registre autorisé. Renvoie `""` en
 * Phase A (aucune injection → contenus générés restent « dark »).
 */
export function getFinancingPromptFact(): string {
  if (!isQualiopiPublicDisclosureEnabled()) return "";
  // 🚨 FUITE CORRIGÉE le 2026-08-10. Cette fonction ne gatait QUE sur la
  // divulgation, alors qu'elle injecte littéralement « fait vérifié — Axion-IA
  // est un organisme certifié Qualiopi » dans les prompts de génération
  // d'articles. `OF_PUBLIC_DISCLOSURE_ENABLED=true` étant posé en prod, la
  // chaîne content-gen affirmait donc la certification ET l'éligibilité
  // OPCO / France Travail alors que `QUALIOPI_CERTIFICATION_OBTENUE` est à
  // false — exactement la non-conformité que l'audit F13 du 2026-07-25 avait
  // corrigée sur les surfaces d'affichage, mais ce chemin-ci avait été oublié.
  //
  // Le test F13 de `financing.spec.ts` ne vérifiait que `getPublicFinancingBlurb`
  // dans ce scénario : la garde ne gardait rien ici. Un cas dédié a été ajouté.
  //
  // Conséquence : le drapeau de certification pilote maintenant TOUTES les
  // surfaces, affichage comme génération. Un seul interrupteur, cohérent.
  if (!isQualiopiCertificationObtenue()) return "";
  return [
    "FINANCEMENT (fait vérifié — Axion-IA est un organisme certifié Qualiopi, NDA déclaré) :",
    "- SI ET SEULEMENT SI le sujet touche aux formations / à la montée en compétences, tu PEUX mentionner UNE seule fois, sobrement, que les formations sont ÉLIGIBLES à une prise en charge par les OPCO (salariés/entreprises) et par France Travail (AIF, POEI ; demandeurs d'emploi). Sur un sujet sans rapport, n'en parle pas.",
    "- Registre imposé : « éligible / prise en charge possible / selon votre situation ». Reformule à ta manière (ne recopie pas une phrase toute faite).",
    "- INTERDIT : citer le CPF, « Mon Compte Formation », le compte personnel de formation (NON éligible).",
    "- INTERDIT : promettre un financement « à 100 % automatique », « gratuit » ou « intégralement pris en charge » (le versement dépend de l'accord de l'OPCO / France Travail).",
    "- INTERDIT : inventer un numéro (NDA, certificat Qualiopi) ou citer un logo d'OPCO / France Travail.",
  ].join("\n");
}
