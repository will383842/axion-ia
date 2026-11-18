import type { PrismaClient } from "../../../prisma/generated/client";
import type { VerdictAntivirus } from "@/server/careers/clamav";
import {
  telechargerDocument,
  type IssueTelechargement,
} from "@/features/dossier-client/documents/telecharger";
import { siteAuditDuClient } from "./config";

type Db = Pick<PrismaClient, "documentProjet" | "documentProjetContenu" | "projetEvenement">;

/** null = pas de site d'audit configuré pour ce client. Lit via `telechargerDocument` seul. */
export async function lireSiteAudit(
  db: Db,
  p: { clientId: string; parAdminId: string },
  analyser: (octets: Uint8Array) => Promise<VerdictAntivirus>,
  env: Record<string, string | undefined> = process.env,
): Promise<IssueTelechargement | null> {
  const cfg = siteAuditDuClient(p.clientId, env);
  if (cfg === null) return null;
  const clientId = p.clientId.toLowerCase();
  const doc = await db.documentProjet.findFirst({
    where: {
      id: cfg.documentId,
      projetId: cfg.projetId,
      clientId,
      archiveLe: null,
      fichierFormat: "html",
    },
    select: { id: true },
  });
  if (doc === null) return { issue: "introuvable" };
  return telechargerDocument(
    db,
    { id: cfg.documentId, projetId: cfg.projetId, clientId, parAdminId: p.parAdminId },
    analyser,
  );
}
