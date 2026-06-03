// Mapping pur (ni client, ni serveur) — utilisable des 2 côtés.
// Sprint 14.10.7 fix Will (2026-05-12) — extrait de InterventionRequestForm
// qui était un Client Component, donc Next.js interdisait l'import depuis
// un Server Component (la page /interventions/demande/page.tsx). Erreur :
// « Attempted to call mapObjetToSubject() from the server but
//   mapObjetToSubject is on the client. »

export interface SubjectOption {
  value: string;
  labelFr: string;
  labelEn: string;
}

export const SUBJECT_OPTIONS: ReadonlyArray<SubjectOption> = [
  {
    value: "formation-equipe",
    labelFr: "Formation équipe (4 h à 3 j)",
    labelEn: "Team training (4 h to 3 d)",
  },
  {
    value: "coaching-individuel",
    labelFr: "Coaching individuel 1-to-1",
    labelEn: "1-on-1 individual coaching",
  },
  {
    value: "journee-dirigeant",
    labelFr: "Journée stratégique dirigeant",
    labelEn: "Executive strategic day",
  },
  { value: "conference", labelFr: "Conférence plénière", labelEn: "Plenary talk" },
  {
    value: "devis-sur-mesure",
    labelFr: "Devis sur mesure (multi-jours, multi-sites)",
    labelEn: "Bespoke quote (multi-day, multi-site)",
  },
  { value: "question-generale", labelFr: "Question générale", labelEn: "General question" },
];

/**
 * Mapping query string `?objet=<slug>` (depuis taxonomy ou ad-hoc) vers
 * SUBJECT_OPTIONS.value pour pré-sélectionner le select sur le formulaire.
 * Si pas de match, le select reste vide et le slug brut sera repris dans la
 * description pré-remplie par la page server.
 */
export function mapObjetToSubject(objet: string | undefined): string {
  if (!objet) return "";
  // ORDRE IMPORTANT (audit 2026-05-12) : les checks spécifiques `claude-dirigeant`
  // et `claude-implementation-individuel` doivent passer AVANT le fallback
  // « claude → formation-equipe », sinon ils sont mal routés. De même
  // `dirigeant` et `coaching/conference` avant les fallbacks génériques.
  if (objet.includes("dirigeant")) return "journee-dirigeant";
  if (objet.includes("conference")) return "conference";
  if (objet.includes("coaching") || objet.includes("implementation-individuel")) {
    return "coaching-individuel";
  }
  if (
    objet.includes("formation") ||
    objet.includes("collective") ||
    objet.includes("cadrage-4h") ||
    objet.includes("cadrage-1-jour") ||
    objet.includes("cadrage-2-jours") ||
    objet.includes("cadrage-3-jours") ||
    objet.includes("demarrage-ia-express") ||
    objet.includes("essentielle") ||
    objet.includes("approfondie") ||
    objet.includes("gagner-du-temps") ||
    objet.includes("claude")
  ) {
    return "formation-equipe";
  }
  if (objet.includes("sur-mesure") || objet.includes("devis")) return "devis-sur-mesure";
  return "";
}
