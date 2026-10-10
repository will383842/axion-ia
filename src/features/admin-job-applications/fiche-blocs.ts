/**
 * LA FICHE « EMPLOI » EN BLOCS — règles PURES (Candidatures unifiées L8c,
 * maquette v2 validée le 2026-10-07).
 *
 * En-tête (prochain geste, barre d'étapes) · 1 Identité · 2 Ses prix / Ses
 * réponses · 3 Vidéos et liens · 4 Échanges · 5 Fichiers envoyés · 6 Décision.
 * Ce module dit ce qui ne se voit pas dans le rendu : le rang d'un prix parmi
 * ceux de la même offre, le geste attendu, et quand le bloc vidéos a lieu d'être.
 */

import type { JobApplicationStatus } from "../../../prisma/generated/client";

/** Le rang d'un prix parmi tous ceux de l'offre (lui compris). Égalité = même rang. */
export function rangDuPrix(
  montant: number,
  autres: ReadonlyArray<number>,
): { rang: number; total: number } {
  return { rang: 1 + autres.filter((x) => x < montant).length, total: autres.length + 1 };
}

/** « 3ᵉ moins cher sur 29 » ; `null` quand il n'y a rien à comparer. */
export function libelleRang(r: { rang: number; total: number }): string | null {
  if (r.total < 2) return null;
  return r.rang === 1 ? `le moins cher sur ${r.total}` : `${r.rang}ᵉ moins cher sur ${r.total}`;
}

/**
 * Le geste attendu sur la candidature, d'un mot — `null` sur une étape close.
 * `aRepondu` : au moins une réponse est déjà partie.
 */
export function prochainGeste(statut: JobApplicationStatus, aRepondu: boolean): string | null {
  switch (statut) {
    case "new":
      return aRepondu ? "Décider de la suite : à l'étude, échange ou non retenue" : "Répondre";
    case "reviewing":
    case "shortlisted":
      return "Proposer un échange, ou dire non";
    case "interview":
      return "Noter l'échange, puis décider";
    case "offer":
      return "Attendre sa réponse à la proposition";
    case "hired":
    case "rejected":
    case "withdrawn":
    case "archived":
      return null;
  }
}

/** Le bloc « Vidéos et liens » n'a lieu d'être que si l'offre en demande, ou s'il y en a. */
export function montrerBlocVideos(d: {
  readonly offreVideo: boolean;
  readonly videos: number;
  readonly liens: number;
}): boolean {
  return d.offreVideo || d.videos > 0 || d.liens > 0;
}
