// Sous-onglet « Autres » — documents transverses (plaquette, pièces admin…).
import { ConsoleDocBucket } from "@/components/admin/console-documents/ConsoleDocBucket";

export const dynamic = "force-dynamic";

export default async function AutresDocsPage({
  params,
}: {
  params: Promise<{ adminPrefix: string }>;
}): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  return <ConsoleDocBucket section="autres" adminPrefix={adminPrefix} />;
}
