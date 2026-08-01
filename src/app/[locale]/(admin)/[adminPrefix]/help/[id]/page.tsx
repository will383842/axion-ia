// Page admin /help/[id] — edition.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getHelpArticleDetailAction,
  listHelpCategoriesAction,
} from "@/features/admin-help/actions";
import { HelpEditV2 } from "./_v2/HelpEditV2";
// Date affichée en FR (audit UX : ISO brut "2026-07-31" illisible pour Will).
import { formatDateFrShort } from "@/lib/format-date-fr";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

export default async function EditHelpPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const [ha, categories] = await Promise.all([
    getHelpArticleDetailAction(id),
    listHelpCategoriesAction(),
  ]);
  if (!ha) notFound();

  const fr = ha.translations.find((t) => t.locale === "fr");
  const en = ha.translations.find((t) => t.locale === "en");

  const initialPayload = {
    id: ha.id,
    categoryId: ha.categoryId,
    isTutorial: ha.isTutorial,
    status: ha.status,
    publishedAt: ha.publishedAt,
    fr: {
      title: fr?.title ?? "",
      slug: fr?.slug ?? "",
      excerpt: fr?.excerpt ?? null,
      body: fr?.body ?? "",
      metaTitle: fr?.metaTitle ?? null,
      metaDescription: fr?.metaDescription ?? null,
    },
    en: {
      title: en?.title ?? "",
      slug: en?.slug ?? "",
      excerpt: en?.excerpt ?? null,
      body: en?.body ?? "",
      metaTitle: en?.metaTitle ?? null,
      metaDescription: en?.metaDescription ?? null,
    },
  };

  return (
    <HelpEditV2
      adminPrefix={adminPrefix}
      categories={categories}
      initial={initialPayload}
      title={fr?.title ?? "(sans titre)"}
      updatedAtIso={formatDateFrShort(ha.updatedAt)}
    />
  );
}
