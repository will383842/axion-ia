import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminStubPage } from "@/components/admin/image-bank/AdminStubPage";
import { AdminStubPageV2 } from "@/components/admin/image-bank/AdminStubPageV2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Image bank — settings | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function settingsPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  return (
    <AdminStubPageV2
      title="settings"
      description="Section settings (image-bank V1)."
      back={`/${locale}/${adminPrefix}/image-bank`}
      sprint="Sprint 2.x"
    />
  );
}

