/**
 * Modèles d'IA autorisés pour le rapport avant audit (règle de Will : JAMAIS Haiku ; Opus pour
 * concevoir, critiquer et rédiger ; Sonnet pour exécuter les recherches).
 *
 * Liste blanche, pas liste noire : un nom de modèle inconnu est refusé, ce qui couvre aussi les
 * futures variantes « haiku ».
 */

export const MODELES_RAPPORT = {
  /** Chef d'orchestre, analyste croisé, critique, rédacteur. */
  reflexion: "claude-opus-5-5",
  /** Spécialistes de recherche et d'analyse par domaine. */
  execution: "claude-sonnet-5-5",
} as const;

const AUTORISES: ReadonlySet<string> = new Set(Object.values(MODELES_RAPPORT));

export class ModeleRefuse extends Error {
  constructor(modele: string) {
    super(`Modèle non autorisé pour le rapport avant audit : « ${modele} ».`);
    this.name = "ModeleRefuse";
  }
}

/** Lève `ModeleRefuse` si le modèle n'est pas dans la liste blanche. */
export function exigerModeleAutorise(modele: string): string {
  if (!AUTORISES.has(modele) || /haiku/i.test(modele)) throw new ModeleRefuse(modele);
  return modele;
}
