/**
 * Mention « contenu généré par IA » (AI Act, art. 50) — libellés exacts du plan
 * PLAN-W1-W4 §6.4 (décision D11). Pure. Affichée VISIBLEMENT avant la lecture et
 * reprise en suffixe de la description JSON-LD ; `null` si ni la voix ni le
 * présentateur ne sont générés.
 */
export interface DrapeauxIa {
  readonly iaVoixGeneree: boolean;
  readonly iaDoubleNumerique: boolean;
}

export function mentionIa({ iaVoixGeneree, iaDoubleNumerique }: DrapeauxIa): string | null {
  if (iaVoixGeneree && iaDoubleNumerique) {
    return "Vidéo réalisée avec un présentateur et une voix générés par IA.";
  }
  if (iaDoubleNumerique) return "Présentateur numérique généré par IA.";
  if (iaVoixGeneree) return "Voix de synthèse générée par IA.";
  return null;
}
