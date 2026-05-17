// Page admin /categories/new — creation.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listPotentialParentsAction } from "@/features/admin-categories/actions";
import { CategoryForm } from "../CategoryForm";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { CategoriesNewV2 } from "./_v2/CategoriesNewV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function NewCategoryPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  const parents = await listPotentialParentsAction();

  if (await isAdminV2Enabled()) {
    return <CategoriesNewV2 adminPrefix={adminPrefix} parents={parents} />;
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <a href={`/fr/${adminPrefix}/categories`} className="admin-link admin-back">
            ← Catégories
          </a>
          <h1 className="admin-h1-large">Nouvelle catégorie</h1>
        </div>
      </div>
      <div className="admin-card admin-card-wide">
        <CategoryForm parents={parents} />
      </div>
    </section>
  );
}
