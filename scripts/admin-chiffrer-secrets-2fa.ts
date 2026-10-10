/**
 * Chiffre au repos les secrets de double authentification encore en clair
 * (`admin_users.two_factor_secret`).
 *
 * Le code applicatif lit déjà les deux formes et réécrit un secret en clair
 * après une vérification réussie : ce script ne fait que hâter cette
 * migration pour les comptes qui ne se connectent pas.
 *
 * - Mode À BLANC par défaut : liste les comptes concernés, n'écrit rien.
 * - `--appliquer` : chiffre et écrit. Idempotent — une valeur déjà chiffrée
 *   est ignorée, et chaque écriture est conditionnée à la valeur lue (une
 *   connexion concurrente qui l'aurait déjà réécrite n'est pas écrasée).
 * - Exige `PII_ENCRYPTION_KEY` (la même que l'application) : sans elle,
 *   s'arrête sans rien écrire.
 * - Ne touche ni `two_factor_enabled`, ni aucun rôle ; n'affiche jamais un
 *   secret.
 *
 * Usage :
 *   pnpm tsx scripts/admin-chiffrer-secrets-2fa.ts              # à blanc
 *   pnpm tsx scripts/admin-chiffrer-secrets-2fa.ts --appliquer
 */

import { PrismaClient } from "../prisma/generated/client";
import { chiffrerSecret2FA } from "../src/lib/auth-2fa-secret";
import { decryptPii, isEncryptedPii } from "../src/lib/pii-crypto";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const appliquer = process.argv.includes("--appliquer");
  if (!/^[0-9a-fA-F]{64}$/.test(process.env["PII_ENCRYPTION_KEY"] ?? "")) {
    console.error("PII_ENCRYPTION_KEY absente ou invalide : arrêt, rien n'est écrit.");
    process.exit(1);
  }

  const comptes = await prisma.adminUser.findMany({
    where: { twoFactorSecret: { not: null } },
    select: { id: true, email: true, twoFactorSecret: true },
  });
  const enClair = comptes.filter((c) => c.twoFactorSecret && !isEncryptedPii(c.twoFactorSecret));

  console.log(
    `${comptes.length} compte(s) avec un secret 2FA, ${enClair.length} encore en clair.` +
      (appliquer ? "" : " Mode à blanc : rien n'est écrit (--appliquer pour écrire)."),
  );

  let ecrits = 0;
  for (const c of enClair) {
    const clair = c.twoFactorSecret as string;
    const chiffre = chiffrerSecret2FA(c.id, clair);
    const relu = decryptPii(chiffre, { aad: `admin_users:${c.id}:two_factor_secret` });
    if (!isEncryptedPii(chiffre) || relu !== clair) {
      throw new Error(`chiffrement non vérifié pour le compte ${c.id} : arrêt`);
    }
    if (!appliquer) {
      console.log(`  [à blanc] ${c.id} ${c.email}`);
      continue;
    }
    const { count } = await prisma.adminUser.updateMany({
      where: { id: c.id, twoFactorSecret: clair },
      data: { twoFactorSecret: chiffre },
    });
    ecrits += count;
    console.log(`  ${count ? "chiffré" : "déjà modifié, ignoré"} ${c.id} ${c.email}`);
  }
  if (appliquer) console.log(`${ecrits} secret(s) chiffré(s).`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
