// Admin — création d'un QR dynamique.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";
import { QrLinkForm } from "../QrLinkForm";
import { createQrLinkAction } from "@/features/admin-qr-codes/actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function NewQrCodePage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  const base = `/${locale}/${adminPrefix}/qr-codes`;

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Nouveau QR code"
        description="Le slug est figé dès l'impression ; la destination reste modifiable à tout moment."
        actions={
          <a href={base} className="admin-link">
            ← Retour à la liste
          </a>
        }
      />
      <QrLinkForm action={createQrLinkAction} submitLabel="Créer le QR" />
    </AdminPageShell>
  );
}
