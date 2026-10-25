/**
 * Le texte de BASE de l'e-mail d'invitation au questionnaire (réglage global, 2026-10-25).
 *
 * Rangé dans la table `settings` existante (clé ci-dessous) : aucune migration. Lu par la console
 * (aperçu et envoi), jamais par le worker : le texte voyage dans le payload du job, donc ce qui est
 * aperçu est ce qui part. Texte assaini à l'écriture ET au rendu. Rien n'est supprimé : « revenir au
 * texte d'origine » écrit des valeurs vides.
 */

import { prisma } from "@/lib/prisma";
import {
  CORPS_MAX,
  OBJET_PERSO_MAX,
  assainirLigne,
  fusionnerTexte,
  surchargeOuNull,
  CORPS_PAR_DEFAUT,
  type GabaritBase,
  type TextePayload,
  type TexteSaisi,
} from "@/lib/email/questionnaire-avant-audit-texte";

export const CLE_GABARIT_INVITATION = "questionnaire_avant_audit.gabarit_invitation";

const VIDE: GabaritBase = { objet: null, corps: null };

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/** Ne lève jamais : sans base, l'e-mail garde son texte d'origine. */
export async function lireGabaritBase(): Promise<GabaritBase> {
  if (estStub()) return VIDE;
  try {
    const ligne = await prisma.setting.findUnique({
      where: { key: CLE_GABARIT_INVITATION },
      select: { value: true },
    });
    const v = (ligne?.value ?? null) as { objet?: unknown; corps?: unknown } | null;
    return {
      objet: assainirLigne(v?.objet, OBJET_PERSO_MAX) || null,
      corps: surchargeOuNull(v?.corps, CORPS_PAR_DEFAUT),
    };
  } catch {
    return VIDE;
  }
}

/** Enregistre le texte de base (vide ou identique à l'origine = on retombe sur l'origine). */
export async function enregistrerGabaritBase(
  saisi: { objet: unknown; corps: unknown },
  userId: string,
): Promise<GabaritBase> {
  const base: GabaritBase = {
    objet: assainirLigne(saisi.objet, OBJET_PERSO_MAX) || null,
    corps: surchargeOuNull(saisi.corps, CORPS_PAR_DEFAUT, CORPS_MAX),
  };
  await prisma.setting.upsert({
    where: { key: CLE_GABARIT_INVITATION },
    create: {
      key: CLE_GABARIT_INVITATION,
      value: base,
      description:
        "Texte de base (objet et corps) de l'e-mail d'invitation au questionnaire avant audit.",
      updatedBy: userId,
    },
    update: { value: base, updatedBy: userId },
  });
  return base;
}

/** Le texte du payload pour une saisie du client : client > base > origine. */
export async function resoudreTexte(saisi: TexteSaisi): Promise<TextePayload> {
  return fusionnerTexte(await lireGabaritBase(), {
    objet: saisi.objet,
    message: saisi.message,
    corps: saisi.corps,
  });
}
