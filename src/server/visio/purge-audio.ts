/**
 * ÉTAPE `purger_audio` — le SON est supprimé de R2 (décision B1 ; ADR 0056).
 *
 * Quand :
 *   · à la VALIDATION du compte rendu par Will ;
 *   · au plus tard `audioAPurgerAvant` = fin de l'enregistrement + 30 jours
 *     (le balayage programme la purge à l'échéance, et ALERTE si un son la
 *     dépasse) ;
 *   · TOUT DE SUITE sur un refus, un retrait, un accord non confirmé, ou un
 *     rendez-vous qui n'en était pas un.
 *
 * `audioSupprimeLe` n'est posé qu'APRÈS vérification : chaque objet est
 * supprimé, puis on vérifie qu'il n'existe plus (`existsInR2` = faux). Un
 * objet qui résiste laisse l'étape en échec (passagère) : elle reprend, et le
 * balayage alerte si l'échéance passe.
 */

import type { Gestionnaire } from "./etapes";
import { ErreurVisio } from "./openai/erreurs";

/** L'audio d'un enregistrement doit-il être purgé maintenant ? Fonction PURE. */
export function audioAPurgerMaintenant(e: {
  readonly statut: string;
  readonly audioSupprimeLe: Date | null;
  readonly audioAPurgerAvant: Date | null;
  readonly compteRenduValide: boolean;
  readonly maintenant: Date;
}): boolean {
  if (e.audioSupprimeLe !== null) return false;
  if (["refuse", "accord_non_confirme", "abandonne", "valide"].includes(e.statut)) return true;
  if (e.compteRenduValide) return true;
  return e.audioAPurgerAvant !== null && e.audioAPurgerAvant.getTime() <= e.maintenant.getTime();
}

/** Délai de grâce avant l'alerte « audio non purgé » après l'échéance. */
export const GRACE_ALERTE_AUDIO_MS = 3600_000;

export function audioEnRetard(e: {
  readonly audioSupprimeLe: Date | null;
  readonly audioAPurgerAvant: Date | null;
  readonly maintenant: Date;
}): boolean {
  return (
    e.audioSupprimeLe === null &&
    e.audioAPurgerAvant !== null &&
    e.maintenant.getTime() - e.audioAPurgerAvant.getTime() > GRACE_ALERTE_AUDIO_MS
  );
}

export const purgerAudio: Gestionnaire = async (ctx) => {
  const { deps, t } = ctx;
  const maintenant = deps.maintenant();
  // B1 : enregistrement PAR enregistrement. Valider le compte rendu d'une
  // rencontre ne purge pas le son d'une relance encore à transcrire.
  const aPurger = (await deps.donnees.audiosAPurger(t.rencontreId)).filter((a) =>
    audioAPurgerMaintenant({ ...a, audioSupprimeLe: null, maintenant }),
  );
  if (aPurger.length === 0) return { ecrire: async () => [] };
  for (const a of aPurger) {
    for (const cle of a.cles) {
      await deps.donnees.supprimerObjet(cle);
    }
    for (const cle of a.cles) {
      if (await deps.donnees.objetExiste(cle)) {
        throw new ErreurVisio(
          "passagere",
          "stockage_indisponible",
          "un objet audio résiste à la suppression",
        );
      }
    }
  }
  return {
    ecrire: async (tx) => {
      for (const a of aPurger) await deps.donnees.marquerAudioPurge(tx, a, maintenant);
      return [];
    },
  };
};
