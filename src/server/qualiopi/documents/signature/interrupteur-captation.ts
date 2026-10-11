/**
 * Lecture de l'interrupteur `signature.exemplaire_captation` (lot S6a).
 *
 * Module à part, SANS `server-only` : il est atteint par le worker (rattrapage
 * horaire → transmission → exemplaire), qui tourne sous `tsx`, hors de Next.
 * L'interprétation reste dans `interrupteurs.ts` ; l'écrivain est celui des
 * quatre autres (`formateurs-interrupteurs.ts`).
 */

import { prisma } from "@/lib/prisma";
import {
  cleSettingSignature,
  dateAllumageSignature,
} from "@/server/qualiopi/formateurs-independants/interrupteurs";

/**
 * Date d'allumage, ou `null` : clé absente, illisible, arrêtée ou lecture en
 * panne. `null` = comportement de `main` — le consentement ne se rend pas en
 * exemplaire (`type_non_rendu`), donc aucun e-mail. Ne lève jamais.
 */
export async function allumageExemplaireCaptation(): Promise<Date | null> {
  try {
    const ligne = await prisma.setting.findUnique({
      where: { key: cleSettingSignature("exemplaire_captation") },
      select: { value: true, updatedAt: true },
    });
    return ligne === null ? null : dateAllumageSignature(ligne.value, ligne.updatedAt);
  } catch {
    return null;
  }
}
