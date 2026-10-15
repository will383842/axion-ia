// Banc @formateurs, équipe ARGENT — le contrat entre un spec et `argent-executer.ts`.
//
// Module PUR, importé des deux côtés (le spec n'importe JAMAIS l'exécuteur, qui
// s'exécute dès son chargement). Une entrée est une LISTE d'étapes jouées dans
// l'ordre par un seul processus `tsx` : un démarrage de `tsx` coûte ~3 s, un
// scénario d'argent en enchaîne une dizaine.
//
// Chaque étape appelle le code serveur RÉEL. Les instants voyagent en ISO 8601 :
// c'est l'horloge pilotée du banc, passée en paramètre, jamais une horloge truquée.

export const MARQUEUR_RESULTAT_ARGENT = "@@BANC-ARGENT@@";

export type EtapeArgent =
  /**
   * Le passage quotidien du paiement par mission (`passerPaiementsMission`), avec ses
   * dépendances RÉELLES, sauf trois points que le banc déclare :
   *   · la date de bascule est passée en paramètre (l'écran refuse de la poser : son
   *     préalable « canal de changement de compte » n'est pas lisible, ⛔) ;
   *   · les candidats lus sont restreints aux sessions du test (la base est partagée) ;
   *   · `retraitMd: "declare"` répond « M-D fait » ; `"reel"` lit `pg_indexes`.
   */
  | {
      readonly etape: "passage";
      readonly maintenant: string;
      readonly dateBascule: string;
      readonly sessionIds: readonly string[];
      readonly retraitMd: "declare" | "reel";
    }
  /** Un stagiaire signe un créneau (`signerCreneau`, modalité accessible). */
  | {
      readonly etape: "signer-stagiaire";
      readonly creneauId: string;
      readonly enrollmentId: string;
      readonly nomConfirme: string;
      readonly maintenant: string;
    }
  /** Le formateur contresigne une demi-journée (`contresignerDemiJournee`). */
  | {
      readonly etape: "contresigner";
      readonly sessionId: string;
      readonly trainerId: string;
      readonly date: string;
      readonly demiJournee: "matin" | "apres_midi" | "journee";
      readonly nomConfirme: string;
      readonly maintenant: string;
      readonly methode?: "confirmation_accessible" | "papier_scanne";
    }
  /**
   * « Valider » puis émettre l'autofacture. La validation n'a AUCUN service hors
   * session (`transitionStatementAction` exige `auth()`) : l'étape écrit l'effet exact du
   * clic (statut `valide` sur le relevé tel qu'il est, lignes `calcule` → `valide`), puis
   * appelle `emettreAutofacture`, le service même du bouton et du rattrapage horaire.
   */
  | { readonly etape: "valider-et-emettre"; readonly statementId: string }
  /** Le calcul mensuel (`runRemunerationMensuelle`), tel que « Lancer le calcul ». */
  | { readonly etape: "run-mensuel"; readonly year: number; readonly month: number }
  /** L'avis du formateur puis « Terminer » le bilan de fin de formation. */
  | {
      readonly etape: "terminer-bilan";
      readonly sessionId: string;
      readonly trainerId: string;
      readonly maintenant: string;
    }
  /** Le suivi quotidien (`passerSuiviMission`) : F35, alertes, rappels, reprise F37. */
  | { readonly etape: "suivi"; readonly maintenant: string }
  /**
   * Les demandes de contresignature (F34, `envoyerDemandesContresignature`).
   *
   * `retenirLeWorker` : les envois enfilés par le passage sont posés en DIFFÉRÉ le
   * temps du passage, puis promus (la file, partagée, n'est jamais mise en pause). Raison : défaut V1-C-11 — `enqueueEmail` pose le job AVANT la ligne
   * « pending » du journal ; un worker qui le termine entre les deux crée sa propre
   * ligne, et le même envoi en compte deux. F34 compte ces lignes (rang, plafond de 3) :
   * la course couperait un rappel au hasard. La retenue écarte la course (consignée à part)
   * pour éprouver la CADENCE ; rien du passage lui-même n'est changé.
   */
  | {
      readonly etape: "demandes-contresignature";
      readonly maintenant: string;
      readonly retenirLeWorker?: boolean;
    }
  /**
   * Le passage des campagnes (`passerCampagnes`), restreint aux fiches du test.
   * `retenirLeWorker` : voir `demandes-contresignature` (V1-C-11 — les campagnes aussi
   * comptent les lignes du journal pour décider de l'étape suivante).
   */
  | {
      readonly etape: "campagnes";
      readonly maintenant: string;
      readonly trainerIds: readonly string[];
      readonly retenirLeWorker?: boolean;
    }
  /** La vue « Virements à faire » (`lireVirementsSortants`), restreinte aux pièces du test. */
  | { readonly etape: "virements"; readonly maintenant: string; readonly ids: readonly string[] }
  /** La garde du virement d'un relevé de mission, AU CLIC (`contexteVirementMission`). */
  | {
      readonly etape: "garde-virement";
      readonly statementId: string;
      readonly empreinteAffichee: string | null;
      readonly maintenant: string;
    }
  /** F37 après « Virements faits (N) » (`envoyerVirementsFaits`). */
  | { readonly etape: "virements-faits"; readonly ids: readonly string[] }
  /** La reprise d'un F37 perdu (`reprendreVirementsFaitsSansF37`). */
  | { readonly etape: "reprendre-f37"; readonly maintenant: string }
  /** F38 (`envoyerVirementEnAttente`). */
  | { readonly etape: "f38"; readonly statementId: string }
  /** Ce qui suit la décision sur une pièce (`apresDecisionPiece`) : F41, F57. */
  | {
      readonly etape: "apres-decision-piece";
      readonly documentId: string;
      readonly decision: "valide" | "rejete";
      readonly maintenant: string;
    }
  /** Le formateur demande un changement d'IBAN (`demanderChangementIban`). */
  | {
      readonly etape: "demander-iban";
      readonly trainerId: string;
      readonly iban: string;
      readonly maintenant: string;
    }
  /** Un administrateur valide la demande (`validerDemandeChangement`). */
  | {
      readonly etape: "valider-demande";
      readonly demandeId: string;
      readonly adminId: string;
      readonly maintenant: string;
    }
  /** L'indemnité d'annulation décidée en console (`ecrireIndemniteDecidee`). */
  | {
      readonly etape: "indemnite";
      readonly missionId: string;
      readonly annuleeA: string;
      readonly parAxion: boolean;
    }
  /** Le formateur signale un désaccord sur sa facture (`signalerDesaccord`). */
  | {
      readonly etape: "signaler-desaccord";
      readonly trainerId: string;
      readonly statementId: string;
      readonly texte: string;
      readonly maintenant: string;
    }
  /**
   * Une CORRECTION de relevé de mission, puis les deux réécritures que tenteraient deux
   * passages (`ecrireMoisDansTransaction`). `geste` :
   *   · `annuler` — l'effet exact du clic « Annuler » de `transitionStatementAction`
   *     (aucun service hors session) : relevé `annule` sous condition du statut lu et
   *     sans autofacture, lignes `annule` (motif `autre`) ;
   *   · `avoir` — `emettreAvoirMission`, le service du désaccord accepté.
   * M-D n'étant pas en base, il est SIMULÉ comme dans les tests d'intégration du dépôt :
   * `DROP INDEX` DANS une transaction toujours ANNULÉE. Rien n'est gardé ; l'étape rend
   * ce qu'elle a observé avant l'annulation. `retraitMd: "reel"` : sans la simulation.
   */
  | {
      readonly etape: "correction";
      readonly geste: "annuler" | "avoir";
      readonly statementId: string;
      readonly maintenant: string;
      readonly retraitMd: "simule" | "reel";
      /** Le mois que le passage tenterait de réécrire (contresignatures du mois). */
      readonly mois: {
        readonly trainerId: string;
        readonly sessionId: string;
        readonly tarifJourneeHtCents: number;
        readonly contresignatures: ReadonlyArray<{
          readonly jour: string;
          readonly demiJournee: "matin" | "apres_midi" | "journee";
        }>;
      };
    }
  /** L'état d'une pièce tel que l'espace et la console l'affichent (`etatPiece`). */
  | {
      readonly etape: "etat-piece";
      readonly trainerId: string;
      readonly type: "attestation_vigilance_urssaf" | "assurance_rc_pro" | "cv";
      readonly maintenant: string;
    }
  /**
   * Le RENDU d'un e-mail formateur (`apercu` d'envois.ts, celui de l'écran des gabarits)
   * pour les valeurs d'un job réellement enfilé : ce que le worker enverrait, lu sans
   * dépendre de son bridage.
   */
  | {
      readonly etape: "apercu";
      readonly gabarit: string;
      readonly destinataire: string;
      readonly payload: Record<string, unknown>;
    }
  /** Un IBAN chiffré et son empreinte, par les fonctions du dépôt (pour semer une fiche). */
  | { readonly etape: "chiffrer-iban"; readonly trainerId: string; readonly iban: string }
  /** Les empreintes attendues des textes à valider (`empreinteAttendue`). */
  | { readonly etape: "empreintes-textes"; readonly cles: readonly string[] };

export interface EntreeArgent {
  readonly etapes: readonly EtapeArgent[];
}

/** Ce que l'exécuteur rend : un résultat par étape, dans l'ordre. */
export type SortieArgent = readonly unknown[];
