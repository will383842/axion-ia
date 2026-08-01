// Image bank — RGPD "Demandes d'effacement" (art. 17 droit à l'effacement)
//
// Permet à un admin de rechercher les traces (ImageUsageLog + ImageDownloadLog)
// associées à une adresse IP et de les supprimer définitivement (audit trail
// conservé via ActivityLog).
//
// Doctrine Axion-IA :
//   - Server Component avec auth role check + redirect login
//   - dynamic = "force-dynamic" + robots: { index: false }
//
// Correctif P0 audit UX 2026-08 : la recherche exigeait un ipHash SHA-256 (64
// hex) qu'un dirigeant non-technicien ne peut jamais produire. On recherche
// désormais par `?ip=…` (adresse IP en clair) et on calcule le hash CÔTÉ
// SERVEUR via `hashImageBankIp` (même fonction que celle qui peuple
// `ImageUsageLog.ipHash`/`ImageDownloadLog.ipHash`, cf. `telecharger/route.ts`)
// — le hash reste un détail d'implémentation, jamais montré ni saisi par Will.

import type { Metadata } from "next";
import { isIP } from "node:net";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashImageBankIp } from "@/server/image-bank/utils/ip-hash";
import { UsageLogsV2 } from "./_v2/UsageLogsV2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Image bank — Demandes d'effacement (RGPD) | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<{ ip?: string }>;
}

const RESULTS_LIMIT = 100;

export default async function UsageLogsPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const { ip: rawIp } = await searchParams;

  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const ip = rawIp && isIP(rawIp) !== 0 ? rawIp : undefined;
  const ipHash = ip ? hashImageBankIp(ip) : undefined;

  const [usageRows, downloadRows] = ipHash
    ? await Promise.all([
        prisma.imageUsageLog.findMany({
          where: { ipHash },
          orderBy: { createdAt: "desc" },
          take: RESULTS_LIMIT,
          select: { id: true, action: true, imageId: true, createdAt: true },
        }),
        prisma.imageDownloadLog.findMany({
          where: { ipHash },
          orderBy: { downloadedAt: "desc" },
          take: RESULTS_LIMIT,
          select: { id: true, variant: true, imageId: true, downloadedAt: true },
        }),
      ])
    : [[], []];

  // Sérialiser BigInt → string + Date → ISO pour passage Server → Client
  const usageLogs = usageRows.map((r) => ({
    id: String(r.id),
    action: r.action,
    imageId: r.imageId,
    createdAt: r.createdAt.toISOString(),
  }));
  const downloadLogs = downloadRows.map((r) => ({
    id: String(r.id),
    variant: r.variant,
    imageId: r.imageId,
    downloadedAt: r.downloadedAt.toISOString(),
  }));

  return (
    <UsageLogsV2
      {...(ip ? { ip } : { ip: undefined })}
      resultsLimit={RESULTS_LIMIT}
      usageLogs={usageLogs}
      downloadLogs={downloadLogs}
    />
  );
}
