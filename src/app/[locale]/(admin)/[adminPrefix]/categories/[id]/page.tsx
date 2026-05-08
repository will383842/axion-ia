// Page admin /categories/[id] — edition.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getCategoryDetailAction,
  listPotentialParentsAction,
} from "@/features/admin-categories/actions";
import { CategoryForm } from "../CategoryForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

export default async function EditCategoryPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const [cat, parents] = await Promise.all([
    getCategoryDetailAction(id),
    listPotentialParentsAction(id),
  ]);
  if (!cat) notFound();

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <a href={`/fr/${adminPrefix}/categories`} className="admin-link admin-back">
            ← Catégories
          </a>
          <h1 className="admin-h1-large">Éditer : {cat.nameFr}</h1>
          <p className="admin-meta">Mise à jour : {cat.updatedAt.toISOString().slice(0, 10)}</p>
        </div>
      </div>
      <div className="admin-card admin-card-wide">
        <CategoryForm
          parents={parents}
          initial={{
            id: cat.id,
            slug: cat.slug,
            nameFr: cat.nameFr,
            nameEn: cat.nameEn,
            descriptionFr: cat.descriptionFr,
            descriptionEn: cat.descriptionEn,
            parentId: cat.parentId,
            module: cat.module,
            icon: cat.icon,
            colorAccent: cat.colorAccent,
            displayOrder: cat.displayOrder,
            status: cat.status,
            seoTitleFr: cat.seoTitleFr,
            seoTitleEn: cat.seoTitleEn,
            seoDescFr: cat.seoDescFr,
            seoDescEn: cat.seoDescEn,
            pageContentFr: cat.pageContentFr,
            pageContentEn: cat.pageContentEn,
          }}
        />
      </div>
    </section>
  );
}
