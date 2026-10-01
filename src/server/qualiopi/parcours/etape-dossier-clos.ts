/**
 * 🔴 ADR 0060 × L3 — le fil conducteur ne propose JAMAIS un geste verrouillé.
 *
 * ## Le défaut
 *
 * Sur un dossier CLOS, la fiche masque chaque écriture classée `verrou` (lot
 * L2). Mais la checklist « Où en est ce dossier », « Encore possible » du bloc
 * Clôture (aujourd'hui dans le bandeau du dossier) et « À traiter » continuaient de dire, pour une étape restée due —
 * évaluation finale, convocation, liens d'émargement… — « Aller à : … » et
 * « Manuel — bouton « Générer … » » : un geste que le serveur refuse et que
 * l'écran d'arrivée ne montre plus. On envoyait l'utilisateur chercher un
 * bouton qui n'existe pas.
 *
 * ## La règle
 *
 * Chaque étape déclare les Server Actions qui POSENT son geste depuis la
 * console ; leur décision se lit dans le REGISTRE du verrou
 * (`verrou-dossier-registre.ts`), jamais recopiée ici. Une étape reste
 * proposée sur un dossier clos seulement si AUCUNE de ses actions n'est
 * `verrou` — la règle la plus prudente : au pire, un geste encore possible
 * (envoyer un questionnaire déjà généré) n'est plus mis en avant, mais la
 * section reste atteignable par « Voir ».
 *
 * L'interrupteur de secours (`QUALIOPI_VERROU_DOSSIER=off`) est respecté par
 * l'appelant, qui passe `dossierFige(etat)` : verrou coupé, rien n'est masqué.
 *
 * Module PUR : aucun import d'E/S.
 */

import { ECRITURES_SESSION } from "../sessions/verrou-dossier-registre";
import type { EtapeCle, GesteDirect } from "./session-parcours";
import type { EtatEtape } from "./etat-echeance";

/**
 * Les Server Actions qui posent le geste de chaque étape depuis la console.
 * Chaque nom doit figurer au registre (test : `fil-conducteur-dossier-clos.spec.tsx`).
 */
export const ACTIONS_DU_GESTE: Readonly<Record<EtapeCle, ReadonlyArray<string>>> = {
  formateur_assigne: ["assignTrainerToSessionAction"],
  convention_generee: [
    "genererConventionAction",
    "genererConventionTripartiteAction",
    "genererContratFormationAction",
  ],
  convention_signee: ["emettreLienSignatureAction", "envoyerLienSignatureParEmailAction"],
  convention_contresignee: ["contresignerPieceAction"],
  positionnement_envoye: ["genererQuestionnairesSessionAction", "envoyerQuestionnaireAction"],
  positionnement_repondu: ["relancerQuestionnaireAction"],
  convocation_envoyee: ["genererConvocationAction"],
  creneaux_emargement: ["saveSessionJoursAction", "generateSessionCreneauxAction"],
  liens_signature_emis: ["emettreLiensSessionAction", "envoyerLiensEmargementAction"],
  // Le stagiaire signe par son jeton (entrant) — mais un dossier clos n'a, par
  // définition, plus AUCUN jeton valide (condition c) : seule la saisie à sa
  // place resterait, et elle est verrouillée.
  emargement_signe: ["signerPourStagiaireAction"],
  contresignature_formateur: ["contresignerDemiJourneeAction"],
  evaluation_finale: ["createEvaluationAcquisAction"],
  attestation: ["genererAttestationAction"],
  acces_portail: ["genererPortailAccesAction"],
  satisfaction_chaud: ["envoyerQuestionnaireAction", "relancerQuestionnaireAction"],
  satisfaction_froid: ["envoyerQuestionnaireAction", "relancerQuestionnaireAction"],
};

/** L'action appelée par chaque geste DIRECT de la checklist (`GesteEtape`). */
export const ACTION_DU_GESTE_DIRECT: Readonly<Record<GesteDirect["type"], string>> = {
  relancer_questionnaire: "relancerQuestionnaireAction",
  relancer_signature: "envoyerLienSignatureParEmailAction",
  generer_acces_portail: "genererPortailAccesAction",
};

/**
 * Une action inconnue du registre est traitée comme VERROUILLÉE : l'oubli
 * ferme, il n'ouvre jamais.
 */
function actionVerrouillee(action: string): boolean {
  const e = ECRITURES_SESSION.find((x) => x.action === action);
  return e === undefined || e.decision === "verrou";
}

/** L'étape peut-elle encore être faite sur un dossier clos ? */
export function etapePossibleSurDossierClos(cle: EtapeCle): boolean {
  return !ACTIONS_DU_GESTE[cle].some(actionVerrouillee);
}

/** Le geste direct peut-il encore être posé sur un dossier clos ? */
export function gesteDirectPossibleSurDossierClos(geste: GesteDirect): boolean {
  return !actionVerrouillee(ACTION_DU_GESTE_DIRECT[geste.type]);
}

/**
 * Vrai quand l'étape reste due MAIS que son geste est verrouillé : l'écran ne
 * doit alors ni la proposer (« Aller à »), ni en décrire le geste.
 *
 * @param fige `dossierFige(etat)` — faux quand l'interrupteur coupe le verrou.
 */
export function etapeBloqueeParLeVerrou(
  etape: { readonly cle: EtapeCle; readonly etat: EtatEtape },
  fige: boolean,
): boolean {
  if (!fige) return false;
  if (etape.etat === "fait" || etape.etat === "sans_objet") return false;
  return !etapePossibleSurDossierClos(etape.cle);
}

/** Ce que l'écran dit À LA PLACE du geste d'une étape bloquée. */
export const MENTION_GESTE_VERROUILLE =
  "Dossier clos : ce geste n'est plus possible sans rouvrir le dossier.";
