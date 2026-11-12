/**
 * Marque « STOP reçu pour cette conversation » (table `oppositions_conv_ref`), posée même quand la page du guide
 * n'a pas encore été validée. Ne porte que la référence HACHÉE (jamais d'adresse).
 * 🔴 Aucune suppression. Une lecture ou une écriture en erreur LÈVE : l'appelant ne doit pas envoyer (fermé).
 */
import type { Prisma } from "../../../prisma/generated/client";
import { prisma } from "@/lib/prisma";

/**
 * Verrou consultatif de la conversation, tenu jusqu'à la fin de la transaction. La chaîne de clé n'est définie
 * qu'ICI : le STOP (qui pose la marque) et la page (qui la relit avant d'écrire) se suivent au lieu de se croiser.
 */
export async function verrouillerConvRef(
  tx: Prisma.TransactionClient,
  convRef: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"guide-reseau-conv:" + convRef}))`;
}

/** Lecture de la marque DANS une transaction (après le verrou). Lève si la lecture échoue (fermé). */
export async function convRefOpposeeDans(
  tx: Prisma.TransactionClient,
  convRef: string,
): Promise<boolean> {
  const l = await tx.oppositionConvRef.findUnique({ where: { convRef }, select: { id: true } });
  return l !== null;
}

/**
 * Idempotent : deux STOP successifs ne laissent qu'une ligne. Verrou puis écriture dans une transaction ;
 * une erreur lève (le STOP répond 500 et sera renvoyé).
 */
export async function marquerConvRefOpposee(convRef: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await verrouillerConvRef(tx, convRef);
    await tx.oppositionConvRef.upsert({
      where: { convRef },
      create: { convRef },
      update: {},
      select: { id: true },
    });
  });
}

/** `true` si un STOP est déjà arrivé pour cette référence. Lève si la lecture échoue. */
export async function convRefOpposee(convRef: string): Promise<boolean> {
  const l = await prisma.oppositionConvRef.findUnique({ where: { convRef }, select: { id: true } });
  return l !== null;
}
