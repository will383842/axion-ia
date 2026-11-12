/**
 * Marque « STOP reçu pour cette conversation » (table `oppositions_conv_ref`), posée même quand la page du guide
 * n'a pas encore été validée. Ne porte que la référence HACHÉE (jamais d'adresse).
 * 🔴 Aucune suppression. Une lecture ou une écriture en erreur LÈVE : l'appelant ne doit pas envoyer (fermé).
 */
import { prisma } from "@/lib/prisma";

/** Idempotent : deux STOP successifs ne laissent qu'une ligne. */
export async function marquerConvRefOpposee(convRef: string): Promise<void> {
  await prisma.oppositionConvRef.upsert({
    where: { convRef },
    create: { convRef },
    update: {},
    select: { id: true },
  });
}

/** `true` si un STOP est déjà arrivé pour cette référence. Lève si la lecture échoue. */
export async function convRefOpposee(convRef: string): Promise<boolean> {
  const l = await prisma.oppositionConvRef.findUnique({ where: { convRef }, select: { id: true } });
  return l !== null;
}
