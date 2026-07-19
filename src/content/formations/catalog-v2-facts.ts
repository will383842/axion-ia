// ============================================================================
// FAITS CENTRALISÉS des formations V2 (SSOT dérivé de FormationV2).
//
// But : garantir qu'AUCUNE info clé de la fiche formation n'est hardcodée dans
// le composant. Les données PARTAGÉES (durée en heures/jours, modalité, matériel,
// abonnement, image par défaut) vivent ICI → un changement se propage aux 17
// fiches. Chaque formation peut SURCHARGER via un champ optionnel de FormationV2.
//
// Décisions Will (2026-07-05) :
//   - Format : présentiel intra + distanciel possible (défaut), surchargeable.
//   - Matériel défaut : « un ordinateur avec connexion internet ».
//   - Images : mix bank (fallback par gamme) + Unsplash spécifique (override).
// ============================================================================

import type { FormationDuree, FormationGamme } from "../pricing";
import type { FormationCasUsage, FormationV2 } from "./catalog-v2";
import { FORMATION_CARD_PHOTOS } from "./catalog-v2-photos";
import { type ModalitePedagogique, PRESENTIEL_DISTANCIEL } from "./modalites";

// ── Durée canonique en NOMBRES (heures d'horloge + jours) ───────────────────
// Base 7 h/jour (standard formation professionnelle). Source unique du couple
// heures/jours affiché sur la fiche + utilisé pour le JSON-LD.
export const FORMATION_DUREE_FACTS: Record<
  FormationDuree,
  { heures: number; jours: number; heuresLabelFr: string; joursLabelFr: string }
> = {
  "4h": { heures: 4, jours: 0.5, heuresLabelFr: "4 heures", joursLabelFr: "½ journée" },
  "1j": { heures: 7, jours: 1, heuresLabelFr: "7 heures", joursLabelFr: "1 journée" },
  "2j": { heures: 14, jours: 2, heuresLabelFr: "14 heures", joursLabelFr: "2 journées" },
  "3j": { heures: 21, jours: 3, heuresLabelFr: "21 heures", joursLabelFr: "3 journées" },
};

export function getFormationDureeFacts(f: FormationV2) {
  return FORMATION_DUREE_FACTS[f.duree];
}

/** Ex. « 7 heures · 1 journée ». */
export function formatDureeFr(f: FormationV2): string {
  const d = FORMATION_DUREE_FACTS[f.duree];
  return `${d.heuresLabelFr} · ${d.joursLabelFr}`;
}

// ── Modalité (présentiel / distanciel / hybride) ────────────────────────────
export const FORMATION_MODALITE_DEFAUT: ReadonlyArray<ModalitePedagogique> = PRESENTIEL_DISTANCIEL;

export function getFormationModalites(f: FormationV2): ReadonlyArray<ModalitePedagogique> {
  return f.modalites ?? FORMATION_MODALITE_DEFAUT;
}

/** Libellé lisible : « Présentiel (dans vos locaux) — distanciel possible ». */
export function formatModalitesFr(m: ReadonlyArray<ModalitePedagogique>): string {
  const p = m.includes("presentiel");
  const d = m.includes("distanciel");
  const h = m.includes("hybride");
  if (h) return "Présentiel ou distanciel (hybride)";
  if (p && d) return "Présentiel (dans vos locaux) — distanciel possible";
  if (p) return "Présentiel — dans vos locaux";
  if (d) return "Distanciel";
  return "Présentiel — dans vos locaux";
}

/** courseMode schema.org dérivé de la modalité. */
export function getFormationCourseModes(f: FormationV2): ReadonlyArray<"Onsite" | "Online"> {
  const m = getFormationModalites(f);
  const modes: Array<"Onsite" | "Online"> = [];
  if (m.includes("presentiel") || m.includes("hybride")) modes.push("Onsite");
  if (m.includes("distanciel") || m.includes("hybride")) modes.push("Online");
  return modes.length ? modes : ["Onsite"];
}

// ── Matériel ────────────────────────────────────────────────────────────────
export const FORMATION_MATERIEL_DEFAUT =
  "Ordinateur portable, connexion internet, accès aux outils IA (comptes préparés en amont avec vous si besoin)";

export function getFormationMateriel(f: FormationV2): string {
  return f.materielFr ?? FORMATION_MATERIEL_DEFAUT;
}

// ── Effectif du groupe ──────────────────────────────────────────────────────
// Engagement contractuel : les programmes source l'annoncent en en-tête, dans
// les modalités pédagogiques ET dans les délais d'accès. Il doit donc être
// publié. Ne PAS le dériver des tranches de prix (`FormationBracket`) : celles-ci
// sont un axe tarifaire (jusqu'à 30 pers.) et sont vides pour les « sur devis ».
export const FORMATION_EFFECTIF_DEFAUT = "Jusqu’à 15 participants";

export function getFormationEffectif(f: FormationV2): string {
  return f.effectifFr ?? FORMATION_EFFECTIF_DEFAUT;
}

// ── Outils pratiqués ────────────────────────────────────────────────────────
// Dérivé de la gamme, car une formation Claude n'enseigne PAS les mêmes outils
// qu'une formation IA généraliste. Surchargeable quand la formation ne pratique
// aucun outil (Référent IA) ou un outil spécifique (Claude Code).
export const FORMATION_OUTILS_DEFAUT: Record<FormationGamme, string> = {
  "ia-standard":
    "Vous pratiquez les trois assistants les plus utilisés en entreprise — ChatGPT, Claude et Gemini — pour savoir lequel choisir selon le besoin. Les démonstrations s’appuient sur des cas transversaux, applicables à tout secteur.",
  claude:
    "La formation est intégralement construite sur Claude (Anthropic) : aucun outil tiers n’est requis.",
  "agents-automatisations":
    "Vous pratiquez Claude et ses agents pour automatiser vos tâches récurrentes, sans écrire de code.",
};

export function getFormationOutils(f: FormationV2): string {
  return f.outilsFr ?? FORMATION_OUTILS_DEFAUT[f.gamme];
}

// ── Image (fallback par gamme + override par formation) ─────────────────────
export const FORMATION_GAMME_IMAGE: Record<FormationGamme, { src: string; altFr: string }> = {
  "ia-standard": {
    src: "/illustrations/formations/salle-formation-ia-entreprise-sur-site.avif",
    altFr:
      "Formation IA en entreprise Axion-IA sur site — salle de formation avec un formateur IA expert et une équipe en atelier pratique.",
  },
  "agents-automatisations": {
    src: "/illustrations/formations/formateur-ia-claude-atelier-pme.avif",
    altFr:
      "Formation IA agents & automatisations Axion-IA — formateur expert accompagnant une équipe sur la mise en place de workflows automatisés.",
  },
  claude: {
    src: "/illustrations/formations/equipe-pme-formation-ia-atelier-pratique.avif",
    altFr:
      "Formation Claude d'Anthropic en entreprise Axion-IA — équipe en atelier pratique sur leurs propres cas d'usage.",
  },
};

export function getFormationImage(f: FormationV2): { src: string; altFr: string } {
  if (f.imageSrc) return { src: f.imageSrc, altFr: f.imageAltFr ?? f.titreFr };
  // Photo Unsplash dédiée par formation (SSOT catalog-v2-photos.ts, refonte
  // 2026-07-19 — « chaque encart de formation porte une image ») ; alt densifié
  // SEO par le titre. Fallback : image générique de la gamme.
  const photo = FORMATION_CARD_PHOTOS[f.slugFr];
  if (photo) {
    return {
      src: photo.src,
      altFr:
        f.imageAltFr ?? `Formation « ${f.titreFr} » — Axion-IA, intra-entreprise (${photo.alt})`,
    };
  }
  return FORMATION_GAMME_IMAGE[f.gamme];
}

/**
 * Crédit photographe de l'image de la formation (CGU Unsplash §9 — attribution
 * obligatoire au rendu). `null` si l'image n'est pas une photo Unsplash
 * (fallback gamme = photos maison).
 */
export function getFormationImageCredit(f: FormationV2): { name: string; url: string } | null {
  if (f.imageSrc) return f.imageCredit ?? null;
  return FORMATION_CARD_PHOTOS[f.slugFr]?.credit ?? null;
}

// Photos « scène » (bank) réutilisées pour aérer la fiche (objectifs + bandeau).
// Génériques (elles conviennent à toute formation) → parité image/texte sans
// sourcer une image par section et par formation.
const FORMATION_SCENE_PHOTOS: ReadonlyArray<{ src: string; altFr: string }> = [
  {
    src: "/illustrations/formations/salle-formation-ia-entreprise-sur-site.avif",
    altFr:
      "Formation IA en entreprise Axion-IA — salle de formation sur site, dans les locaux du client, animée par un formateur IA expert.",
  },
  {
    src: "/illustrations/formations/equipe-pme-formation-ia-atelier-pratique.avif",
    altFr:
      "Équipe en atelier pratique pendant une formation IA Axion-IA — mise en application sur les vrais outils et cas d'usage de l'entreprise.",
  },
  {
    src: "/illustrations/formations/formateur-ia-claude-atelier-pme.avif",
    altFr:
      "Formateur IA expert Axion-IA accompagnant une équipe pendant un atelier de formation en entreprise.",
  },
  {
    src: "/illustrations/formations/bilan-formation-ia-equipe-autonome.avif",
    altFr:
      "Bilan de fin de formation IA Axion-IA — équipe désormais autonome sur ses nouveaux réflexes IA.",
  },
];

/** 2 photos de scène pour la fiche, différentes de l'image héro. */
export function getFormationScenePhotos(
  f: FormationV2,
): ReadonlyArray<{ src: string; altFr: string }> {
  const heroSrc = getFormationImage(f).src;
  return FORMATION_SCENE_PHOTOS.filter((p) => p.src !== heroSrc).slice(0, 2);
}

/** Cas d'usage : override par formation, sinon repli sur les objectifs (sans image). */
export function getFormationCasUsage(f: FormationV2): ReadonlyArray<FormationCasUsage> {
  return f.casUsageFr ?? f.objectifsFr.map((o) => ({ texteFr: o }));
}

// ── Mentions réglementaires indicateur 1 (délai d'accès, méthodes, évaluation,
//    accessibilité) — obligations Code du travail / RNQ génériques, NON gatées
//    Qualiopi (aucun claim de certification). Défauts centralisés, surchargeables
//    par formation. Alignés sur la branche DB legacy de formations/[slug]/page.tsx.
export const FORMATION_DELAI_ACCES_DEFAUT =
  "Nous consulter — sous 11 jours ouvrés minimum à compter de la confirmation d'inscription et de la réception du règlement ou de la prise en charge par le financeur.";

export function getFormationDelaiAcces(f: FormationV2): string {
  return f.delaiAccesFr ?? FORMATION_DELAI_ACCES_DEFAUT;
}

export const FORMATION_METHODES_DEFAUT =
  "Pédagogie active : chaque notion fait l'objet d'une démonstration courte suivie d'une pratique immédiate sur les tâches réelles apportées par les participants. La méthode AXION est appliquée aux cas, la méthode de formulation CRFE structure les demandes à l'IA. Exercices différenciés par profil, travail en binômes, livrables réutilisables.";

export function getFormationMethodes(f: FormationV2): string {
  return f.methodesFr ?? FORMATION_METHODES_DEFAUT;
}

export const FORMATION_EVALUATION_DEFAUT =
  "L'acquisition des compétences est évaluée tout au long de la formation par des exercices pratiques, puis par un quiz individuel de 10 questions (seuil de réussite : 7/10). Une attestation individuelle mentionnant les compétences acquises et un certificat de réalisation sont délivrés à l'issue du parcours, conformément aux articles L.6353-1 et D.6353-1 du Code du travail.";

export function getFormationEvaluation(f: FormationV2): string {
  return f.modalitesEvaluationFr ?? FORMATION_EVALUATION_DEFAUT;
}

export const FORMATION_ACCESSIBILITE_DEFAUT =
  "Axion-IA s'engage à rendre ses formations accessibles aux personnes en situation de handicap. Un référent handicap est désigné au sein de l'organisme, conformément à l'article L.6352-3 du Code du travail, pour étudier toute demande d'adaptation pédagogique ou technique. Pour toute demande d'adaptation, contactez-nous avant l'inscription afin d'étudier ensemble les aménagements possibles.";

export function getFormationAccessibilite(f: FormationV2): string {
  return f.accessibiliteHandicapFr ?? FORMATION_ACCESSIBILITE_DEFAUT;
}
