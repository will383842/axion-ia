/**
 * Crochets du parcours formateur appelés APRÈS une signature (S6a, a).
 *
 * `apresSignature` est le seul endroit où une signature produit ses effets ;
 * les lots de la lettre de mission (ADR 0066 étape 10) s'y branchent ICI, et
 * nulle part ailleurs :
 *
 *   - `lettreDue` : une pièce engageante vient d'être intégralement signée.
 *     La lettre de mission du formateur devient due SI le formateur a aussi
 *     accepté la mission (les deux conditions de l'ADR) — c'est au lot de la
 *     lettre de le vérifier, pas à ce crochet de le présumer.
 *   - `reevaluerMission` : une lettre de mission a reçu une signature.
 *
 * ⚠️ Aujourd'hui sans effet : le modèle qui relie une mission à sa lettre
 * n'existe pas encore. Les points d'appel, eux, existent et sont testés : le
 * lot suivant n'aura pas à retrouver les six actions de signature.
 *
 * ⚠️ Un crochet ne lève jamais vers son appelant : `apresSignature` encapsule.
 */

export async function lettreDue(_documentGenereId: string): Promise<void> {
  // Point d'accroche du lot « lettre de mission » — volontairement vide.
}

export async function reevaluerMission(_documentGenereId: string): Promise<void> {
  // Point d'accroche du lot « lettre de mission » — volontairement vide.
}
