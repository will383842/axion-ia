/**
 * Audit présentiel (PR3) : chaque consultation de l'écran « Audit » est journalisée (qui, quelle fiche, quelle séance).
 * AUCUN contenu : ni donnée d'audit, ni extrait de rapport. Appelé après la garde super_admin.
 */
import { headers } from "next/headers";
import { auth } from "@/auth";
import { ipVisiteurOuNull } from "@/lib/client-ip-core";
import { hashIp } from "@/lib/security/ip-hash";
import { ecrireJournalActivite } from "@/server/audit-terrain/journal";

export async function journaliserConsultation(
  clientId: string,
  sessionId: string | null,
): Promise<void> {
  const session = await auth();
  const adminUserId = session?.user?.id ?? null;
  let ip: string | null = null;
  try {
    ip = hashIp(ipVisiteurOuNull(await headers()));
  } catch {
    ip = null;
  }
  await ecrireJournalActivite(
    { adminUserId, ipAddress: ip, userAgent: null },
    {
      action: "audit-terrain.consulte",
      targetType: "client",
      targetId: clientId,
      changes: { sessionId },
    },
  );
}
