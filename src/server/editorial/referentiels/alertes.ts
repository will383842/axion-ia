/**
 * Console éditoriale — jeu INITIAL des règles d'alerte (§9 du plan).
 *
 * Module PUR : aucun import `next`/prisma.
 *
 * ⚠️ Comme pour la conformité, la base fait foi. Les seuils vivent dans
 * `ed_regles_alerte.parametres` et se règlent depuis la console : le code ne
 * porte que l'évaluateur. Un seuil écrit en dur serait un seuil que Will ne
 * peut pas corriger un dimanche soir.
 *
 * ── La règle de bruit, qui décide de l'utilité de tout le dispositif ──
 *
 * Une alerte `bloquant` part IMMÉDIATEMENT. Toutes les autres sont regroupées
 * en UN envoi quotidien. Le plan est explicite sur la raison : « une alerte qui
 * déclenche une notification à chaque fois finit en règle de filtrage dans la
 * boîte de réception — et ne sert plus ». Le regroupement n'est pas un confort,
 * c'est ce qui garde le canal crédible.
 */

export interface AmorcageRegleAlerte {
  code: string;
  libelle: string;
  description: string;
  /** Seuils. `{}` quand la règle se déclenche sur un fait, sans seuil. */
  parametres: Record<string, unknown>;
  gravite: "info" | "avertissement" | "bloquant";
  actif: boolean;
}

export const ED_REGLES_ALERTE: readonly AmorcageRegleAlerte[] = [
  {
    code: "sous-production",
    libelle: "Trop peu d'un format sur le mois",
    description:
      "Compare le nombre de publications d'une famille sur le mois à l'objectif porté par " +
      "`EdObjectif`. Le seuil n'est donc pas ici : il est PAR OBJECTIF, ce qui permet une " +
      "cible différente par compte et par format.",
    parametres: { source: "ed_objectifs" },
    gravite: "avertissement",
    actif: true,
  },
  {
    code: "asset-retard",
    libelle: "Publication à J-3, asset non prêt",
    description:
      "Trois jours avant la date prévue, l'asset n'est pas au statut `pret`. C'est le délai " +
      "minimal pour reprendre un montage sans décaler la publication.",
    parametres: { jours: 3 },
    gravite: "avertissement",
    actif: true,
  },
  {
    code: "non-programme",
    libelle: "Publication à J-1, non programmée",
    description:
      "La veille, la publication est encore `non_programme`. Bloquant : passé ce point, " +
      "c'est une publication manquée, pas un retard.",
    parametres: { jours: 1 },
    gravite: "bloquant",
    actif: true,
  },
  {
    code: "canal-muet",
    libelle: "Aucune publication depuis N jours",
    description:
      "Un compte ACTIF sans parution depuis 21 jours. S'appuie sur " +
      "`EdCompte.derniereParutionA`, recalculé à chaque publication — jamais sur un agrégat " +
      "au rendu. Les comptes inactifs (« à ouvrir ») sont hors de portée : ils seraient tous " +
      "muets, et l'alerte perdrait tout sens.",
    parametres: { jours: 21, comptesActifsSeulement: true },
    gravite: "avertissement",
    actif: true,
  },
  {
    code: "derive-identite",
    libelle: "Ratio perso/pro hors cible sur 30 jours",
    description:
      "Le mix entre le profil personnel et les pages de marque s'écarte de plus de 10 points " +
      "de la cible sur une fenêtre glissante de 30 jours.",
    parametres: { fenetreJours: 30, ecartMaxPoints: 10 },
    gravite: "info",
    actif: true,
  },
  {
    code: "lien-sans-utm",
    libelle: "Lien sans marquage",
    description:
      "Doublon VOLONTAIRE de la règle de conformité `utm`, et ce n'est pas une redondance : " +
      "la conformité BLOQUE à la validation, l'alerte SIGNALE sur le stock déjà en base — " +
      "y compris ce qui a été importé sans passer par le formulaire.",
    parametres: {},
    gravite: "bloquant",
    actif: true,
  },
  {
    code: "serie-interrompue",
    libelle: "Rendez-vous récurrent sauté",
    description:
      "Une `EdSerie` avec jour fixe n'a pas sa publication à l'échéance. Un rendez-vous " +
      "manqué coûte plus qu'une publication manquée : il défait l'habitude du lecteur.",
    parametres: {},
    gravite: "avertissement",
    actif: true,
  },
  {
    code: "metriques-absentes",
    libelle: "Publication > 7 jours sans relevé",
    description:
      "Publiée depuis plus de sept jours, aucune ligne dans `EdMetrique`. Sans relevé, " +
      "l'analyse du §3 porte sur un échantillon biaisé, sans le dire.",
    parametres: { jours: 7 },
    gravite: "info",
    actif: true,
  },
  {
    code: "tournage-dormant",
    libelle: "Source sans dérivés produits",
    description:
      "Un asset `source` — un épisode tourné — n'a produit aucun dérivé depuis 14 jours. " +
      "C'est le gâchis le plus coûteux du dispositif : la valeur est déjà payée.",
    parametres: { jours: 14 },
    gravite: "avertissement",
    actif: true,
  },
  {
    code: "autorisation-manquante",
    libelle: "Épisode à J-7 sans signature",
    description:
      "Sept jours avant diffusion, l'autorisation de droit à l'image n'est pas `signee`. " +
      "Bloquant : c'est une règle de droit, pas une règle d'agenda.",
    parametres: { jours: 7, statutRequis: "signee" },
    gravite: "bloquant",
    actif: true,
  },
  {
    code: "variante-absente",
    libelle: "Short publié sur une plateforme seulement",
    description:
      "Une variante existe pour une plateforme et pas pour les autres où le compte est " +
      "actif. Le coût marginal d'une seconde diffusion est presque nul.",
    parametres: {},
    gravite: "info",
    actif: true,
  },
] as const;

/** Garde d'amorçage : le §9 en compte exactement onze. */
export const ED_REGLES_ALERTE_ATTENDUES = 11;

/**
 * Gravité à partir de laquelle une alerte part IMMÉDIATEMENT, au lieu d'être
 * regroupée dans l'envoi quotidien (§9).
 */
export const GRAVITE_ENVOI_IMMEDIAT = "bloquant" as const;
