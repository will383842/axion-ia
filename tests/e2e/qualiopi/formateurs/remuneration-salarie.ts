// Banc @formateurs — un FORMATEUR SALARIÉ de test, et son trimestre.
//
// Données d'entrée seulement : le calcul est celui du dépôt, appelé tel quel
// (`construireLignesPrestation` → `construireReleve`, l'enchaînement de
// `runRemunerationMensuelle`, puis `deroulerAvanceRecuperable` pour le fixe
// récupérable). Le spec fige les montants AU CENTIME : tout lot du chantier
// « formateurs freelance » qui toucherait au calcul d'un salarié le verra.
//
// Le scénario couvre exprès les chemins où un centime se perd : une commission
// sur un CA indivisible, une co-animation à quotes-parts, une session
// annulée, un taux journalier converti en heures, un mois creux qui creuse la
// dette d'avance et un mois fort qui la rembourse.

import type {
  FormateurContexte,
  PrestationACalculer,
  RegleIdentifiee,
} from "@/server/qualiopi/remuneration/run";
import type { MoisCommissionne } from "@/server/qualiopi/remuneration/avance-recuperable";

/** Identifiants fictifs (UUID v4 de forme valide, jamais semés en base). */
export const SALARIE_BANC = "5a1a71e0-0000-4000-8000-00000000b4c1";
const CO_ANIMATEUR_BANC = "50c07a17-0000-4000-8000-00000000b4c2";

export const PERIODE_BANC = { year: 2026, month: 3 } as const;

export const FORMATEURS_BANC: ReadonlyMap<string, FormateurContexte> = new Map([
  [
    SALARIE_BANC,
    {
      trainerId: SALARIE_BANC,
      statut: "salarie",
      tarifJourneeHtCentsFallback: 45_000,
      regimeTva: null,
    },
  ],
  [
    CO_ANIMATEUR_BANC,
    {
      trainerId: CO_ANIMATEUR_BANC,
      statut: "sous_traitant",
      tarifJourneeHtCentsFallback: null,
      regimeTva: "franchise_293b",
    },
  ],
]);

export const REGLES_BANC: readonly RegleIdentifiee[] = [
  {
    // Commission de 30 % sur les formations collectives…
    id: "regle-banc-commission",
    trainerId: SALARIE_BANC,
    prestationType: "formation_collective",
    interventionSlug: null,
    model: "commission_ca_pct",
    commissionPct: 30,
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveTo: null,
  },
  {
    // …sauf sur cette intervention, payée à la journée.
    id: "regle-banc-journee",
    trainerId: SALARIE_BANC,
    prestationType: "formation_collective",
    interventionSlug: "ia-generative-atelier-banc",
    model: "taux_journalier",
    tauxJourneeHtCents: 52_500,
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveTo: null,
  },
  {
    id: "regle-banc-co-animateur",
    trainerId: CO_ANIMATEUR_BANC,
    prestationType: null,
    interventionSlug: null,
    model: "taux_horaire",
    tauxHoraireHtCents: 6_500,
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveTo: null,
  },
];

function session(
  id: string,
): Pick<
  PrestationACalculer,
  "type" | "sessionId" | "coachingSessionId" | "bookingId" | "auditMissionId"
> {
  return {
    type: "formation_collective",
    sessionId: id,
    coachingSessionId: null,
    bookingId: null,
    auditMissionId: null,
  };
}

export const PRESTATIONS_BANC: readonly PrestationACalculer[] = [
  {
    // Seul, CA indivisible par 3 : 30 % de 4 199,99 €.
    ...session("b4c00000-0000-4000-8000-000000000001"),
    date: new Date("2026-03-03T08:00:00Z"),
    statut: "realisee",
    interventionSlug: "acculturation-ia-banc",
    dureeHeures: 7,
    caTotalCents: 419_999,
    affectations: [{ trainerId: SALARIE_BANC }],
  },
  {
    // Co-animée 60 / 40 avec un sous-traitant, CA de 3 333,33 €.
    ...session("b4c00000-0000-4000-8000-000000000002"),
    date: new Date("2026-03-12T08:00:00Z"),
    statut: "realisee",
    interventionSlug: "acculturation-ia-banc",
    dureeHeures: 14,
    caTotalCents: 333_333,
    affectations: [
      { trainerId: SALARIE_BANC, quotePartPct: 60, heuresAnimees: 8.5 },
      { trainerId: CO_ANIMATEUR_BANC, quotePartPct: 40, heuresAnimees: 5.5 },
    ],
  },
  {
    // Au taux journalier, 10,5 h animées = 1,5 jour.
    ...session("b4c00000-0000-4000-8000-000000000003"),
    date: new Date("2026-03-19T08:00:00Z"),
    statut: "realisee",
    interventionSlug: "ia-generative-atelier-banc",
    dureeHeures: 10.5,
    caTotalCents: 280_000,
    affectations: [{ trainerId: SALARIE_BANC }],
  },
  {
    // Annulée : une ligne existe, elle ne doit rien peser.
    ...session("b4c00000-0000-4000-8000-000000000004"),
    date: new Date("2026-03-26T08:00:00Z"),
    statut: "annulee",
    interventionSlug: "acculturation-ia-banc",
    dureeHeures: 7,
    caTotalCents: 150_000,
    affectations: [{ trainerId: SALARIE_BANC }],
  },
  {
    // 31 mars à 23 h 30 à Paris, stockée le 31 en UTC : reste en MARS.
    ...session("b4c00000-0000-4000-8000-000000000005"),
    date: new Date("2026-03-31T21:30:00Z"),
    statut: "realisee",
    interventionSlug: "acculturation-ia-banc",
    dureeHeures: 3.5,
    caTotalCents: 99_999,
    affectations: [{ trainerId: SALARIE_BANC }],
  },
];

/** Fixe mensuel brut du salarié : 2 450,00 €. */
export const FIXE_MENSUEL_CENTS = 245_000;

/** Janvier et février, déjà connus ; mars vient du calcul ci-dessus. */
export function trimestreDuSalarie(commissionsMarsCents: number): MoisCommissionne[] {
  return [
    { year: 2026, month: 1, fixeCents: FIXE_MENSUEL_CENTS, commissionsCents: 133_333 },
    { year: 2026, month: 2, fixeCents: FIXE_MENSUEL_CENTS, commissionsCents: 331_234 },
    { year: 2026, month: 3, fixeCents: FIXE_MENSUEL_CENTS, commissionsCents: commissionsMarsCents },
  ];
}
