/**
 * Mot de passe de sécurité exigé pour ROUVRIR un dossier de session clos
 * (décision du dirigeant, 2026-09-30).
 *
 * 🔴 Le dépôt est PUBLIC : le mot de passe n'apparaît jamais dans le code. Seule
 * son empreinte scrypt salée vit dans la variable d'environnement
 * `QUALIOPI_REOUVERTURE_MDP`, au format `scrypt:<sel hex>:<empreinte hex>`
 * (générée par `pnpm tsx scripts/qualiopi/empreinte-mot-de-passe-reouverture.ts`).
 *
 * Fermé par défaut : sans variable (ou mal formée), AUCUNE réouverture n'est
 * possible — mieux vaut un dossier qu'on ne peut pas rouvrir qu'un dossier que
 * n'importe quel compte habilité rouvre sans le second facteur voulu.
 */

import { scryptSync, timingSafeEqual } from "node:crypto";

export const VARIABLE_MOT_DE_PASSE_REOUVERTURE = "QUALIOPI_REOUVERTURE_MDP";

/** Paramètres scrypt : ceux par défaut de Node, longueur 64 octets. */
const LONGUEUR = 64;

export type VerificationMotDePasse =
  { readonly ok: true } | { readonly ok: false; readonly raison: "non_configure" | "incorrect" };

/** Empreinte au format stocké — utilisée par le script de génération et les tests. */
export function empreinteMotDePasse(motDePasse: string, selHex: string): string {
  const empreinte = scryptSync(motDePasse, Buffer.from(selHex, "hex"), LONGUEUR);
  return `scrypt:${selHex}:${empreinte.toString("hex")}`;
}

export function verifierMotDePasseReouverture(
  motDePasse: string,
  stocke: string | undefined = process.env[VARIABLE_MOT_DE_PASSE_REOUVERTURE],
): VerificationMotDePasse {
  const valeur = (stocke ?? "").trim();
  const m = /^scrypt:([0-9a-f]{16,}):([0-9a-f]{128})$/i.exec(valeur);
  if (m === null) return { ok: false, raison: "non_configure" };
  const attendu = Buffer.from(m[2]!, "hex");
  const recu = scryptSync(motDePasse, Buffer.from(m[1]!, "hex"), LONGUEUR);
  return recu.length === attendu.length && timingSafeEqual(recu, attendu)
    ? { ok: true }
    : { ok: false, raison: "incorrect" };
}
