// L'attribution D'ORIGINE d'une réservation d'échange apporteur (2026-10-10,
// audit du tunnel publicitaire — « statistiques réelles par annonce »).
//
// ── Le défaut ─────────────────────────────────────────────────────────────
// L'identifiant de l'annonce (`utm_content` du lien Facebook) était gardé sur
// la fiche à l'étape 1, puis PERDU à la réservation : la page « C'est noté »
// ne transmettait que source / medium / campagne, et le formulaire de
// réservation écrivait `utm_content = apporteur:vsl-apporteur` (le BOUTON). Une
// réservation faite depuis l'e-mail B1 ou un rappel ne portait, elle, que ce que
// son lien portait.
//
// ── La solution retenue, et pourquoi c'est la plus robuste ─────────────────
// Plutôt que de faire voyager les UTM dans CHAQUE lien (page merci, B1, B2, B3,
// et tout lien futur), la réservation RELIT l'attribution de la FICHE quand elle
// y est rattachée (par l'adresse que Calendly confirme). Quel que soit le chemin
// emprunté, la réservation retrouve l'annonce d'origine :
//   · la réservation reçoit les UTM manquants de la fiche ;
//   · un `utm_content` qui n'est qu'un MARQUEUR DE BOUTON (`apporteur:…`, écrit
//     par `utmContentDuChoix`) cède la place à l'annonce d'origine — le marqueur
//     reste lisible dans la charge brute (`_utmContentBouton`) et dans l'adresse
//     (`depuis=`) ; un `utm_content` qui N'EST PAS un marqueur n'est jamais
//     remplacé.
// Le tableau de bord, lui, compte déjà par la FICHE : il ne dépend pas de cette
// recopie, qui sert la lecture de la réservation elle-même (console, CRM).
//
// Module sans `server-only` ni `next/*` : l'enrichissement tourne aussi dans le
// worker.

/** Préfixe des marqueurs de bouton des réservations apporteur (`utmContentDuChoix("apporteur", …)`). */
export const PREFIXE_MARQUEUR_APPORTEUR = "apporteur:";

export interface AttributionFiche {
  /** La fiche vient de la page vidéo (bloc `details.vsl`). */
  readonly ficheVideo: boolean;
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  /** L'identifiant de l'annonce (`utm_content` d'origine). */
  readonly utmContent: string | null;
}

function objet(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

const texte = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, 200) : null;

/** Lecture PURE et défensive de l'attribution gardée sur une fiche. */
export function attributionDeLaFiche(details: unknown): AttributionFiche {
  const d = objet(details);
  const utm = objet(objet(d["funnel"])["utm"]);
  const vsl = d["vsl"];
  return {
    // Même critère que `lireVsl` (`lead-vsl-details.ts`) : un bloc `vsl` objet.
    ficheVideo: !!vsl && typeof vsl === "object" && !Array.isArray(vsl),
    utmSource: texte(utm["utm_source"]),
    utmMedium: texte(utm["utm_medium"]),
    utmCampaign: texte(utm["utm_campaign"]),
    utmContent: texte(utm["utm_content"]),
  };
}

export interface UtmReservation {
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  readonly utmContent: string | null;
}

/**
 * Ce qu'il faut écrire sur la réservation pour qu'elle porte l'attribution
 * d'origine d'une fiche VIDÉO. Rien pour une autre fiche. Ne complète que le
 * VIDE, et ne remplace un `utm_content` que s'il n'est qu'un marqueur de bouton.
 */
export function completerAttribution(
  reservation: UtmReservation,
  fiche: AttributionFiche,
): {
  ecrire: Partial<Record<keyof UtmReservation, string>>;
  marqueurRemplace: string | null;
} {
  if (!fiche.ficheVideo) return { ecrire: {}, marqueurRemplace: null };
  const ecrire: Partial<Record<keyof UtmReservation, string>> = {};
  if (reservation.utmSource == null && fiche.utmSource) ecrire.utmSource = fiche.utmSource;
  if (reservation.utmMedium == null && fiche.utmMedium) ecrire.utmMedium = fiche.utmMedium;
  if (reservation.utmCampaign == null && fiche.utmCampaign) ecrire.utmCampaign = fiche.utmCampaign;
  let marqueurRemplace: string | null = null;
  if (fiche.utmContent && reservation.utmContent !== fiche.utmContent) {
    const actuel = reservation.utmContent;
    if (actuel == null) ecrire.utmContent = fiche.utmContent;
    else if (actuel.startsWith(PREFIXE_MARQUEUR_APPORTEUR)) {
      ecrire.utmContent = fiche.utmContent;
      marqueurRemplace = actuel;
    }
  }
  return { ecrire, marqueurRemplace };
}
