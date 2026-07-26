/**
 * Politique de validation des emails avant envoi (audit certification 2026-07-26).
 *
 * ## Pourquoi cette couche existe
 *
 * Will veut relire les emails commerciaux avant qu'ils ne partent — une relance
 * d'impayé mal calibrée coûte un client. Mais retenir TOUS les emails aurait un
 * effet de bord grave : la chaîne Qualiopi est automatique par conception
 * (convocation, rappel J-7, satisfaction J+1, suivi J+30, attestation). La
 * suspendre à une validation humaine expose un stagiaire à ne jamais recevoir sa
 * convocation — et les indicateurs 4, 9, 11, 30 et 32 reposent dessus.
 *
 * D'où la règle par défaut : **commercial → validation, Qualiopi → automatique**,
 * modifiable dans les deux sens, globalement ou par client.
 *
 * Logique PURE — aucun accès Prisma ici. La résolution en base vit dans
 * `outbox-service.ts`, ce qui rend cette politique testable sans infrastructure.
 */

/**
 * Emails soumis à validation par défaut : ceux qui engagent la relation
 * commerciale ou l'argent.
 *
 * ⚠️ Liste volontairement EXPLICITE plutôt qu'un motif sur le nom. Un template
 * ajouté demain doit être classé sciemment : le défaut silencieux serait soit de
 * bloquer une convocation, soit de laisser partir une relance non relue.
 */
export const EMAILS_A_VALIDER_PAR_DEFAUT: readonly string[] = [
  "qualiopi-relance-impayee",
  "devis-envoye",
  "facture-envoyee",
  "contract-sent",
  "contract-reminder",
] as const;

/**
 * Emails qui partent TOUJOURS seuls par défaut, parce qu'un retard leur retire
 * leur raison d'être ou casse une obligation Qualiopi.
 */
export const EMAILS_AUTOMATIQUES_PAR_DEFAUT: readonly string[] = [
  "qualiopi-convocation",
  "qualiopi-rappel-j7",
  "qualiopi-satisfaction-j1",
  "qualiopi-suivi-j30",
  "qualiopi-attestation-disponible",
  "qualiopi-portail-acces",
  "qualiopi-alerte-interne",
] as const;

export type ModeEnvoi = "auto" | "validation";

/** Règle telle que lue en base, réduite à ce qui sert à la résolution. */
export interface RegleAutomatisation {
  scope: "global" | "client";
  /** `null` = la règle vaut pour toutes les natures d'email de cette portée. */
  template: string | null;
  mode: ModeEnvoi;
}

/**
 * Mode d'envoi retenu pour un email donné.
 *
 * Résolution du PLUS SPÉCIFIQUE au plus général :
 *   1. client + template exact
 *   2. client + tous templates
 *   3. global + template exact
 *   4. global + tous templates
 *   5. défaut par nature d'email
 *
 * `regles` ne doit contenir que des règles applicables au destinataire : c'est
 * à l'appelant de filtrer sur le bon `clientId`. Mélanger les clients ici
 * produirait une résolution silencieusement fausse.
 */
export function resoudreModeEnvoi(
  template: string,
  regles: readonly RegleAutomatisation[],
): ModeEnvoi {
  const trouve = (scope: "global" | "client", exact: boolean): ModeEnvoi | null => {
    const r = regles.find(
      (x) => x.scope === scope && (exact ? x.template === template : x.template === null),
    );
    return r ? r.mode : null;
  };

  return (
    trouve("client", true) ??
    trouve("client", false) ??
    trouve("global", true) ??
    trouve("global", false) ??
    modeParDefaut(template)
  );
}

/**
 * Mode retenu quand aucune règle ne s'applique.
 *
 * Un template inconnu des deux listes part en `auto` : c'est le comportement
 * historique, et le préserver évite qu'un email transactionnel existant se
 * retrouve bloqué sans que personne ne l'ait décidé.
 */
export function modeParDefaut(template: string): ModeEnvoi {
  if (EMAILS_A_VALIDER_PAR_DEFAUT.includes(template)) return "validation";
  return "auto";
}

/** Vrai si ce template relève de la chaîne Qualiopi automatique. */
export function estEmailQualiopiAutomatique(template: string): boolean {
  return EMAILS_AUTOMATIQUES_PAR_DEFAUT.includes(template);
}
