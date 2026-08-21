/**
 * Le hachage des jetons porteurs — une seule fois, pour toutes les tables.
 *
 * ## Pourquoi ce module existe
 *
 * 🔴 `D4-4-A` (2026-08-19) a sorti `portail_acces.token` du clair. La fonction
 * de hachage est restée PRIVÉE dans `portail-service.ts`. Le lendemain,
 * `questionnaires.token` — la table voisine, le même genre de jeton — était
 * toujours en clair : le correctif avait traité une instance, pas la classe.
 *
 * ⚠️ Recopier `createHash("sha256")…` dans le second service aurait fabriqué la
 * situation exacte que cet audit rencontre depuis trois jours : deux définitions
 * d'un même prédicat, dont une finit par diverger. Et ici, diverger d'un
 * caractère — un `.slice(0, 32)`, un encodage, une casse — ne casse rien
 * visiblement : cela rend simplement TOUS les liens en circulation
 * silencieusement invalides.
 *
 * ## Le contrat, qui ne doit pas bouger
 *
 * SHA-256 de l'UTF-8 du jeton, hexadécimal minuscule, 64 caractères. C'est
 * exactement ce que produit `encode(sha256(token::bytea), 'hex')` en
 * PostgreSQL — les migrations de reprise en dépendent pour convertir les jetons
 * déjà émis sans couper les liens déjà envoyés.
 */

import { createHash } from "node:crypto";

/** SHA-256 hex (64 caractères) du jeton en clair. */
export function hacherToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
