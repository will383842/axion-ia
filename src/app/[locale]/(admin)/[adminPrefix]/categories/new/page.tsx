// Page admin /categories/new — creation.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listPotentialParentsAction } from "@/features/admin-categories/actions";
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

  return <CategoriesNewV2 adminPrefix={adminPrefix} parents={parents} />;
}
