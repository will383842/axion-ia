// Sous-onglet « Avis du catalogue » de la barre latérale.
// Route statique et non `?category=` : le surlignage de la sidebar compare le
// chemin, jamais la query string (voir QrCodesView).
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { QrCodesView } from "../QrCodesView";
import { qrCategoryByRoute } from "@/features/admin-qr-codes/categories";

export const dynamic = "force-dynamic";

const CAT = qrCategoryByRoute("avis")!;

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; adminPrefix: string }>;
}) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return (
    <QrCodesView
      locale={locale}
      adminPrefix={adminPrefix}
      category={CAT.value}
      title={CAT.label}
      description={CAT.description}
    />
  );
}
