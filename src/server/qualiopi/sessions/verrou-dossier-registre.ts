/**
 * 🔴 ADR 0060 — REGISTRE EXÉCUTABLE des écritures sur un dossier de session.
 *
 * Chaque Server Action qui touche une session, ses inscriptions, ses présences,
 * ses émargements, ses évaluations, ses questionnaires ou ses pièces y est
 * CLASSÉE :
 *
 *   - `verrou`   — refusée sur un dossier `clos` (garde `assertDossierOuvert`),
 *                  possible sur un dossier `rouvert` ;
 *   - `ouverte`  — reste possible sur un dossier clos : lecture, suivi
 *                  financier, relances, RGPD, contreseings restants… ;
 *   - `entrante` — ce qui ARRIVE de l'extérieur (le stagiaire, le formateur,
 *                  l'entreprise répondent ou signent) : jamais bloqué par le
 *                  verrou, le jeton expire seul.
 *
 * Trois tests lisent ce registre, et c'est ce qui le rend vrai :
 *   - `ecritures-refusees-dossier-clos.spec.ts` appelle CHAQUE action `verrou`
 *     sur un dossier clos et vérifie le refus SANS aucune écriture Prisma, puis
 *     sur un dossier rouvert et vérifie qu'elle passe la garde ;
 *   - le même fichier vérifie qu'aucune action `ouverte`/`entrante` n'appelle
 *     la garde inconditionnellement ;
 *   - `registre-ecritures-exhaustif.spec.ts` analyse les modules `"use server"`
 *     et rougit si une action exportée écrit sur ces tables sans figurer ici.
 *
 * ⚠️ Ajouter une action qui écrit sur un dossier de session = la classer ici,
 * avec sa raison. Une action non classée fait rougir la CI.
 */

export type DecisionEcriture = "verrou" | "ouverte" | "entrante";

export interface EcritureSession {
  /** Nom exact de l'export. */
  readonly action: string;
  /** Chemin relatif à `src/server/actions/qualiopi/`. */
  readonly fichier: string;
  readonly decision: DecisionEcriture;
  /** Pourquoi cette décision, en une phrase lisible par un auditeur. */
  readonly raison: string;
  /**
   * Pour une écriture `verrou` CONDITIONNELLE : la condition sous laquelle la
   * garde s'applique (le reste du temps, l'action reste ouverte).
   */
  readonly condition?: string;
}

const V = "verrou" as const;
const O = "ouverte" as const;
const E = "entrante" as const;

export const ECRITURES_SESSION: ReadonlyArray<EcritureSession> = [
  // ── La session elle-même ───────────────────────────────────────────────────
  {
    action: "setSessionLieuAction",
    fichier: "sessions.ts",
    decision: V,
    raison: "Le lieu et la modalité figurent sur les pièces émises.",
  },
  {
    action: "setSessionDatesAction",
    fichier: "sessions.ts",
    decision: V,
    raison: "Les dates fondent l'émargement, l'attestation et le certificat.",
  },
  {
    action: "setSessionMontantAction",
    fichier: "sessions.ts",
    decision: V,
    raison: "Le montant contractuel est figé ; on corrige par avoir ou facture.",
  },
  {
    action: "saveSessionJoursAction",
    fichier: "session-jours.ts",
    decision: V,
    raison: "Les journées déclarées fondent la feuille d'émargement.",
  },
  {
    action: "setSessionInterEntreprisesAction",
    fichier: "inter-entreprises.ts",
    decision: V,
    raison: "Le caractère inter-entreprises change les pièces contractuelles.",
  },
  {
    action: "setEnrollmentFinancementAction",
    fichier: "inter-entreprises.ts",
    decision: V,
    raison: "Le payeur d'un participant est contractuel.",
  },
  {
    action: "setFinancementSessionAction",
    fichier: "financements.ts",
    decision: V,
    raison: "Le type, le dispositif et le payeur sont contractuels.",
    condition:
      "seulement si le payload change le type de financement, le dispositif France Travail ou le payeur du reste à charge CPF ; statut OPCO, n° de dossier et subrogation restent ouverts",
  },
  {
    action: "reportSessionAction",
    fichier: "sessions-recurrentes.ts",
    decision: V,
    raison: "Reporter une session close réécrirait l'historique de réalisation.",
  },
  {
    action: "createSessionAction",
    fichier: "sessions.ts",
    decision: O,
    raison: "Crée une session NEUVE : aucun dossier clos n'est touché.",
  },
  {
    action: "createRecurringSessionsAction",
    fichier: "sessions-recurrentes.ts",
    decision: O,
    raison: "Crée des sessions NEUVES : aucun dossier clos n'est touché.",
  },
  {
    action: "transitionSessionAction",
    fichier: "sessions.ts",
    decision: O,
    raison:
      "La machine à états interdit toute transition depuis « réalisée » : sans effet sur un dossier clos.",
  },

  // ── Formateur ─────────────────────────────────────────────────────────────
  {
    action: "assignTrainerToSessionAction",
    fichier: "trainers.ts",
    decision: V,
    raison: "Qui a animé est une preuve (ind. 21/22) : assigner ou retirer est figé.",
  },
  {
    action: "declarerAbsenceFormateurAction",
    fichier: "mission-formateur.ts",
    decision: V,
    raison: "Une absence déclarée après clôture réécrirait le déroulé.",
  },
  {
    action: "consignerAccordHorsOutilAction",
    fichier: "mission-formateur.ts",
    decision: V,
    raison: "L'accord du formateur fait partie du dossier de réalisation.",
  },

  // ── Inscriptions ──────────────────────────────────────────────────────────
  {
    action: "enrollTraineeAction",
    fichier: "enrollments.ts",
    decision: V,
    raison: "Inscrire un stagiaire à une session close fabriquerait un participant sans preuve.",
  },
  {
    action: "setEnrollmentStatutAction",
    fichier: "enrollments.ts",
    decision: V,
    raison: "Le statut (présent, abandon, exclu) fonde l'attestation et le taux d'abandon.",
  },
  {
    action: "setEnrollmentAdaptationsAction",
    fichier: "enrollments.ts",
    decision: V,
    raison: "La réponse aux besoins d'adaptation est une preuve de l'indicateur 10.",
  },
  {
    action: "updateEnrollmentPresenceAction",
    fichier: "enrollments.ts",
    decision: V,
    raison: "Le taux de présence fonde l'attestation et le certificat.",
  },

  // ── Présences et émargement ───────────────────────────────────────────────
  {
    action: "saveEmargementAction",
    fichier: "presence.ts",
    decision: V,
    raison: "La grille d'émargement manuelle réécrirait la présence.",
  },
  {
    action: "setPresenceCreneauManualAction",
    fichier: "presence.ts",
    decision: V,
    raison: "Une présence déclarée à la main après clôture n'est plus une preuve.",
  },
  {
    action: "generateSessionCreneauxAction",
    fichier: "presence.ts",
    decision: V,
    raison: "Les créneaux portent les signatures.",
  },
  {
    action: "importReleveConnexionAction",
    fichier: "presence.ts",
    decision: V,
    raison: "Un relevé importé après clôture réécrirait l'assiduité à distance.",
  },
  {
    action: "genererReleveConnexionDocumentAction",
    fichier: "presence.ts",
    decision: V,
    raison: "Régénérer la pièce du relevé modifie une preuve.",
  },
  {
    action: "emettreLiensSessionAction",
    fichier: "emargement-liens.ts",
    decision: V,
    raison: "Un nouveau lien d'émargement rouvrirait le recueil des signatures.",
  },
  {
    action: "envoyerLiensEmargementAction",
    fichier: "emargement-liens.ts",
    decision: V,
    raison: "Envoyer des liens d'émargement rouvrirait le recueil des signatures.",
  },
  {
    action: "revoquerLiensSessionAction",
    fichier: "emargement-liens.ts",
    decision: O,
    raison: "Révoquer un lien ferme une porte : jamais dangereux pour la preuve.",
  },
  {
    action: "revoquerSignatureEmargementAction",
    fichier: "emargement-revocation.ts",
    decision: V,
    raison: "Révoquer une signature modifie la preuve de présence.",
  },
  {
    action: "revoquerSignatureEmargementFormAction",
    fichier: "emargement-revocation.ts",
    decision: V,
    raison: "Enveloppe de formulaire de la révocation : même garde, par délégation.",
  },
  {
    action: "signerPourStagiaireAction",
    fichier: "emargement-formateur.ts",
    decision: V,
    raison: "Signer à la place du stagiaire après clôture réécrirait la preuve.",
  },
  {
    action: "contresignerDemiJourneeAction",
    fichier: "emargement-formateur.ts",
    decision: E,
    raison: "Contreseing restant du formateur : il ajoute de la preuve.",
  },
  {
    action: "signerDepuisPortailAction",
    fichier: "emargement-public.ts",
    decision: E,
    raison: "Le stagiaire signe lui-même ; son jeton expire seul (fin + 48 h).",
  },
  {
    action: "signerReleveFormateurAction",
    fichier: "releve-signature.ts",
    decision: E,
    raison: "Le formateur signe son relevé : il ajoute de la preuve.",
  },
  {
    action: "viserReleveResponsablePedagogiqueAction",
    fichier: "releve-signature.ts",
    decision: O,
    raison: "Visa restant du responsable pédagogique : il ajoute de la preuve.",
  },

  // ── Évaluations et questionnaires ─────────────────────────────────────────
  {
    action: "createEvaluationAcquisAction",
    fichier: "evaluations.ts",
    decision: V,
    raison: "Une évaluation ajoutée après l'attestation contredirait la pièce émise.",
  },
  {
    action: "genererAttestationAction",
    fichier: "evaluations.ts",
    decision: V,
    raison: "Régénérer une attestation émise est une rectification.",
    condition:
      "seulement quand elle RÉGÉNÈRE (force ou motif de rectification) ; la première émission et le renvoi restent ouverts (L.6353-1)",
  },
  {
    action: "saisirReponsesQuestionnaireAction",
    fichier: "satisfaction.ts",
    decision: V,
    raison:
      "Après réalisation, seul le stagiaire répond (ind. 30) ; refusée aussi à l'état « à recueillir ».",
  },
  {
    action: "genererQuestionnairesSessionAction",
    fichier: "satisfaction.ts",
    decision: V,
    raison: "Créer des questionnaires après clôture modifierait le dossier.",
  },
  {
    action: "recomputeIndicateursAction",
    fichier: "satisfaction.ts",
    decision: O,
    raison: "Recalcul d'un cache : aucune preuve modifiée.",
  },
  {
    action: "envoyerQuestionnaireAction",
    fichier: "questionnaires.ts",
    decision: O,
    raison: "Solliciter le stagiaire (questionnaire à froid) reste dû (ind. 30).",
  },
  {
    action: "relancerQuestionnaireAction",
    fichier: "questionnaires.ts",
    decision: O,
    raison: "Relancer le stagiaire reste dû (ind. 30).",
  },
  {
    action: "soumettreSatisfactionPortailAction",
    fichier: "portail.ts",
    decision: E,
    raison: "Le stagiaire répond lui-même (origine « stagiaire »).",
  },
  {
    action: "soumettreEnqueteEntrepriseAction",
    fichier: "enquete-public.ts",
    decision: E,
    raison: "L'entreprise répond elle-même, par son lien.",
  },
  {
    action: "declarerBesoinAmenagementAction",
    fichier: "portail.ts",
    decision: E,
    raison: "Une déclaration du stagiaire ne se refuse jamais (ind. 26).",
  },
  {
    action: "declarerHandicapAction",
    fichier: "portail.ts",
    decision: E,
    raison: "Une déclaration du stagiaire ne se refuse jamais (ind. 26).",
  },

  // ── Pièces ────────────────────────────────────────────────────────────────
  {
    action: "genererConventionAction",
    fichier: "documents.ts",
    decision: V,
    raison: "Régénérer la convention modifie une pièce contractuelle.",
  },
  {
    action: "genererConventionTripartiteAction",
    fichier: "documents.ts",
    decision: V,
    raison: "Régénérer la convention tripartite modifie une pièce contractuelle.",
  },
  {
    action: "genererContratFormationAction",
    fichier: "documents.ts",
    decision: V,
    raison: "Régénérer le contrat modifie une pièce contractuelle.",
  },
  {
    action: "genererConvocationAction",
    fichier: "documents.ts",
    decision: V,
    raison: "Une convocation émise après clôture serait antidatée de fait.",
  },
  {
    action: "genererEmargementAction",
    fichier: "documents.ts",
    decision: V,
    raison: "La feuille d'émargement du registre est une preuve figée.",
  },
  {
    action: "genererPositionnementAction",
    fichier: "documents.ts",
    decision: V,
    raison: "Pièce du dossier de réalisation.",
  },
  {
    action: "genererGrilleEvaluationAction",
    fichier: "documents.ts",
    decision: V,
    raison: "Pièce du dossier de réalisation.",
  },
  {
    action: "genererSatisfactionAction",
    fichier: "documents.ts",
    decision: V,
    raison: "Pièce du dossier de réalisation.",
  },
  {
    action: "genererLettreMissionAction",
    fichier: "documents.ts",
    decision: V,
    raison: "La lettre de mission du formateur est contractuelle.",
  },
  {
    action: "genererReglementInterieurAction",
    fichier: "documents.ts",
    decision: V,
    raison: "Pièce remise au stagiaire : figée.",
  },
  {
    action: "genererProgrammeAction",
    fichier: "documents.ts",
    decision: V,
    raison: "Le programme remis est une pièce contractuelle.",
  },
  {
    action: "genererOrganisationActionAction",
    fichier: "documents.ts",
    decision: V,
    raison: "Pièce du dossier de réalisation.",
  },
  {
    action: "genererLivretAccueilAction",
    fichier: "documents.ts",
    decision: V,
    raison: "Pièce remise au stagiaire : figée.",
  },
  {
    action: "genererAutorisationCaptationAction",
    fichier: "documents.ts",
    decision: V,
    raison: "Pièce signée par le stagiaire : figée.",
  },
  {
    action: "genererCertificatRealisationAction",
    fichier: "documents.ts",
    decision: V,
    raison: "Régénérer le certificat modifie la pièce du financeur.",
    condition:
      "seulement quand une pièce vivante existe déjà (régénération) ; la première émission reste ouverte",
  },
  {
    action: "genererKitOpcoAction",
    fichier: "documents.ts",
    decision: V,
    raison: "Régénérer le kit modifie la pièce déposée.",
    condition: "seulement en régénération d'une pièce vivante",
  },
  {
    action: "genererKitCpfAction",
    fichier: "documents.ts",
    decision: V,
    raison: "Régénérer le kit modifie la pièce déposée.",
    condition: "seulement en régénération d'une pièce vivante",
  },
  {
    action: "genererKitFranceTravailAction",
    fichier: "documents.ts",
    decision: V,
    raison: "Régénérer le kit modifie la pièce déposée.",
    condition: "seulement en régénération d'une pièce vivante",
  },
  {
    action: "annulerDocumentAction",
    fichier: "documents.ts",
    decision: V,
    raison:
      "Annuler une pièce d'un dossier clos retire une preuve (et une pièce signée exige « revoquer_signature »).",
  },
  {
    action: "revoquerSignatureAction",
    fichier: "signature-revocation.ts",
    decision: V,
    raison: "Révoquer la signature d'une pièce retire une preuve.",
  },
  {
    action: "relancerRemiseExemplaireAction",
    fichier: "documents.ts",
    decision: O,
    raison: "Remettre l'exemplaire signé est un droit du signataire.",
  },
  {
    action: "contresignerPieceAction",
    fichier: "piece-signature.ts",
    decision: O,
    raison:
      "Contreseing restant de l'organisme : il ajoute de la preuve (refusé par le service si rien n'est attendu).",
  },
  {
    action: "emettreLienSignatureAction",
    fichier: "piece-lien-signature.ts",
    decision: O,
    raison: "Lien vers une signature ENCORE attendue sur la pièce (le service refuse sinon).",
  },
  {
    action: "envoyerLienSignatureParEmailAction",
    fichier: "piece-lien-signature.ts",
    decision: O,
    raison: "Envoi d'un lien vers une signature encore attendue.",
  },
  {
    action: "revoquerLiensSignatureAction",
    fichier: "piece-lien-signature.ts",
    decision: O,
    raison: "Révoquer un lien ferme une porte.",
  },
  {
    action: "signerPieceParJetonAction",
    fichier: "piece-signature.ts",
    decision: E,
    raison: "Le signataire signe lui-même ; son jeton expire seul.",
  },
  {
    action: "contresignerLettreMissionAction",
    fichier: "lettre-mission-signature.ts",
    decision: O,
    raison: "Contreseing restant de l'organisme.",
  },
  {
    action: "signerLettreMissionFormateurAction",
    fichier: "lettre-mission-signature.ts",
    decision: E,
    raison: "Le formateur signe lui-même.",
  },
  {
    action: "genererSortiesAction",
    fichier: "kit-session.ts",
    decision: V,
    raison: "Les sorties du kit font partie du dossier de réalisation.",
  },
  {
    action: "validerSortiesAction",
    fichier: "kit-session.ts",
    decision: V,
    raison: "Valider les sorties après clôture modifierait le dossier.",
  },

  // ── Suivi financier ───────────────────────────────────────────────────────
  {
    action: "validerAccordOpcoAction",
    fichier: "financements.ts",
    decision: O,
    raison: "Suivi du financeur : l'accord arrive souvent après la session.",
  },
  {
    action: "setPriseEnChargeAction",
    fichier: "financements.ts",
    decision: O,
    raison: "Suivi du financeur.",
  },
  {
    action: "genererFactureFormationAction",
    fichier: "financements.ts",
    decision: O,
    raison: "La facturation suit la réalisation.",
  },
  {
    action: "setAcompteAction",
    fichier: "audit-missions.ts",
    decision: O,
    raison: "Suivi de l'acompte encaissé.",
  },
  {
    action: "genererFactureParInscriptionAction",
    fichier: "factures-inter.ts",
    decision: O,
    raison: "La facturation suit la réalisation.",
  },
  {
    action: "genererAvoirAction",
    fichier: "facturation-hub.ts",
    decision: O,
    raison: "Un avoir corrige un montant sans toucher la preuve de réalisation.",
  },
  {
    action: "enregistrerPaiementFactureAction",
    fichier: "facturation-hub.ts",
    decision: O,
    raison: "Suivi des encaissements.",
  },

  // ── Portail, RGPD, incidents ──────────────────────────────────────────────
  {
    action: "genererPortailAccesAction",
    fichier: "portail.ts",
    decision: O,
    raison: "Le stagiaire doit pouvoir répondre et télécharger ses pièces.",
  },
  {
    action: "revoquerPortailAccesAction",
    fichier: "portail.ts",
    decision: O,
    raison: "Révoquer un accès ferme une porte.",
  },
  {
    action: "demanderExportRgpdAction",
    fichier: "portail.ts",
    decision: E,
    raison: "Droit d'accès du stagiaire (art. 15) : jamais bloqué.",
  },
  {
    action: "demanderSuppressionRgpdAction",
    fichier: "portail.ts",
    decision: E,
    raison: "Droit à l'effacement (art. 17) : jamais bloqué ; les preuves sont conservées (§3 b).",
  },
  {
    action: "traiterDemandeRgpdAction",
    fichier: "appreciations.ts",
    decision: O,
    raison: "Le verrou ne bloque jamais une demande RGPD.",
  },
  {
    action: "updateTraineeAction",
    fichier: "trainees.ts",
    decision: O,
    raison: "Rectification RGPD (art. 16) de la fiche stagiaire.",
  },
  {
    action: "creerIncidentAction",
    fichier: "incidents.ts",
    decision: O,
    raison: "Consigner un incident ajoute de la traçabilité.",
  },
  {
    action: "updateIncidentAction",
    fichier: "incidents.ts",
    decision: O,
    raison: "Le traitement d'un incident se poursuit après la session.",
  },
  {
    action: "supprimerIncidentAction",
    fichier: "incidents.ts",
    decision: V,
    raison: "Supprimer l'incident d'une session close effacerait une trace du dossier.",
    condition: "seulement si l'incident est rattaché à une session",
  },
  {
    action: "creerReclamationAction",
    fichier: "reclamations.ts",
    decision: O,
    raison: "Une réclamation se reçoit toujours (ind. 31).",
  },
  {
    action: "repondreReclamationAction",
    fichier: "reclamations.ts",
    decision: O,
    raison: "Répondre à une réclamation est dû (ind. 31).",
  },
  {
    action: "setStatutReclamationAction",
    fichier: "reclamations.ts",
    decision: O,
    raison: "Suivi de la réclamation.",
  },
];

/** Les actions d'une décision donnée. */
export function ecrituresDe(decision: DecisionEcriture): ReadonlyArray<EcritureSession> {
  return ECRITURES_SESSION.filter((e) => e.decision === decision);
}
