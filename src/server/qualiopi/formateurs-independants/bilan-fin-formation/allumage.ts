/**
 * Lot G2 — le jour (Paris) d'ALLUMAGE de `formateurs.bilan_fin_formation`, ou `null`.
 *
 * Lu par le paiement par mission, la relance et l'écran : l'exigence du bilan ne vaut que
 * pour une session finie le jour de l'allumage ou après (jamais rétroactive). Même lecture
 * que les autres interrupteurs « livrés éteints » (`dateAllumageSignature`).
 *
 * Module neutre (le worker le lit) ; le client est passé par l'appelant. Ne lève jamais :
 * une lecture en échec vaut « éteint », c'est-à-dire le comportement d'avant le lot.
 */

import { jourParis, type JourCivil } from "../argent/dates";
import { cleSettingSignature, dateAllumageSignature } from "../interrupteurs";

export interface ClientAllumage {
  readonly setting: {
    findUnique(args: {
      where: { key: string };
      select: { value: true; updatedAt: true };
    }): PromiseLike<{ value: unknown; updatedAt: Date | null } | null>;
  };
}

export async function lireAllumageBilan(client: ClientAllumage): Promise<JourCivil | null> {
  try {
    const ligne = await client.setting.findUnique({
      where: { key: cleSettingSignature("bilan_fin_formation") },
      select: { value: true, updatedAt: true },
    });
    if (ligne == null) return null;
    const d = dateAllumageSignature(ligne.value, ligne.updatedAt ?? null);
    return d === null ? null : jourParis(d);
  } catch {
    return null;
  }
}
