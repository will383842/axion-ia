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
/**
 * Création à partir de J+2 après la fin, pas dès la clôture (J+1) : une demi-journée
 * émargée en retard ou un relevé de connexion importé le lendemain recalcule le taux ;
 * un certificat déjà numéroté figerait des heures sous-déclarées (R.6313-3).
 */
export const DELAI_CERTIFICAT_AUTO_JOURS = 2;

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
 * ou `null` si l'interrupteur est éteint. LÈVE si la lecture échoue : l'alerte doit
 * compter comme règle en échec (sinon la résolution automatique refermerait toutes ses
 * alertes ouvertes sur un simple délai dépassé).
 */
export async function lireDebutCertificatAutoOuLever(
  client: ClientAllumageCertificat,
): Promise<Date | null> {
  const ligne = await client.setting.findUnique({
    where: { key: CLE_CERTIFICAT_AUTO },
    select: { value: true, updatedAt: true },
  });
  if (ligne == null) return null;
  const allume = dateAllumageSignature(ligne.value, ligne.updatedAt ?? null);
  return allume === null ? null : debutDuJourDeParis(jourParis(allume));
}

/** Même lecture pour l'émission : une lecture en échec vaut « éteint » (rien n'est créé). */
export async function lireDebutCertificatAuto(
  client: ClientAllumageCertificat,
): Promise<Date | null> {
  try {
    return await lireDebutCertificatAutoOuLever(client);
  } catch {
    return null;
  }
}
