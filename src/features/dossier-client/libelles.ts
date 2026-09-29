/**
 * Libellés français du dossier client, pour l'écran (Will n'est pas
 * développeur : jamais un nom d'énumération à l'écran). Module PUR.
 *
 * `satisfies Record<…>` : une valeur ajoutée à une énumération sans libellé
 * ici ne compile pas.
 */

import type {
  FaitType,
  ProjetStatut,
  RencontreStatut,
  RendezVousSuite,
  RoleDansProjet,
} from "../../../prisma/generated/client";

export const LIBELLE_TYPE_FAIT = {
  info_societe: "Ce que fait la société",
  activite: "Activité",
  effectif: "Effectif",
  outil_utilise: "Outil utilisé",
  niveau_ia: "Niveau en IA",
  decideur: "Décideur",
  processus_decision: "Circuit de décision",
  probleme: "Problème",
  besoin: "Besoin",
  objectif: "Objectif",
  public_cible: "Public à former",
  nb_participants: "Nombre de participants",
  modalite_souhaitee: "Modalité souhaitée",
  lieu_intervention: "Lieu",
  contrainte: "Contrainte",
  budget: "Budget",
  financement: "Financement",
  echeance: "Échéance",
  objection: "Objection",
  concurrent: "Concurrent",
  engagement_axion: "Engagement de Williams",
  engagement_client: "Engagement du client",
  prix_annonce_axion: "Prix annoncé",
  offre_envisagee: "Offre envisagée",
  question_ouverte: "Question ouverte",
  question_client_repondue: "Question du client (répondue)",
  prochaine_etape: "Prochaine étape",
  mise_en_relation: "Recommandé par",
  autre: "Autre",
} as const satisfies Record<FaitType, string>;

/** Rubriques du compte rendu (gabarit, `compte-rendu-et-extraction.md` §2.2). */
export const LIBELLE_RUBRIQUE: Readonly<Record<number, string>> = {
  1: "L'entreprise",
  2: "Interlocuteurs et décision",
  3: "Problèmes",
  4: "Besoins",
  5: "Périmètre de la formation ou de la mission",
  6: "Budget et financement",
  7: "Calendrier",
  8: "Objections et concurrence",
  9: "Engagements",
  10: "Offres envisagées",
  11: "Questions ouvertes",
  12: "Signaux d'alerte",
  13: "Prochaine étape",
};

export const LIBELLE_STATUT_PROJET = {
  ouvert: "En cours",
  en_pause: "En pause",
  gagne: "Gagné",
  perdu: "Perdu",
  abandonne: "Abandonné",
  termine: "Terminé",
} as const satisfies Record<ProjetStatut, string>;

export const LIBELLE_ROLE_PROJET = {
  decideur: "décide",
  financeur: "finance",
  referent: "interlocuteur au quotidien",
  utilisateur: "bénéficiaire",
  prescripteur: "a recommandé Axion-IA",
  autre: "autre rôle",
} as const satisfies Record<RoleDansProjet, string>;

export const LIBELLE_STATUT_RENCONTRE = {
  planifie: "À venir",
  tenu: "Tenu",
  annule: "Annulé",
  absent: "Client absent",
  reporte: "Reporté",
} as const satisfies Record<RencontreStatut, string>;

export const LIBELLE_SUITE = {
  devis: "Envoyer un devis",
  relance: "Relancer",
  proposition: "Envoyer une proposition",
  aucune: "Aucune suite",
} as const satisfies Record<RendezVousSuite, string>;

/** Montant en euros, sans centimes inutiles. */
export function euros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** La valeur d'un fait, lisible : montant, date, nombre, ou texte. */
export function valeurLisible(f: {
  readonly type: FaitType;
  readonly enonce: string;
  readonly texteCourt: string | null;
  readonly montantMinCents: number | null;
  readonly montantMaxCents: number | null;
  readonly dateCible: Date | null;
  readonly quantite: number | null;
}): string {
  if (f.montantMinCents !== null || f.montantMaxCents !== null) {
    if (f.montantMinCents !== null && f.montantMaxCents !== null) {
      return f.montantMinCents === f.montantMaxCents
        ? euros(f.montantMinCents)
        : `${euros(f.montantMinCents)} à ${euros(f.montantMaxCents)}`;
    }
    return f.montantMaxCents !== null
      ? `jusqu'à ${euros(f.montantMaxCents)}`
      : `à partir de ${euros(f.montantMinCents ?? 0)}`;
  }
  if (f.type === "echeance" && f.dateCible !== null) {
    return f.dateCible.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  }
  if (f.quantite !== null) return String(f.quantite);
  return (f.texteCourt ?? f.enonce).trim() || "—";
}
