import "server-only";

/**
 * Lecture des interrupteurs formateurs pour l'écran console (lot S0-ter).
 *
 * Seul lecteur en base des clés `formateurs.*` ; l'interprétation reste dans
 * `interrupteurs.ts`.
 */

import { prisma } from "@/lib/prisma";

import {
  CLES_INTERRUPTEURS,
  CLES_INTERRUPTEURS_SIGNATURE,
  PREFIXE_CLES_FORMATEURS,
  cleSetting,
  cleSettingSignature,
  etatsDepuisLignes,
  etatsSignatureDepuisLignes,
  etatsSignatureParDefaut,
  lireValeur,
  lireValeurSignature,
  type CleInterrupteur,
  type CleInterrupteurSignature,
  type EtatsInterrupteurs,
  type EtatsInterrupteursSignature,
} from "./interrupteurs";

export interface LigneInterrupteur {
  readonly cle: CleInterrupteur;
  readonly valeur: boolean | string | null;
  /** Faux si la ligne manque ou ne se lit pas : la position sûre s'applique. */
  readonly lisible: boolean;
  readonly misAJourLe: Date | null;
  readonly misAJourPar: string | null;
}

async function nomsAuteurs(
  brutes: ReadonlyArray<{ updatedBy: string | null }>,
): Promise<Map<string, string>> {
  const auteurs = [...new Set(brutes.map((b) => b.updatedBy).filter((x): x is string => !!x))];
  return new Map(
    (auteurs.length
      ? await prisma.adminUser.findMany({
          where: { id: { in: auteurs } },
          select: { id: true, name: true },
        })
      : []
    ).map((u) => [u.id, u.name]),
  );
}

export async function lireInterrupteurs(): Promise<{
  etats: EtatsInterrupteurs;
  lignes: ReadonlyArray<LigneInterrupteur>;
}> {
  const brutes = await prisma.setting.findMany({
    where: { key: { startsWith: PREFIXE_CLES_FORMATEURS } },
    select: { key: true, value: true, updatedAt: true, updatedBy: true },
  });
  const noms = await nomsAuteurs(brutes);
  const parCle = new Map(brutes.map((b) => [b.key, b]));
  const lignes = CLES_INTERRUPTEURS.map((cle): LigneInterrupteur => {
    const brute = parCle.get(cleSetting(cle));
    const lu = lireValeur(cle, brute?.value);
    return {
      cle,
      valeur: lu.valeur,
      lisible: lu.lisible,
      misAJourLe: brute?.updatedAt ?? null,
      misAJourPar: brute?.updatedBy ? (noms.get(brute.updatedBy) ?? null) : null,
    };
  });
  return { etats: etatsDepuisLignes(brutes), lignes };
}

// ─── Socle de signature (S6a) ────────────────────────────────────────────────

const CLES_SETTINGS_SIGNATURE = CLES_INTERRUPTEURS_SIGNATURE.map(cleSettingSignature);

/**
 * Les interrupteurs du socle de signature, pour l'après-signature.
 *
 * 🔴 Ne lève JAMAIS : une lecture en échec vaut « tout arrêté », c'est-à-dire
 * le comportement d'avant S6a — jamais un envoi neuf par accident.
 */
export async function lireEtatsSignature(): Promise<EtatsInterrupteursSignature> {
  try {
    const lignes = await prisma.setting.findMany({
      where: { key: { in: CLES_SETTINGS_SIGNATURE } },
      select: { key: true, value: true },
    });
    return etatsSignatureDepuisLignes(lignes);
  } catch {
    return etatsSignatureParDefaut();
  }
}

export interface LigneInterrupteurSignature {
  readonly cle: CleInterrupteurSignature;
  readonly valeur: boolean;
  readonly lisible: boolean;
  readonly misAJourLe: Date | null;
  readonly misAJourPar: string | null;
}

/** Pour l'écran console. */
export async function lireInterrupteursSignature(): Promise<
  ReadonlyArray<LigneInterrupteurSignature>
> {
  const brutes = await prisma.setting.findMany({
    where: { key: { in: CLES_SETTINGS_SIGNATURE } },
    select: { key: true, value: true, updatedAt: true, updatedBy: true },
  });
  const noms = await nomsAuteurs(brutes);
  const parCle = new Map(brutes.map((b) => [b.key, b]));
  return CLES_INTERRUPTEURS_SIGNATURE.map((cle): LigneInterrupteurSignature => {
    const brute = parCle.get(cleSettingSignature(cle));
    const lu = lireValeurSignature(brute?.value);
    return {
      cle,
      valeur: lu.valeur,
      lisible: lu.lisible,
      misAJourLe: brute?.updatedAt ?? null,
      misAJourPar: brute?.updatedBy ? (noms.get(brute.updatedBy) ?? null) : null,
    };
  });
}
