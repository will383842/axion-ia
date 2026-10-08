// Réseau d'apporteurs — SIRET de l'établissement de l'apporteur (2026-10-08).
//
// Cas réel : deux activités en nom propre, donc un seul SIREN mais deux SIRET. Avec le seul SIREN, la vérification et le contrat montraient l'activité
// du SIÈGE. L'apporteur peut désormais donner le SIRET de l'établissement sous lequel il apporte
// des affaires ; le SIREN en est déduit. Sans SIRET, rien ne change.
//
// Stocké dans une table à part (`apporteur_reseau_siret`), tolérante à son absence : le worker peut
// tourner avant la migration (fenêtre app/worker) — on lit alors « pas de SIRET ».

import { prisma } from "@/lib/prisma";

function tableAbsente(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === "P2021";
}

export async function siretDe(apporteurId: string): Promise<string | null> {
  try {
    const l = await prisma.apporteurReseauSiret.findUnique({
      where: { apporteurId },
      select: { siret: true },
    });
    return l?.siret ?? null;
  } catch (err) {
    if (tableAbsente(err)) return null;
    throw err;
  }
}

export async function siretsDe(ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  try {
    const ls = await prisma.apporteurReseauSiret.findMany({
      where: { apporteurId: { in: [...ids] } },
      select: { apporteurId: true, siret: true },
    });
    return new Map(ls.map((l) => [l.apporteurId, l.siret] as const));
  } catch (err) {
    if (tableAbsente(err)) return new Map();
    throw err;
  }
}

/** Enregistre (ou retire, `null`) le SIRET : appelé à l'étape « activité » du dossier. */
export async function enregistrerSiret(apporteurId: string, siret: string | null): Promise<void> {
  if (siret === null) {
    await prisma.apporteurReseauSiret.deleteMany({ where: { apporteurId } });
    return;
  }
  await prisma.apporteurReseauSiret.upsert({
    where: { apporteurId },
    create: { apporteurId, siret },
    update: { siret },
  });
}
