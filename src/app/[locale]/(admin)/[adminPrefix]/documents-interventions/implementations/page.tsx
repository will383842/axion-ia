// Bucket « Implémentations » (sous-onglet Activités) — documents génériques.
import { ConsoleDocBucket } from "@/components/admin/console-documents/ConsoleDocBucket";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

export default async function ImplementationsDocsPage({
  params,
}: {
  params: Promise<{ adminPrefix: string }>;
}): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  }

  return <ConsoleDocBucket section="implementations" adminPrefix={adminPrefix} />;
}
