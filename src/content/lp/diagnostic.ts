// Page d'atterrissage publicitaire du diagnostic (`/diagnostic`) — contenu.
//
// Séparé du rendu pour que la copie se retouche sans toucher au code : sur une
// page qui reçoit du trafic payant, le texte se teste et se change souvent,
// la mise en page presque jamais.
//
// ⚠️ RÈGLE ABSOLUE DE CETTE PAGE : tout ce qui est affirmé ici doit être VRAI.
// Les pages de ce format affichent d'ordinaire « +12 000 clients nous font
// confiance » ou des témoignages de complaisance. Nous n'avons pas ces
// chiffres, et les inventer serait une pratique commerciale trompeuse
// (art. L121-2 du Code de la consommation) — devant une audience de dirigeants
// qui vérifient, ce serait aussi la pire décision commerciale possible.
//
// Les trois preuves retenues ci-dessous sont donc factuelles et vérifiables sur
// le site lui-même : la gratuité, l'absence d'inscription, et l'ouverture du
// modèle de calcul.

import { AUTOMATABLE_TASKS } from "@/content/roi/model/tasks";

/**
 * Vidéo de la page. `null` tant qu'aucune vidéo n'est publiée : le bloc n'est
 * alors pas rendu du tout, et la page reste cohérente (titre → preuves → CTA).
 *
 * 🔴 NE PAS pointer vers un domaine externe (R2, CDN, YouTube, Vimeo) sans
 * modifier la CSP : `src/lib/csp.ts` ne déclare aucune directive `media-src`,
 * donc `default-src 'self'` s'applique et le navigateur bloquerait la lecture
 * SANS message d'erreur visible. Deux chemins possibles :
 *   • fichier servi depuis `public/videos/` → même origine, rien à changer ;
 *   • hébergement externe → ajouter `media-src 'self' https://<domaine>` dans
 *     `csp.ts`, et l'y documenter.
 *
 * Format conseillé : MP4 H.264 720p, poids ≤ 25 Mo, avec une affiche AVIF. Le
 * `poster` est obligatoire — sans lui la vidéo affiche un rectangle noir tant
 * que rien n'est chargé, ce qui ruine l'effet d'une page construite autour
 * d'elle.
 */
export const VSL_VIDEO: {
  readonly src: string;
  readonly poster: string;
  readonly durationLabel: string;
} | null = null;

export const VSL_CONTENT = {
  /** Slug de la page — sert de dimension d'analyse pour comparer des variantes. */
  slug: "diagnostic",

  eyebrow: "Pour les dirigeants qui n'ont plus une heure à perdre",

  /**
   * Titre en trois fragments, pour que le rendu puisse souligner le milieu et
   * mettre la chute en italique. Découper la phrase ici plutôt que d'insérer
   * du balisage dans une chaîne : la copie reste lisible et traduisible.
   */
  title: {
    lead: "Découvrez quelles tâches votre entreprise",
    underlined: "peut arrêter de faire à la main",
    tail: "et ce que ça vous rapporte",
    accent: "en moins de 3 minutes",
  },

  /** Formule « sans X, sans Y » — les objections levées avant d'être formulées. */
  subtitle: {
    strong: "Sans",
    rest: "installer de logiciel, sans créer de compte, et sans rendez-vous commercial.",
  },

  videoLabel: "Regardez cette vidéo",
  videoFallbackLabel: "Ce que vous allez obtenir",

  ctaPrimary: "Lancer mon diagnostic gratuit",
  ctaHint: "Une dizaine de questions. Vous voyez votre rapport à la fin, sans rien laisser.",

  /** Ce que le rapport contient — la promesse, en quatre lignes concrètes. */
  deliverables: [
    "Les 5 premières tâches à automatiser chez vous, classées par rapport entre le gain et l'effort",
    "Le temps et l'argent récupérables sur l'année, avec une fourchette basse et haute",
    "Une feuille de route à 30 jours, 3 mois et 6 mois, avec le montant de chaque étape",
    "Ce qui, chez vous, ne s'automatise pas — et pourquoi",
  ],

  /**
   * Preuves. Chacune est vérifiable sur le site : pas de chiffre de notoriété,
   * pas de témoignage, pas de logo client. Cf. l'avertissement en tête de
   * fichier.
   */
  proofs: [
    { label: "Gratuit", detail: "Aucune carte, aucun engagement" },
    { label: "Sans inscription", detail: "Le rapport s'affiche sans e-mail" },
    {
      label: `${AUTOMATABLE_TASKS.length} tâches de référence`,
      detail: "Chaque chiffre est justifié, ligne par ligne",
    },
  ],

  founder: {
    name: "Williams",
    role: "Fondateur d'Axion-IA, auteur du modèle d'estimation",
    quote:
      "La plupart des calculateurs vous font inventer le chiffre qui sert ensuite à vous impressionner. Le nôtre ne demande que ce que vous savez déjà, et vous dit aussi ce qui ne s'automatise pas.",
    photo: "/illustrations/william-fondateur-formateur-ia-axion-ia.avif",
    photoAlt: "Williams, fondateur d'Axion-IA",
  },

  legal:
    "Estimation issue d'un modèle dont toutes les hypothèses sont publiées. Ni un devis, ni un audit, ni un engagement de résultat.",
} as const;
