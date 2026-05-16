import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminStubPage } from "@/components/admin/image-bank/AdminStubPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Image bank — bulk import | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function bulkimportPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  return (
    <AdminStubPage
      title="bulk import"
      description="Section bulk import (image-bank V1)."
      back={`/${locale}/${adminPrefix}/image-bank`}
      sprint="Sprint 2.x"
    />
  );
}
