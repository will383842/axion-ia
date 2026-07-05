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
import type { FormationV2 } from "./catalog-v2";
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
export const FORMATION_MATERIEL_DEFAUT = "Un ordinateur avec connexion internet";

export function getFormationMateriel(f: FormationV2): string {
  return f.materielFr ?? FORMATION_MATERIEL_DEFAUT;
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
  return FORMATION_GAMME_IMAGE[f.gamme];
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

/** Cas d'usage : override par formation, sinon repli sur les objectifs. */
export function getFormationCasUsage(f: FormationV2): ReadonlyArray<string> {
  return f.casUsageFr ?? f.objectifsFr;
}
