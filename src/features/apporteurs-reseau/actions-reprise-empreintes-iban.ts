"use server";

/**
 * Reprise des empreintes IBAN depuis la console (plan changement d'IBAN §3.3).
 *
 * Contrôle d'accès CÔTÉ SERVEUR : `super_admin` seul (acte `valider_changement_iban`, qui exclut `admin`),
 * même si l'action est appelée directement. Rend des COMPTES uniquement ; la trace d'audit porte qui, quand
 * (horodatage du journal), essai ou application, et les comptes. Jamais d'IBAN, ni dans le retour, ni au
 * journal, ni à Sentry (aucune exception n'est transmise ni loggée).
 */

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { peutEngager } from "@/server/auth/habilitations";
import { journaliser } from "@/server/journal/journaliser";

import { repriseEmpreintesIban, type CompteRenduReprise } from "./reprise-historique-iban";

export type ResultatRepriseConsole =
  { ok: true; comptes: CompteRenduReprise } | { ok: false; message: string };

export async function repriseEmpreintesIbanAction(o: {
  appliquer: boolean;
}): Promise<ResultatRepriseConsole> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Session expirée : reconnectez-vous." };
  const role = (session.user as { role?: string }).role ?? null;
  if (!peutEngager(role, "valider_changement_iban")) {
    return { ok: false, message: "Seul le super administrateur peut lancer cette reprise." };
  }
  const appliquer = o.appliquer === true;
  let comptes: CompteRenduReprise;
  try {
    comptes = await repriseEmpreintesIban({ appliquer });
  } catch {
    return { ok: false, message: "La reprise a échoué. Aucun détail n'est affiché ; réessayez." };
  }
  await journaliser(prisma, {
    action: `apporteur.reprise_empreintes_iban.${appliquer ? "appliquee" : "essai"}`,
    targetType: "ApporteurReseau",
    targetId: null,
    changes: {
      appliquer,
      refus: comptes.refus,
      vus: comptes.vus,
      dejaAJour: comptes.dejaAJour,
      aCalculer: comptes.aCalculer,
      calcules: comptes.calcules,
      ...comptes.ignores,
    },
    session: { userId: session.user.id },
  });
  revalidatePath("/[locale]/[adminPrefix]/apporteurs/reprise-empreintes-iban", "layout");
  if (comptes.refus === "secret_absent") {
    return {
      ok: false,
      message: "Le secret d'empreinte n'est pas posé sur l'application : rien n'a été lu ni écrit.",
    };
  }
  return { ok: true, comptes };
}
