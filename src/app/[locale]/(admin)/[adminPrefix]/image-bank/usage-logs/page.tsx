// Image bank — RGPD usage logs (art. 17 droit à l'effacement)
//
// Permet à un admin de rechercher les traces (ImageUsageLog + ImageDownloadLog)
// associées à un ipHash et de les supprimer définitivement (audit trail
// conservé via ActivityLog).
//
// Doctrine Axion-IA :
//   - Server Component avec auth role check + redirect login
//   - dynamic = "force-dynamic" + robots: { index: false }
//   - Recherche par ?ipHash=… (SHA-256 hex 64 chars)
//   - Action de suppression déléguée à forgetIpHashAction Server Action

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UsageLogsV2 } from "./_v2/UsageLogsV2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Image bank — Usage logs (RGPD) | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<{ ipHash?: string }>;
}

const IP_HASH_RE = /^[a-f0-9]{64}$/i;
const RESULTS_LIMIT = 100;

export default async function UsageLogsPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const { ipHash: rawIpHash } = await searchParams;

  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const ipHash = rawIpHash && IP_HASH_RE.test(rawIpHash) ? rawIpHash : undefined;

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
      {...(ipHash ? { ipHash } : { ipHash: undefined })}
      resultsLimit={RESULTS_LIMIT}
      usageLogs={usageLogs}
      downloadLogs={downloadLogs}
    />
  );
}
