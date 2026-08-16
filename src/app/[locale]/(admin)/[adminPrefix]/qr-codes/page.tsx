// Admin — liste de TOUS les QR codes dynamiques, toutes catégories confondues.
// Les trois sous-onglets du catalogue ont chacun leur propre route enfant
// (catalogue/, avis/, pages/) : voir QrCodesView pour la raison.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { QrCodesView } from "./QrCodesView";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function QrCodesListPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return (
    <QrCodesView
      locale={locale}
      adminPrefix={adminPrefix}
      title="QR codes & liens"
      description="Chaque QR imprimé encode /qr/<slug> et redirige (302) vers une destination modifiable ici — sans jamais réimprimer. Le compteur de scans mesure l'usage."
    />
  );
}
