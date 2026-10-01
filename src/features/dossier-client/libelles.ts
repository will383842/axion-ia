/**
 * Libellés français du dossier client, pour l'écran (Will n'est pas
 * développeur : jamais un nom d'énumération à l'écran). Module PUR.
 *
 * `satisfies Record<…>` : une valeur ajoutée à une énumération sans libellé
 * ici ne compile pas.
 */

import type {
  CompteRenduStatut,
  EtapeVisio,
  FaitType,
  MotifProposition,
  MotifRejetFait,
  ProjetStatut,
  RencontreStatut,
  RendezVousIssue,
  RendezVousSuite,
  RoleDansProjet,
  StatutEtape,
  TypeConsentement,
} from "../../../prisma/generated/client";
import type { StatutRubrique } from "@/server/visio/verification/g06-couverture";
import type { EtatValeur } from "@/features/dossier-client/consolider-faits";
import {
  LIBELLE_ISSUE as LIBELLE_ISSUE_RDV,
  LIBELLE_SUITE as LIBELLE_SUITE_RDV,
} from "@/features/admin-rendezvous/suivi";

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

/**
 * Mention d'état d'une valeur consolidée — table UNIQUE, lue par la fiche
 * (`LigneValeur`) comme par l'aide au devis : Will lit la même phrase partout.
 * `null` : valeur courante, sans réserve.
 */
export const MENTION_ETAT = {
  courante: null,
  a_trancher: "à trancher : plusieurs valeurs ont été dites",
  a_reconfirmer: "à reconfirmer : remise en cause",
  avant_reouverture: "dite avant la réouverture du projet : à reconfirmer",
  effacee: "valeur effacée",
} as const satisfies Record<EtatValeur, string | null>;

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

/**
 * Les libellés de la suite et de l'issue d'un rendez-vous : CEUX de l'onglet
 * « Rendez-vous » (`admin-rendezvous/suivi.ts`), une seule table — la même
 * suite ne s'appelle pas « Devis à envoyer » dans un formulaire et « Envoyer
 * un devis » sur la page d'à côté.
 */
export const LIBELLE_SUITE: Readonly<Record<RendezVousSuite, string>> = LIBELLE_SUITE_RDV;
export const LIBELLE_ISSUE: Readonly<Record<RendezVousIssue, string>> = LIBELLE_ISSUE_RDV;

/** Pourquoi cette fiche est proposée, en français. */
export const LIBELLE_MOTIF = {
  email_calendly: "même adresse e-mail que la fiche",
  contact_connu: "l'adresse d'une personne de la fiche",
  domaine_email: "même domaine d'entreprise qu'une personne de la fiche",
  entreprise_declaree: "le nom d'entreprise donné dans la réservation",
  demande_liee: "une demande envoyée depuis le site",
  report: "le rendez-vous qu'il remplace était chez ce client",
  choix_extension: "choisie au démarrage de l'enregistrement",
  contenu_compte_rendu: "déduite du compte rendu",
} as const satisfies Record<MotifProposition, string>;

// ── Compte rendu d'un rendez-vous enregistré (chantier visio, PR 6) ──────────

export const LIBELLE_STATUT_COMPTE_RENDU = {
  brouillon: "en préparation",
  a_valider: "à valider",
  valide: "validé",
  remplace: "remplacé",
  rejete: "rejeté",
  a_regenerer: "à réécrire",
} as const satisfies Record<CompteRenduStatut, string>;

export const LIBELLE_ETAPE_VISIO = {
  transcrire: "Transcription",
  precontroler: "Contrôles avant rédaction",
  extraire: "Extraction des faits",
  verifier_faits: "Vérification des faits",
  rattacher: "Rattachement aux projets",
  consolider: "Comparaison avec l'historique",
  // UX-06 : aucun devis n'est pré-rempli (décision de Williams) — l'étape relève des offres.
  ebaucher: "Offres du catalogue évoquées",
  rediger: "Rédaction",
  verifier_compte_rendu: "Vérification du compte rendu",
  purger_audio: "Suppression du son",
  questionnaire: "Questionnaire de cadrage",
  lire_reponses: "Lecture des réponses au questionnaire",
  email_suivi: "E-mail de suivi",
} as const satisfies Record<EtapeVisio, string>;

export const LIBELLE_STATUT_ETAPE = {
  a_faire: "à faire",
  en_cours: "en cours",
  reussie: "faite",
  echec_definitif: "en échec",
  annule: "annulée",
  suspendu: "suspendue",
} as const satisfies Record<StatutEtape, string>;

export const LIBELLE_STATUT_COUVERTURE = {
  aborde: "Abordé",
  evoque_sans_precision: "Évoqué sans précision",
  non_aborde: "Non abordé",
} as const satisfies Record<StatutRubrique, string>;

/** Pourquoi la vérification a écarté un fait — jamais un nom d'énumération à l'écran. */
export const LIBELLE_MOTIF_REJET = {
  citation_introuvable: "la phrase citée ne se retrouve pas mot pour mot",
  citation_trop_courte: "citation trop courte pour prouver quoi que ce soit",
  citation_trop_longue: "citation trop longue",
  segment_inconnu: "passage inexistant dans l'enregistrement",
  preuve_historique: "la preuve cite un échange précédent, pas celui du jour",
  locuteur_non_admis: "dit par Williams sans confirmation du client",
  valeur_non_prouvee: "un chiffre ou une date absent de la citation",
  deduction_interdite: "déduction interdite pour ce type d'information",
  reference_catalogue_inconnue: "offre inconnue du catalogue",
  relation_hors_projet: "relation avec un autre projet",
  version_remplacee: "remplacé par une nouvelle version",
  doublon: "déjà validé",
  rejete_par_williams: "rejeté par Williams",
  rectification: "rectifié",
} as const satisfies Record<MotifRejetFait, string>;

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

/** Les preuves d'accord d'un rendez-vous enregistré, pour l'écran du compte rendu. */
export const LIBELLE_TYPE_CONSENTEMENT = {
  declaration_axion: "Accord déclaré par vous (« Accord obtenu »)",
  phrase_retrouvee_verifiee: "Réponse d'accord retrouvée dans l'enregistrement",
  reponse_calendly: "Réponse à la question de la réservation (indice)",
  nouveau_participant_signale: "Arrivée d'une personne signalée en cours d'appel",
  retrait: "Accord retiré",
} as const satisfies Record<TypeConsentement, string>;
