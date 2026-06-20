// Bucket « Sites web » (sous-onglet Activités) — documents génériques.
import { ConsoleDocBucket } from "@/components/admin/console-documents/ConsoleDocBucket";

export const dynamic = "force-dynamic";

export default async function SitesWebDocsPage({
  params,
}: {
  params: Promise<{ adminPrefix: string }>;
}): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  return <ConsoleDocBucket section="sites_web" adminPrefix={adminPrefix} />;
}
