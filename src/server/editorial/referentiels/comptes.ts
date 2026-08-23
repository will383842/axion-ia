/**
 * Console éditoriale — référentiel d'amorçage des marques et des comptes.
 *
 * Module PUR : aucun import `next`/prisma. Importable par le seed (script
 * Node), l'admin (Server Component) et les tests sans tirer `next/headers`.
 *
 * Source de vérité du CONTENU : `_PLANS/PLAN-CONSOLE-EDITORIALE-2026-08.md`
 * §1 bis (les onze comptes). Ce fichier n'est qu'un jeu d'AMORÇAGE : une fois
 * la base semée, **c'est la base qui fait foi**, et un compte s'ajoute depuis
 * la console sans développement (§1 bis). Ne pas transformer ce registre en
 * seconde source de vérité — le seed ne réécrit jamais un compte existant.
 */

/** Les deux marques. L'Étoffe est une marque FILLE d'Axion-IA (§1 bis). */
export interface AmorcageMarque {
  slug: string;
  nom: string;
  description: string;
}

export const ED_MARQUES: readonly AmorcageMarque[] = [
  {
    slug: "axion-ia",
    nom: "Axion-IA",
    description: "La marque mère. Site, newsletter professionnelle, pages et chaîne YouTube.",
  },
  {
    slug: "letoffe",
    nom: "L'Étoffe",
    description:
      "Marque fille d'Axion-IA — « L'Étoffe d'Axion-IA ». Podcasts tournés chez des dirigeants. " +
      "Ce qui ouvre la porte d'un dirigeant, c'est que l'entretien ne vend rien : la marque peut " +
      "être affichée, la promesse éditoriale reste l'invité.",
  },
] as const;

/**
 * Un compte du référentiel d'amorçage.
 *
 * `ordre` reprend le numéro du §1 bis — il sert la traçabilité de l'amorçage
 * et l'ordre d'affichage stable, jamais d'identifiant métier.
 */
export interface AmorcageCompte {
  ordre: number;
  slug: string;
  plateforme: "linkedin" | "youtube" | "facebook" | "instagram" | "tiktok" | "email" | "site";
  libelle: string;
  identite: "perso" | "pro";
  /** `null` = pas de marque : les comptes personnels de Williams. */
  marqueSlug: string | null;
  urlPublique: string | null;
  /** Publications visées sur 30 jours. Arme l'alerte « canal muet ». */
  cadenceCible: number | null;
  actif: boolean;
  note: string;
}

export const ED_COMPTES: readonly AmorcageCompte[] = [
  {
    ordre: 1,
    slug: "linkedin-williams-jullin",
    plateforme: "linkedin",
    libelle: "LinkedIn — Profil personnel Williams Jullin",
    identite: "perso",
    marqueSlug: null,
    urlPublique: null,
    cadenceCible: 15,
    actif: true,
    note: "Actif — porte les 61 publications planifiées du dossier importé.",
  },
  {
    ordre: 2,
    slug: "linkedin-page-axion-ia",
    plateforme: "linkedin",
    libelle: "LinkedIn — Page Axion-IA",
    identite: "pro",
    marqueSlug: "axion-ia",
    urlPublique: null,
    cadenceCible: 4,
    actif: true,
    note: "Actif — porte les 13 échos de page, en REPRISE des publications du profil.",
  },
  {
    ordre: 3,
    slug: "youtube-axion-ia",
    plateforme: "youtube",
    libelle: "YouTube — Axion-IA · Williams Jullin",
    identite: "pro",
    marqueSlug: "axion-ia",
    urlPublique: null,
    cadenceCible: null,
    actif: false,
    note: "À ouvrir. Inactif tant que la chaîne n'existe pas — un compte inactif ne déclenche pas « canal muet ».",
  },
  {
    ordre: 4,
    slug: "youtube-letoffe",
    plateforme: "youtube",
    libelle: "YouTube — L'Étoffe",
    identite: "pro",
    marqueSlug: "letoffe",
    urlPublique: null,
    cadenceCible: null,
    actif: false,
    note: "À ouvrir. Podcasts tournés chez des dirigeants — rattaché à la marque fille (décision §14 #6).",
  },
  {
    ordre: 5,
    slug: "facebook-williams-jullin",
    plateforme: "facebook",
    libelle: "Facebook — Page professionnelle Williams Jullin",
    identite: "perso",
    marqueSlug: null,
    urlPublique: null,
    cadenceCible: null,
    actif: false,
    note: "À ouvrir.",
  },
  {
    ordre: 6,
    slug: "facebook-page-axion-ia",
    plateforme: "facebook",
    libelle: "Facebook — Page Axion-IA",
    identite: "pro",
    marqueSlug: "axion-ia",
    urlPublique: null,
    cadenceCible: null,
    actif: false,
    note: "À ouvrir.",
  },
  {
    ordre: 7,
    slug: "instagram-williams-jullin",
    plateforme: "instagram",
    libelle: "Instagram — Compte personnel",
    identite: "perso",
    marqueSlug: null,
    urlPublique: null,
    cadenceCible: null,
    actif: false,
    note: "À ouvrir.",
  },
  {
    ordre: 8,
    slug: "tiktok",
    plateforme: "tiktok",
    libelle: "TikTok — Compte",
    identite: "perso",
    marqueSlug: null,
    urlPublique: null,
    cadenceCible: null,
    actif: false,
    note:
      "REPORTÉ (§1 bis) — emplacement gardé, aucune intégration. L'identité perso/pro reste à " +
      "trancher (§14 #1, avant le lot 5e) : `perso` est ici un défaut de réservation, pas une décision.",
  },
  {
    ordre: 9,
    slug: "newsletter-williams-jullin",
    plateforme: "email",
    libelle: "Newsletter — Williams Jullin",
    identite: "perso",
    marqueSlug: null,
    urlPublique: null,
    cadenceCible: null,
    actif: false,
    note:
      "À créer, jalon du 11 octobre. Une édition est écrite UNE fois puis diffusée deux fois — " +
      "e-mail et relais LinkedIn — via `EdPublication.sourceId`, jamais par duplication (§1 bis). " +
      "L'outil d'envoi reste à trancher (§14 #5).",
  },
  {
    ordre: 10,
    slug: "newsletter-axion-ia",
    plateforme: "email",
    libelle: "Newsletter — Axion-IA",
    identite: "pro",
    marqueSlug: "axion-ia",
    urlPublique: null,
    cadenceCible: null,
    actif: false,
    note: "À créer — e-mailing Mailwizz auto-hébergé.",
  },
  {
    ordre: 11,
    slug: "site-axion-ia",
    plateforme: "site",
    libelle: "Site — axion-ia.com",
    identite: "pro",
    marqueSlug: "axion-ia",
    urlPublique: "https://axion-ia.com",
    cadenceCible: null,
    actif: true,
    note:
      "ACTIF, mais son calendrier reste VIDE au lot 0 (décision §14 #2). Le branchement " +
      "`content-gen` → `EdPublication` se décidera à un lot ultérieur : l'y faire entrer " +
      "maintenant créerait la seconde source de vérité que le §13 classe en risque rouge.",
  },
] as const;

/** Garde d'amorçage : le §1 bis en compte exactement onze. */
export const ED_COMPTES_ATTENDUS = 11;
