/**
 * Lot 8B — l'allumage de `formateurs.certificat_realisation_auto`, lu par l'émission
 * automatique du certificat (`certificat-auto.ts`) ET par son alerte
 * (`alertes/regle-certificat-realisation-manquant.ts`). Module léger : il ne charge
 * pas la chaîne de rendu des pièces, l'évaluateur d'alertes peut l'importer.
 */

import { debutDuJourDeParis } from "@/server/qualiopi/financements/condition-suspensive";
import { jourParis } from "@/server/qualiopi/formateurs-independants/argent/dates";
import {
  cleSettingSignature,
  dateAllumageSignature,
} from "@/server/qualiopi/formateurs-independants/interrupteurs";

export const CLE_CERTIFICAT_AUTO = cleSettingSignature("certificat_auto");
/** Au-delà, un refus de garde n'est plus retenté chaque matin, ni signalé. */
export const FENETRE_CERTIFICAT_AUTO_JOURS = 90;

export interface ClientAllumageCertificat {
  readonly setting: {
    findUnique(args: {
      where: { key: string };
      select: { value: true; updatedAt: true };
    }): PromiseLike<{ value: unknown; updatedAt: Date | null } | null>;
  };
}

/**
 * Le premier instant couvert : 00:00 (Paris) du jour d'allumage — jamais rétroactif —,
 * ou `null` si l'interrupteur est éteint. Une lecture en échec vaut « éteint ».
 */
export async function lireDebutCertificatAuto(
  client: ClientAllumageCertificat,
): Promise<Date | null> {
  try {
    const ligne = await client.setting.findUnique({
      where: { key: CLE_CERTIFICAT_AUTO },
      select: { value: true, updatedAt: true },
    });
    if (ligne == null) return null;
    const allume = dateAllumageSignature(ligne.value, ligne.updatedAt ?? null);
    return allume === null ? null : debutDuJourDeParis(jourParis(allume));
  } catch {
    return null;
  }
}
