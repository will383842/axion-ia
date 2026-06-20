// Bucket « Implémentations » (sous-onglet Activités) — documents génériques.
import { ConsoleDocBucket } from "@/components/admin/console-documents/ConsoleDocBucket";

export const dynamic = "force-dynamic";

export default async function ImplementationsDocsPage({
  params,
}: {
  params: Promise<{ adminPrefix: string }>;
}): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  return <ConsoleDocBucket section="implementations" adminPrefix={adminPrefix} />;
}
