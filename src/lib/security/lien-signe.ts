/**
 * Fabrique commune de LIENS SIGNÉS (FAC-4, 2026-10-10).
 *
 *     jeton           = base64url(HMAC-SHA256(clé, "<domaine>:v<version>:" + charge))
 *     jeton à échéance = <expireA> + "." + base64url(HMAC-SHA256(clé, "<domaine>:v<version>+exp:" + expireA + ":" + charge))
 *
 * - La clé est dérivée d'`AUTH_SECRET` avec séparation par `cle` :
 *   `sha256("<cle>|" + secret)`. Sans secret EN PRODUCTION, rien n'est signé ni
 *   valide (`null` / `false`) ; hors production, une clé de développement fixe.
 * - Le numéro de version fait partie du domaine : l'incrémenter révoque tout.
 * - Une échéance (secondes epoch) est facultative ; quand elle est présente elle est
 *   SIGNÉE, sous un préfixe distinct (`+exp:`), si bien qu'un jeton sans échéance
 *   ne peut pas passer pour un jeton à échéance, ni l'inverse.
 * - La vérification recalcule et compare à temps constant. Rien n'est stocké.
 *
 * Module serveur léger : `node:crypto` seulement — ni Prisma, ni `next/headers`.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export interface ConfigLienSigne {
  /** Nom du domaine de signature, sans `:` (ex. `apporteur-dossier`). */
  domaine: string;
  /** Version du domaine, entier ≥ 1. */
  version: number;
  /** Étiquette de dérivation de la clé (ex. `axion-apporteur-dossier`). */
  cle: string;
}

export interface FabriqueLienSigne {
  /** Le jeton de `charge`, ou `null` (pas de secret en production, échéance invalide). */
  signer(charge: string, options?: { expireA?: number }): string | null;
  /** Le jeton est-il celui de `charge`, non expiré ? Temps constant sur la signature. */
  verifier(charge: string, jeton: string, options?: { maintenant?: number }): boolean;
}

const MAC = /^[A-Za-z0-9_-]{43}$/;
const A_ECHEANCE = /^(\d{1,15})\.([A-Za-z0-9_-]{43})$/;

export function fabriqueLienSigne(config: ConfigLienSigne): FabriqueLienSigne {
  const { domaine, version, cle } = config;
  if (!/^[a-z0-9-]+$/.test(domaine) || !Number.isInteger(version) || version < 1) {
    throw new Error("fabriqueLienSigne : domaine ou version invalide.");
  }
  const prefixe = `${domaine}:v${version}:`;
  const prefixeEcheance = `${domaine}:v${version}+exp:`;

  function cleCourante(): Buffer | null {
    const secret = process.env["AUTH_SECRET"];
    if (secret && secret.length > 0) {
      return createHash("sha256").update(`${cle}|${secret}`).digest();
    }
    if (process.env.NODE_ENV === "production") return null;
    return createHash("sha256").update(`${cle}|dev`).digest();
  }

  function mac(k: Buffer, message: string): string {
    return createHmac("sha256", k).update(message).digest("base64url");
  }

  function egaux(attendu: string, recu: string): boolean {
    const a = Buffer.from(attendu, "utf8");
    const b = Buffer.from(recu, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  return {
    signer(charge, options) {
      const expireA = options?.expireA;
      if (expireA !== undefined && (!Number.isSafeInteger(expireA) || expireA < 0)) return null;
      const k = cleCourante();
      if (k === null) return null;
      if (expireA === undefined) return mac(k, `${prefixe}${charge}`);
      return `${expireA}.${mac(k, `${prefixeEcheance}${expireA}:${charge}`)}`;
    },

    verifier(charge, jeton, options) {
      const k = cleCourante();
      if (k === null) return false;
      if (MAC.test(jeton)) return egaux(mac(k, `${prefixe}${charge}`), jeton);
      const m = A_ECHEANCE.exec(jeton);
      if (m === null) return false;
      const expireA = Number(m[1]);
      const maintenant = options?.maintenant ?? Math.floor(Date.now() / 1000);
      const signatureOk = egaux(mac(k, `${prefixeEcheance}${expireA}:${charge}`), m[2]!);
      return signatureOk && maintenant < expireA;
    },
  };
}
