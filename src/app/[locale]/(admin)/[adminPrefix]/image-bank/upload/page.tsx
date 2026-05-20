/**
 * Admin — Image upload page.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { UploadV2 } from "./_v2/UploadV2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Image bank — Upload | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function UploadPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  return <UploadV2 locale={locale} />;
}
