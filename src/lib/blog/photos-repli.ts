/**
 * Photos de repli des gabarits d'articles (S2, révision v3) : table statique
 * `gabarit → { src, alt }` de la banque du site (`public/images/axion-ia-*`, chaque
 * fichier existe en `.webp` ET en `.avif`). Utilisée UNIQUEMENT quand l'article n'a pas
 * de `featuredImage`. Jamais un dessin, un SVG ni une infographie : aucun nom de fichier
 * ne contient « infographie » ni un chiffre-vedette (verrouillé par test). La photo de
 * repli n'entre ni dans `og:image` ni dans le JSON-LD (les métadonnées ne changent pas).
 */
import type { GabaritArticle } from "@/server/content-gen/blog/gabarits";

export interface PhotoRepli {
  readonly src: string;
  readonly alt: string;
}

export const PHOTOS_REPLI: Readonly<Record<GabaritArticle, PhotoRepli>> = {
  analyse: {
    src: "/images/axion-ia-atelier-ia-equipe-commerciale-crm-automatisation-leads.webp",
    alt: "Une équipe réunie autour d’un ordinateur portable dans un atelier, pendant un point d’avancement",
  },
  guide: {
    src: "/images/axion-ia-compte-rendu-reunion-ecrit-automatiquement-equipe-bureau-banniere.webp",
    alt: "Une responsable relit sur son ordinateur portable le compte rendu d’une réunion d’équipe",
  },
  comparatif: {
    src: "/images/axion-ia-audit-ia-cartographie-outils-existants-systeme-information-banniere.webp",
    alt: "Un poste de travail avec plusieurs outils numériques ouverts côte à côte",
  },
  selection: {
    src: "/images/axion-ia-audit-ia-diagnostic-workflow-taches-repetitives-detection.webp",
    alt: "Un bureau vu de haut avec des dossiers, un ordinateur portable et des notes numérotées",
  },
  cas: {
    src: "/images/axion-ia-cas-concret-soirees-admin-devis-factures-automatiques-pme-carre.webp",
    alt: "Un artisan relit un devis imprimé sur l’établi de son atelier",
  },
  definition: {
    src: "/images/axion-ia-connexion-outils-crm-erp-ia-automatisation-donnees.webp",
    alt: "Une pile de classeurs sur un bureau, à côté d’un ordinateur portable ouvert",
  },
  faq: {
    src: "/images/axion-ia-audit-ia-entretien-dirigeant-recueil-besoins-analyse.webp",
    alt: "Une dirigeante pose une question à son conseiller lors d’un rendez-vous",
  },
  chiffres: {
    src: "/images/axion-ia-audit-ia-diagnostic-numerique-pme-bilan-competences.webp",
    alt: "Un tableau de bord imprimé posé sur un bureau, à côté d’un ordinateur portable",
  },
};
