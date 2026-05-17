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
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ForgetIpHashForm } from "@/components/admin/image-bank/ForgetIpHashForm";
import { prisma } from "@/lib/prisma";
import { isAdminV2Enabled } from "@/lib/feature-flags";
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

  if (await isAdminV2Enabled()) {
    return (
      <UsageLogsV2
        {...(ipHash ? { ipHash } : { ipHash: undefined })}
        resultsLimit={RESULTS_LIMIT}
        usageLogs={usageLogs}
        downloadLogs={downloadLogs}
      />
    );
  }

  return (
    <main className="space-y-6 p-8">
      <Link
        href={`/${locale}/${adminPrefix}/image-bank`}
        className="text-fg-muted text-sm hover:underline"
      >
        ← Retour image-bank overview
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Usage logs — RGPD art. 17</h1>
        <p className="text-fg-muted">
          Recherche et effacement définitif des traces (ImageUsageLog + ImageDownloadLog) associées
          à un <code className="font-mono text-sm">ipHash</code> SHA-256.
        </p>
        <p className="text-fg-muted text-xs">
          Cap : {RESULTS_LIMIT} entrées max par requête. Audit trail conservé dans{" "}
          <code>activity_logs</code> (action <code>rgpd.image_bank.forget_ip_hash</code>).
        </p>
      </header>

      <ForgetIpHashForm
        {...(ipHash ? { initialIpHash: ipHash } : {})}
        usageLogs={usageLogs}
        downloadLogs={downloadLogs}
      />
    </main>
  );
}
