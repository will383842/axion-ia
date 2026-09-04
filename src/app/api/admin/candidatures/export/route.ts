// Téléchargement CSV des candidatures — route ADMIN authentifiée uniquement.
//
// 🔴 LA GARDE EST ICI, PAS DANS LE CONSTRUCTEUR. `export-csv.ts` ne lit aucune
//    session, exactement comme `reads.ts` : c'est ce qui lui permet d'être
//    appelé depuis un contexte sans cookie sans qu'un droit soit supposé. La
//    contrepartie est que TOUT appelant doit trancher — celui-ci le fait avec
//    le prédicat commun, jamais une liste de rôles recopiée.
//
// Même forme que la route du CV, et pour la même raison : ce qui rend cet accès
// défendable n'est pas la liste des rôles, c'est la TRACE.

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { construireExportCandidatures } from "@/features/admin-job-applications/export-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!peutOuvrirDossierCandidat(role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  let resultat;
  try {
    resultat = await construireExportCandidatures({
      offerId: sp.get("offerId") ?? undefined,
      status: (sp.get("status") as never) ?? undefined,
      view: (sp.get("view") as never) ?? undefined,
      // ⚠️ `z.coerce.boolean()` rend TRUE pour la chaîne "false" : on ne
      // transmet le champ que lorsqu'il vaut explicitement "1".
      ...(sp.get("attention") === "1" ? { onlyAttention: true } : {}),
      search: sp.get("q") ?? undefined,
    });
  } catch {
    // Un filtre illisible (statut inventé dans l'URL) est une faute de
    // l'appelant, pas une panne : 400, et surtout pas un 500 qui enverrait
    // chercher un incident.
    return new NextResponse("Bad request", { status: 400 });
  }

  // 🔑 La trace est écrite APRÈS la lecture, pour consigner ce qui est
  // RÉELLEMENT sorti (nombre de lignes, troncature) — et non ce qui avait été
  // demandé. Une demande d'accès RGPD porte sur ce qui a été extrait.
  //
  // ⚠️ Le TERME de recherche n'est jamais consigné : on cherche par adresse
  // e-mail, et `activity_logs` est précisément l'endroit où ce dépôt s'interdit
  // de réintroduire une PII en clair.
  //
  // Best-effort : un journal indisponible ne doit pas priver le recruteur de
  // son fichier — mais l'échec ne doit pas non plus passer pour un succès, d'où
  // l'en-tête ci-dessous.
  let journalise = true;
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: session.user.id,
        action: "careers.candidature.exportee",
        targetType: "JobApplication",
        targetId: null,
        changes: {
          view: sp.get("view") ?? "all",
          status: sp.get("status") ?? "all",
          offerId: sp.get("offerId"),
          attention: sp.get("attention") === "1",
          recherche: sp.get("q") ? "oui" : "non",
          lignes: resultat.lignes,
          tronque: resultat.tronque,
        },
        ipAddress: await getClientIp(),
      },
    });
  } catch {
    journalise = false;
  }

  return new NextResponse(resultat.csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${resultat.filename}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      // Deux en-têtes de diagnostic. Ils ne changent rien au fichier, et ils
      // évitent deux erreurs de lecture coûteuses : croire un export complet
      // alors qu'il est tronqué, et croire un accès journalisé alors que
      // l'écriture a échoué.
      "x-axion-export-lignes": String(resultat.lignes),
      ...(resultat.tronque ? { "x-axion-export-tronque": "1" } : {}),
      ...(journalise ? {} : { "x-axion-export-journal": "echec" }),
    },
  });
}
