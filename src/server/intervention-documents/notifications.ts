// Notification e-mail à la publication d'une nouvelle version de document.
// Résout les destinataires (listes admin DocumentRecipient) par rôle — dérivé
// de la visibilité du document — et par scope (famille / prestation), puis
// enqueue un e-mail par destinataire (idempotent, fail-soft). Aucun compte.

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { getSignedUrlR2, isR2Configured } from "@/lib/r2-storage";
import {
  FAMILLES,
  getInterventionBySlug,
  type InterventionFamille,
} from "@/content/intervention-documents-catalog";

type Role = "formateur" | "commercial";

/** Visibilité du document → rôles à notifier. */
function targetRoles(visibilite: string): Role[] {
  // commercial = aussi visible des commerciaux (ex. programme) ; sinon formateurs.
  return visibilite === "commercial" ? ["commercial", "formateur"] : ["formateur"];
}

export async function notifyNewVersion(versionId: string): Promise<{ enqueued: number }> {
  const version = await prisma.interventionDocumentVersion.findUnique({
    where: { id: versionId },
    include: { document: true },
  });
  if (!version || version.statut !== "publie") return { enqueued: 0 };

  const doc = version.document;
  const roles = targetRoles(doc.visibilite);

  const recipients = await prisma.documentRecipient.findMany({
    where: {
      actif: true,
      role: { in: roles },
      AND: [
        { OR: [{ famille: null }, { famille: doc.famille }] },
        { OR: [{ interventionSlug: null }, { interventionSlug: doc.interventionSlug }] },
      ],
    },
    select: { id: true, email: true },
  });
  if (recipients.length === 0) return { enqueued: 0 };

  const interventionLabel =
    getInterventionBySlug(doc.interventionSlug)?.labelFr ?? doc.interventionSlug;
  const familleLabel =
    FAMILLES.find((f) => f.key === (doc.famille as InterventionFamille))?.titre ?? doc.famille;

  // Liens de téléchargement signés (TTL 14 j), générés une seule fois pour tous
  // les destinataires. Fail-soft : si R2 indisponible, l'e-mail part sans lien.
  const TTL_SECONDS = 14 * 24 * 3600;
  const sign = async (key: string | null): Promise<string | undefined> => {
    if (!key || !isR2Configured()) return undefined;
    try {
      return await getSignedUrlR2(key, TTL_SECONDS);
    } catch {
      return undefined;
    }
  };
  const sourceUrl = await sign(version.sourceKey);
  const pdfUrl = await sign(version.pdfKey);

  let enqueued = 0;
  for (const r of recipients) {
    try {
      await enqueueEmail(
        "documents-nouvelle-version",
        r.email,
        "fr",
        {
          interventionLabel,
          slotTitre: doc.titre,
          version: version.version,
          familleLabel,
          changeNote: version.changeNote ?? undefined,
          sourceUrl,
          pdfUrl,
          sourceFormat: version.sourceFormat ?? undefined,
        },
        { jobId: `doc-version-${versionId}-${r.id}` },
      );
      enqueued++;
    } catch {
      /* fail-soft par destinataire : un envoi raté n'invalide pas les autres */
    }
  }
  return { enqueued };
}
