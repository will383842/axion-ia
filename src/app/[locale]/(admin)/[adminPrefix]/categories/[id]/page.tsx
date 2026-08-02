// Page admin /categories/[id] — edition.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getCategoryDetailAction,
  listPotentialParentsAction,
} from "@/features/admin-categories/actions";
import { CategoriesEditV2 } from "./_v2/CategoriesEditV2";
import { formatDateFrShort } from "@/lib/format-date-fr";

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

  const initialPayload = {
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
  };

  return (
    <CategoriesEditV2
      adminPrefix={adminPrefix}
      parents={parents}
      initial={initialPayload}
      title={cat.nameFr}
      updatedAtIso={formatDateFrShort(cat.updatedAt)}
    />
  );
}
