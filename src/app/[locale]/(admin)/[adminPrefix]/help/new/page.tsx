// Page admin /help/new — creation article centre aide.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listHelpCategoriesAction } from "@/features/admin-help/actions";
import { HelpNewV2 } from "./_v2/HelpNewV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function NewHelpPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  const categories = await listHelpCategoriesAction();

  return <HelpNewV2 adminPrefix={adminPrefix} categories={categories} />;
}
