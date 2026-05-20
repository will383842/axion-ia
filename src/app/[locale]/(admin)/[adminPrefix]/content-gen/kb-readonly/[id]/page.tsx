/**
 * Content Generator — KB entry detail (read-only).
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { KbReadonlyDetailV2 } from "./_v2/KbReadonlyDetailV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function KbReadonlyDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id },
    include: { translations: { where: { locale: "fr" }, take: 1 } },
  });
  if (!entry) notFound();
  const fr = entry.translations[0];

  return (
    <KbReadonlyDetailV2
      adminPrefix={adminPrefix}
      entry={{
        id: entry.id,
        slug: entry.slug,
        type: entry.type,
        audience: entry.audience,
        status: entry.status,
        fr: fr ? { title: fr.title, bodyText: fr.bodyText, body: fr.body } : null,
      }}
    />
  );
}

