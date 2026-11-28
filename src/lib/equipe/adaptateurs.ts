import { FOUNDER } from "@/lib/brand";
import {
  WILLIAMS_APPEL_FINAL,
  WILLIAMS_AVANT_APRES,
  WILLIAMS_CHIFFRES_CLES,
  WILLIAMS_CITATIONS,
  WILLIAMS_ENTETES,
  WILLIAMS_FONCTION,
  WILLIAMS_IDENTITE,
  WILLIAMS_JOURNEE_IA,
  WILLIAMS_LEAD,
  WILLIAMS_LIENS_INTERNES,
  WILLIAMS_META_DESCRIPTION,
  WILLIAMS_METHODE,
  WILLIAMS_PARCOURS,
  WILLIAMS_PARTOUT_EN_FRANCE,
  WILLIAMS_PASTILLES,
  WILLIAMS_PASTILLES_DETAILLEES,
  WILLIAMS_POUR_QUI,
  WILLIAMS_PREUVES,
  WILLIAMS_RASSURANCE,
  WILLIAMS_REVISION_DATE,
  WILLIAMS_SERVICES,
  WILLIAMS_SOUS_TITRE,
  WILLIAMS_TITRE_SEO,
  WILLIAMS_VOUS_ETES,
  buildWilliamsFaq,
} from "@/content/equipe/williams";
import type { ContenuFiche } from "./contenu";
import type { FicheCollaborateur } from "./types";

/** Une fiche brute (côté serveur) et le contenu de ses sections. */
export interface FicheComplete {
  fiche: FicheCollaborateur;
  contenu: ContenuFiche;
}

/**
 * Williams Jullin : statique (`content/equipe/williams.ts` + `lib/brand.ts`),
 * aucune base de données — fonctionne avec les stubs de build.
 *
 * Williams n'a ni ville ni point sur la carte : le lieu reste « partout en France ».
 * `financementPublic` : les Q/R OPCO / France Travail ne sont émises que si la
 * certification Qualiopi est réellement obtenue (décision de la route).
 */
export function ficheDepuisWilliams({
  financementPublic = false,
}: { financementPublic?: boolean } = {}): FicheComplete {
  const fiche: FicheCollaborateur = {
    slug: FOUNDER.slug,
    categorie: "direction",
    prenom: FOUNDER.displayName,
    nomComplet: FOUNDER.fullName,
    estDirigeantPrincipal: true,
    accord: "m",
    fonction: WILLIAMS_FONCTION,
    reponseQui: WILLIAMS_LEAD,
    afficherSurCarte: false,
    // Photo de la fiche : portrait déjà publié sur la home et dans `Organization.founder`.
    photo: {
      src: "/illustrations/home-founder-william.avif",
      largeur: 2048,
      hauteur: 2048,
      alt: `Portrait de ${FOUNDER.fullName}, fondateur et dirigeant d'Axion-IA`,
      consentementLe: "2026-08-19",
    },
    metiers: WILLIAMS_SERVICES.items.map((s) => ({ id: s.id, nom: s.nom })),
    citations: [...WILLIAMS_CITATIONS.items],
    publications: 0,
  };
  const contenu: ContenuFiche = {
    titreSeo: WILLIAMS_TITRE_SEO,
    metaDescription: WILLIAMS_META_DESCRIPTION,
    sousTitre: WILLIAMS_SOUS_TITRE,
    dateMiseAJour: WILLIAMS_REVISION_DATE,
    pastilles: WILLIAMS_PASTILLES,
    faits: WILLIAMS_PREUVES,
    chiffresCles: WILLIAMS_CHIFFRES_CLES,
    entetes: WILLIAMS_ENTETES,
    pastillesDetaillees: WILLIAMS_PASTILLES_DETAILLEES,
    pourQui: WILLIAMS_POUR_QUI,
    vousEtes: WILLIAMS_VOUS_ETES.tailles,
    vousEtesMetiers: WILLIAMS_VOUS_ETES.metiers,
    presence: { surTitre: "Partout en France", ...WILLIAMS_PARTOUT_EN_FRANCE },
    liensInternes: WILLIAMS_LIENS_INTERNES,
    identite: WILLIAMS_IDENTITE,
    avantApres: WILLIAMS_AVANT_APRES,
    rassurance: WILLIAMS_RASSURANCE,
    porteEntree: WILLIAMS_JOURNEE_IA,
    services: WILLIAMS_SERVICES,
    methode: WILLIAMS_METHODE,
    parcours: WILLIAMS_PARCOURS,
    citations: WILLIAMS_CITATIONS,
    faq: buildWilliamsFaq({ certificationObtenue: financementPublic }),
    appelFinal: WILLIAMS_APPEL_FINAL,
    liens: { linkedin: FOUNDER.linkedin },
  };
  return { fiche, contenu };
}
