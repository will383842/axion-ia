import type { Metadata } from "next";

import { AdminStubPageV2 } from "@/components/admin/image-bank/AdminStubPageV2";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Banque d'images — mots-clés | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function tagsPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  return (
    <AdminStubPageV2
      title="Étiquettes"
      description="Mots-clés associés aux images."
      back={`/${locale}/${adminPrefix}/image-bank`}
    />
  );
}
