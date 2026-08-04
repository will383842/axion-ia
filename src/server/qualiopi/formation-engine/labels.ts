/**
 * Libellés des étapes de génération d'une formation — SOURCE UNIQUE.
 *
 * 🔴 CETTE TABLE EXISTAIT EN DOUBLE, et manquait là où ça comptait. Le tableau
 * de bord du moteur la déclarait pour lui seul ; la file de validation en avait
 * une copie ; et le retour des boutons Approuver / Rejeter n'en avait aucune —
 * il affichait « Approuvé — statut : contenu_valide. » Trois écrans reliés par
 * un clic, deux d'entre eux traduisant, le troisième non.
 *
 * Une étape inconnue est CITÉE, jamais maquillée.
 */
export const ETAPE_GENERATION_LABELS: Record<string, string> = {
  intention: "Intention",
  structure_generee: "Structure générée",
  contenu_evalue: "Contenu évalué",
  structure_validee: "Structure validée",
  contenu_genere: "Contenu généré",
  contenu_valide: "Contenu validé",
  assemble: "Assemblé",
  publie: "Publié",
  archive: "Archivé",
};

export function libelleEtapeGeneration(etape: string): string {
  return ETAPE_GENERATION_LABELS[etape] ?? `« ${etape} »`;
}
