// Page admin /help/[id] — edition.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getHelpArticleDetailAction,
  listHelpCategoriesAction,
} from "@/features/admin-help/actions";
import { HelpForm } from "../HelpForm";

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

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <a href={`/fr/${adminPrefix}/help`} className="admin-link admin-back">
            ← Centre d&apos;aide
          </a>
          <h1 className="admin-h1-large">Éditer : {fr?.title ?? "(sans titre)"}</h1>
          <p className="admin-meta">Mise à jour : {ha.updatedAt.toISOString().slice(0, 10)}</p>
        </div>
      </div>
      <div className="admin-card admin-card-wide">
        <HelpForm
          categories={categories}
          initial={{
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
          }}
        />
      </div>
    </section>
  );
}
