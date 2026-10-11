/**
 * Lecture des interrupteurs de l'ENTRÉE des formateurs freelance (lot L0g),
 * pour les règles qui en dépendent.
 *
 * Module neutre (ni `server-only`, ni Next) : le worker l'atteint par la
 * réponse automatique aux candidatures. Aucune variable lue au chargement.
 */

import { prisma } from "@/lib/prisma";

import {
  CLES_INTERRUPTEURS_ENTREE,
  PREFIXE_CLES_FORMATEURS,
  etatsDepuisLignes,
  etatsParDefaut,
  type EtatsInterrupteurs,
  cleSettingEntree,
  cleSetting,
  lireValeur,
  lireValeurSignature,
  etatsEntreeDepuisLignes,
  etatsEntreeParDefaut,
  type EtatsInterrupteursEntree,
} from "./interrupteurs";

/**
 * 🔴 Ne lève JAMAIS : une lecture en échec vaut « tout arrêté », c'est-à-dire
 * le comportement d'avant le lot.
 */
export async function lireEtatsEntree(): Promise<EtatsInterrupteursEntree> {
  try {
    const lignes = await prisma.setting.findMany({
      where: { key: { in: CLES_INTERRUPTEURS_ENTREE.map(cleSettingEntree) } },
      select: { key: true, value: true },
    });
    return etatsEntreeDepuisLignes(Array.isArray(lignes) ? lignes : []);
  } catch {
    return etatsEntreeParDefaut();
  }
}

/**
 * Les états des seize, pour une règle qui en dépend (pas pour l'écran).
 *
 * 🔴 Ne lève JAMAIS : une lecture en échec vaut « position sûre partout ».
 */
export async function lireEtatsFormateurs(): Promise<EtatsInterrupteurs> {
  try {
    const lignes = await prisma.setting.findMany({
      where: { key: { startsWith: PREFIXE_CLES_FORMATEURS } },
      select: { key: true, value: true },
    });
    return etatsDepuisLignes(Array.isArray(lignes) ? lignes : []);
  } catch {
    return etatsParDefaut();
  }
}

/**
 * Lot L-INV — depuis quand l'invitation automatique est en service : la plus récente
 * écriture des deux réglages `invitation_auto` et `suivi_echange`, s'ils sont TOUS DEUX
 * allumés. Le balayage n'invite que ce qui arrive après ; le stock d'avant passe par le
 * rattrapage, avec aperçu.
 *
 * 🔴 Ne lève JAMAIS : illisible, absent ou coupé = `null` (rien ne part).
 */
export async function dateAllumageInvitationFormateurs(): Promise<Date | null> {
  try {
    const lignes = await prisma.setting.findMany({
      where: { key: { in: [cleSetting("invitation_auto"), cleSettingEntree("suivi_echange")] } },
      select: { key: true, value: true, updatedAt: true },
    });
    if (!Array.isArray(lignes) || lignes.length < 2) return null;
    const invitation = lignes.find((l) => l.key === cleSetting("invitation_auto"));
    const suivi = lignes.find((l) => l.key === cleSettingEntree("suivi_echange"));
    if (!invitation || !suivi) return null;
    if (!lireValeur("invitation_auto", invitation.value).valeur) return null;
    if (!lireValeurSignature(suivi.value).valeur) return null;
    return new Date(Math.max(invitation.updatedAt.getTime(), suivi.updatedAt.getTime()));
  } catch {
    return null;
  }
}
