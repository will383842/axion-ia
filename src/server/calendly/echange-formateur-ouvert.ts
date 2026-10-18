import "server-only";

import { prisma } from "@/lib/prisma";
import {
  PREFIXE_CLES_FORMATEURS,
  lireValeur,
} from "@/server/qualiopi/formateurs-independants/interrupteurs";

/**
 * L'échange formateur de 15 minutes est-il ouvert à la réservation ?
 *
 * Lit `formateurs.echange_ouvert` avec la même interprétation que la console
 * (`lireValeur`). 🔴 Fail-closed : ligne absente, valeur illisible ou base en
 * erreur valent « fermé » — jamais un lien Calendly servi par accident.
 */
export async function echangeFormateurOuvert(): Promise<boolean> {
  try {
    const ligne = await prisma.setting.findUnique({
      where: { key: `${PREFIXE_CLES_FORMATEURS}echange_ouvert` },
      select: { value: true },
    });
    return lireValeur("echange_ouvert", ligne?.value).valeur === true;
  } catch {
    return false;
  }
}
