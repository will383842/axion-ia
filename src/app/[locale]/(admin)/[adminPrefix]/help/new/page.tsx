// Page admin /help/new — creation article centre aide.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listHelpCategoriesAction } from "@/features/admin-help/actions";
import { HelpForm } from "../HelpForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function NewHelpPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  const categories = await listHelpCategoriesAction();
  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <a href={`/fr/${adminPrefix}/help`} className="admin-link admin-back">
            ← Centre d&apos;aide
          </a>
          <h1 className="admin-h1-large">Nouvel article</h1>
        </div>
      </div>
      <div className="admin-card admin-card-wide">
        <HelpForm categories={categories} />
      </div>
    </section>
  );
}
