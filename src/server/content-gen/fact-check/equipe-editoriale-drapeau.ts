/**
 * Interrupteur de l'équipe éditoriale (vérificateur en deux phases). ÉTEINT par défaut :
 * seule la valeur exacte « true » l'allume (même style que les autres interrupteurs).
 * Module léger : aucune dépendance base, Redis ou BullMQ.
 */

export type EnvEquipeEditoriale = Readonly<Record<string, string | undefined>>;

export function equipeEditorialeActive(env: EnvEquipeEditoriale = process.env): boolean {
  return env["CONTENT_EQUIPE_EDITORIALE"] === "true";
}
