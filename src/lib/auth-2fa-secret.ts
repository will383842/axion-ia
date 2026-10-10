/**
 * Secret TOTP de la double authentification — chiffré au repos.
 *
 * Le secret est écrit avec `encryptPii` au format `enc:v2:`, l'AAD liant le
 * chiffré au compte (`admin_users:<id>:two_factor_secret`) : recopié sur une
 * autre ligne, il ne se déchiffre plus.
 *
 * Compatibilité : une valeur ancienne, non préfixée (`isEncryptedPii` faux),
 * est lue telle quelle. Après une vérification réussie, l'appelant reçoit la
 * forme chiffrée à réécrire (`aReecrire`) — migration douce, sans verrouiller
 * personne.
 *
 * Sans `PII_ENCRYPTION_KEY` (build stub, tests, développement), même conduite
 * que le reste du module : écriture en clair, et rien à réécrire.
 *
 * Longueur : un secret base32 de 32 caractères donne un chiffré de 129
 * caractères — la colonne `VarChar(255)` suffit.
 */

import { verify2FACode } from "./auth-2fa";
import { decryptPii, encryptPii, isEncryptedPii } from "./pii-crypto";

function aadSecret2FA(adminUserId: string): string {
  return `admin_users:${adminUserId}:two_factor_secret`;
}

/** Forme à stocker en base pour un secret TOTP en clair. */
export function chiffrerSecret2FA(adminUserId: string, secret: string): string {
  return encryptPii(secret, { aad: aadSecret2FA(adminUserId) });
}

export interface ResultatVerificationSecret2FA {
  readonly valide: boolean;
  /**
   * Valeur chiffrée à écrire en base quand le secret stocké était en clair et
   * que le code est valide ; `null` sinon.
   */
  readonly aReecrire: string | null;
}

/**
 * Vérifie un code TOTP contre le secret STOCKÉ (chiffré ou ancien clair).
 * Un chiffré illisible (altération, mauvaise ligne) est traité comme un code
 * refusé, jamais comme une exception remontée à l'appelant.
 */
export function verifierCode2FAStocke(
  adminUserId: string,
  code: string,
  stocke: string,
): ResultatVerificationSecret2FA {
  const enClair = !isEncryptedPii(stocke);
  let secret: string;
  try {
    secret = enClair ? stocke : decryptPii(stocke, { aad: aadSecret2FA(adminUserId) });
  } catch {
    console.error("[auth-2fa-secret] secret 2FA chiffré illisible", { adminUserId });
    return { valide: false, aReecrire: null };
  }
  if (!verify2FACode(code, secret)) return { valide: false, aReecrire: null };
  if (!enClair) return { valide: true, aReecrire: null };
  const chiffre = chiffrerSecret2FA(adminUserId, secret);
  return { valide: true, aReecrire: isEncryptedPii(chiffre) ? chiffre : null };
}
