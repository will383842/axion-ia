// Sous-onglet « Carte de visite & divers » de la barre latérale.
//
// Cette page manquait. Les trois sous-onglets du catalogue existaient, mais la
// catégorie `general` déclarait une `route` sans page ni entrée de menu : ses
// QR — dont les DEUX de la carte de visite, `vc` et `wa` — n'apparaissaient que
// dans la liste racine, noyés parmi 45 QR de catalogue. Ce n'était pas un défaut
// d'organisation mais un tiroir manquant.
//
// Route statique et non `?category=` : le surlignage de la sidebar compare le
// chemin, jamais la query string (voir QrCodesView).
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { QrCodesView } from "../QrCodesView";
import { qrCategoryByRoute } from "@/features/admin-qr-codes/categories";

export const dynamic = "force-dynamic";

const CAT = qrCategoryByRoute("general")!;

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
