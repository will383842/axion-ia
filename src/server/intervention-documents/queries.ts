// Lectures de la bibliothèque de documents d'intervention (Server Components).
// Renvoie, par slot, le document + sa version courante (URLs R2 signées,
// fail-soft si R2 non configuré) + l'historique (métadonnées seules).

import { prisma } from "@/lib/prisma";
import { getSignedUrlR2, isR2Configured } from "@/lib/r2-storage";

export interface VersionMeta {
  id: string;
  version: number;
  statut: "brouillon" | "publie" | "archive";
  changeNote: string | null;
  sourceFormat: string | null;
  sourceSizeBytes: number;
  pdfSizeBytes: number;
  hasSource: boolean;
  hasPdf: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export interface CurrentVersionView extends VersionMeta {
  sourceUrl: string | null;
  pdfUrl: string | null;
}

export interface SlotState {
  documentId: string;
  current: CurrentVersionView | null;
  /** Version brouillon en cours (non publiée), s'il y en a une. */
  draftId: string | null;
  history: VersionMeta[];
}

function toMeta(v: {
  id: string;
  version: number;
  statut: string;
  changeNote: string | null;
  sourceFormat: string | null;
  sourceKey: string | null;
  pdfKey: string | null;
  sourceSizeBytes: number;
  pdfSizeBytes: number;
  publishedAt: Date | null;
  createdAt: Date;
}): VersionMeta {
  return {
    id: v.id,
    version: v.version,
    statut: v.statut as VersionMeta["statut"],
    changeNote: v.changeNote,
    sourceFormat: v.sourceFormat,
    sourceSizeBytes: v.sourceSizeBytes,
    pdfSizeBytes: v.pdfSizeBytes,
    hasSource: Boolean(v.sourceKey),
    hasPdf: Boolean(v.pdfKey),
    publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
    createdAt: v.createdAt.toISOString(),
  };
}

async function signOrNull(key: string | null): Promise<string | null> {
  if (!key || !isR2Configured()) return null;
  try {
    return await getSignedUrlR2(key, 60 * 60);
  } catch {
    return null;
  }
}

/** État de tous les slots déposés pour une prestation, indexé par `slot`. */
export async function getSlotStates(interventionSlug: string): Promise<Map<string, SlotState>> {
  const docs = await prisma.interventionDocument.findMany({
    where: { interventionSlug },
    include: { versions: { orderBy: { version: "desc" } } },
  });

  const map = new Map<string, SlotState>();
  for (const d of docs) {
    const currentRow = d.versions.find((v) => v.id === d.currentVersionId) ?? null;
    const draft = d.versions.find((v) => v.statut === "brouillon") ?? null;
    const current: CurrentVersionView | null = currentRow
      ? {
          ...toMeta(currentRow),
          sourceUrl: await signOrNull(currentRow.sourceKey),
          pdfUrl: await signOrNull(currentRow.pdfKey),
        }
      : null;
    map.set(d.slot, {
      documentId: d.id,
      current,
      draftId: draft?.id ?? null,
      history: d.versions.map(toMeta),
    });
  }
  return map;
}

export interface RecipientView {
  id: string;
  email: string;
  nom: string | null;
  role: string;
  famille: string | null;
  interventionSlug: string | null;
  actif: boolean;
}

/** Toutes les listes de destinataires (notifications e-mail), triées. */
export async function getRecipients(): Promise<RecipientView[]> {
  const rows = await prisma.documentRecipient.findMany({
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    nom: r.nom,
    role: r.role,
    famille: r.famille,
    interventionSlug: r.interventionSlug,
    actif: r.actif,
  }));
}
