/**
 * Remplissage rétroactif de `submissions.contact_email_hash`.
 *
 * ── Pourquoi ce script existe ─────────────────────────────────────────────
 * La migration `20260812180000_submission_email_lookup_hash` ajoute la colonne
 * vide. Elle ne peut pas la remplir : le calcul de l'empreinte exige de
 * DÉCHIFFRER `contact_email`, ce qui demande la clé applicative
 * `PII_ENCRYPTION_KEY` — hors de portée d'une migration SQL.
 *
 * Sans ce passage, l'export RGPD (art. 15) et l'effacement (art. 17) restent
 * muets sur toutes les soumissions ANTÉRIEURES au déploiement du correctif.
 * Les nouvelles écritures, elles, posent l'empreinte directement.
 *
 * ── Quand l'exécuter ──────────────────────────────────────────────────────
 * APRÈS déploiement, une seule fois, sur le conteneur applicatif (il lui faut
 * `DATABASE_URL` et `PII_ENCRYPTION_KEY` de production) :
 *
 *     pnpm tsx prisma/scripts/backfill-submission-email-hash-2026-08-12.ts
 *
 * Idempotent : il ne traite que les lignes dont l'empreinte est NULL. Le
 * relancer ne coûte qu'une requête à vide.
 *
 * ── Ce qu'il ne fait pas ──────────────────────────────────────────────────
 * Il ne re-chiffre rien et ne corrige pas l'incohérence connue (chatbot,
 * candidatures et podcast stockent l'e-mail EN CLAIR alors que le contact
 * unifié et le simulateur le chiffrent). `decryptPii` traverse les deux cas :
 * une valeur non préfixée `enc:v1:` est rendue telle quelle. L'empreinte est
 * donc correcte dans les deux situations.
 */

import { PrismaClient } from "../generated/client";
import { decryptPii } from "../../src/lib/pii-crypto";
import { hashEmailForLookup } from "../../src/lib/security/email-hash";

const prisma = new PrismaClient();

/** Taille de lot : assez grand pour être rapide, assez petit pour la mémoire. */
const LOT = 500;

async function main(): Promise<void> {
  if (!process.env.PII_ENCRYPTION_KEY) {
    // Fail-loud : sans la clé, `decryptPii` rendrait un placeholder et on
    // écrirait des empreintes fausses — pire que pas d'empreinte du tout.
    throw new Error("PII_ENCRYPTION_KEY absente : empreintes impossibles à calculer.");
  }

  const total = await prisma.submission.count({ where: { contactEmailHash: null } });
  console.log(`[backfill] ${total} soumission(s) sans empreinte.`);
  if (total === 0) return;

  let traitees = 0;
  let ignorees = 0;

  for (;;) {
    const lot = await prisma.submission.findMany({
      where: { contactEmailHash: null },
      select: { id: true, contactEmail: true },
      orderBy: { submittedAt: "asc" },
      take: LOT,
    });
    if (lot.length === 0) break;

    let avancement = 0;

    for (const ligne of lot) {
      const clair = decryptPii(ligne.contactEmail);

      // `decryptPii` rend un placeholder lisible plutôt que de lever quand il
      // n'arrive pas à déchiffrer. On refuse d'en faire une empreinte.
      if (!clair || clair.includes("[encrypted") || !clair.includes("@")) {
        ignorees += 1;
        continue;
      }

      const empreinte = hashEmailForLookup(clair);
      if (!empreinte) {
        ignorees += 1;
        continue;
      }

      await prisma.submission.update({
        where: { id: ligne.id },
        data: { contactEmailHash: empreinte },
      });
      traitees += 1;
      avancement += 1;
    }

    console.log(`[backfill] ${traitees}/${total} traitées, ${ignorees} ignorées.`);

    // Aucune ligne du lot n'a pu être traitée : elles resteraient à NULL et on
    // les relirait indéfiniment. On sort plutôt que de boucler sans fin.
    if (avancement === 0) {
      console.warn("[backfill] lot entièrement illisible — arrêt pour éviter une boucle.");
      break;
    }
  }

  console.log(`[backfill] terminé : ${traitees} empreintes posées, ${ignorees} ignorées.`);
  if (ignorees > 0) {
    console.warn(
      "[backfill] ⚠️ les lignes ignorées resteront introuvables par l'export et " +
        "l'effacement RGPD. Les inspecter avant de clore le sujet.",
    );
  }
}

main()
  .catch((err) => {
    console.error("[backfill] échec :", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
