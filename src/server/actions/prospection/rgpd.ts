"use server";

/**
 * Prospection — Server Actions RGPD (T8) : opt-out multi-clé + journal d'accès.
 * Opt-out réellement bloquant : crée un `SuppressionEntry` ET propage `optOut`
 * sur les entités déjà en base (l'export re-filtre en plus au moment de générer).
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProspectionAccess } from "./_auth";
import {
  normalizeSuppression,
  type SuppressionType,
} from "@/server/prospection/rgpd/export-filter";
import { adminPath } from "@/lib/admin-path";

/**
 * Enregistre une opposition (opt-out) et la propage aux entités en base.
 * Réservé `dpo|admin` (export/opt-out = capacité `export`).
 */
export async function submitProspectionOptOut(
  type: SuppressionType,
  value: string,
  raison?: string,
): Promise<{ ok: true }> {
  const session = await requireProspectionAccess("export");
  const valueNormalized = normalizeSuppression(type, value);
  if (!valueNormalized) throw new Error("valeur d'opposition vide");

  await prisma.prospectionSuppressionEntry.upsert({
    where: { type_valueNormalized: { type, valueNormalized } },
    create: { type, value, valueNormalized, ...(raison ? { raison } : {}) },
    update: { ...(raison ? { raison } : {}) },
  });

  const now = new Date();
  // Propagation immédiate sur les entités déjà collectées.
  if (type === "siren") {
    await prisma.prospectionCompany.updateMany({
      where: { siren: valueNormalized },
      data: { optOut: true, optOutAt: now },
    });
  } else if (type === "personKey") {
    await prisma.prospectionPerson.updateMany({
      where: { personKey: valueNormalized },
      data: { optOut: true, optOutAt: now },
    });
    // V2 santé : propage aussi aux praticiens (même personKey).
    await prisma.prospectionHealthPractitioner.updateMany({
      where: { personKey: valueNormalized },
      data: { optOut: true, optOutAt: now },
    });
  } else if (type === "email") {
    const contacts = await prisma.prospectionContact.findMany({
      where: { type: "email", valueNormalized },
      select: { companyId: true },
    });
    const ids = [...new Set(contacts.map((c) => c.companyId))];
    if (ids.length > 0) {
      await prisma.prospectionCompany.updateMany({
        where: { id: { in: ids } },
        data: { optOut: true, optOutAt: now },
      });
    }
  } else if (type === "domaine") {
    // Propage sur les entreprises dont le site public porte ce domaine.
    // `insensitive` : le siteWeb est stocké tel que scrapé (casse variable) alors
    // que `valueNormalized` est minuscule → sinon l'opposition ne matcherait pas.
    await prisma.prospectionCompany.updateMany({
      where: { siteWeb: { contains: valueNormalized, mode: "insensitive" } },
      data: { optOut: true, optOutAt: now },
    });
  }

  await prisma.prospectionEvent.create({
    data: { type: "opt_out", actorId: session.userId, reason: `${type}:${valueNormalized}` },
  });
  revalidatePath(adminPath("fr", "prospection/rgpd"));
  return { ok: true };
}

/** Journalise un accès à des données personnelles (RGPD — accountability). */
export async function logProspectionAccess(
  action: "view_person" | "search" | "export",
  cible?: string,
): Promise<void> {
  const session = await requireProspectionAccess("view");
  await prisma.prospectionAccessLog.create({
    data: { userId: session.userId, action, ...(cible ? { cible } : {}) },
  });
}
