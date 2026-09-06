// Sous-onglet « Autres » — documents transverses (plaquette, pièces admin…).
import { ConsoleDocBucket } from "@/components/admin/console-documents/ConsoleDocBucket";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

export default async function AutresDocsPage({
  params,
}: {
  params: Promise<{ adminPrefix: string }>;
}): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  // 🔑 On appelle la garde pour son EFFET : sans session, elle redirige vers la
  // connexion. C'est ce que cette page doit garantir par elle-même — le proxy
  // ne peut pas être la seule couche (contournement du 2026-09-05).
  //
  // ⚠️ Pas de `<AccesRefuse>` ici, et ce n'est pas un oubli : en consultation,
  //    le seul refus possible est « rôle non reconnu », que le layout admin
  //    intercepte DÉJÀ avant de rendre ses enfants. La branche serait morte, et
  //    elle coûtait 1,64 kB gz au cliquet de bundle sur les 29 pages de ce lot
  //    (mesuré par Gate B) — `AccesRefuse` tire `next/link` et une icône.
  await gardePage("consultation", `/fr/${adminPrefix}/login`);

  return <ConsoleDocBucket section="autres" adminPrefix={adminPrefix} />;
}
