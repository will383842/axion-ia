// Page admin /faq/new — creation FAQ.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { FAQForm } from "../FAQForm";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { FaqNewV2 } from "./_v2/FaqNewV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function NewFAQPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (await isAdminV2Enabled()) {
    return <FaqNewV2 adminPrefix={adminPrefix} />;
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <a href={`/fr/${adminPrefix}/faq`} className="admin-link admin-back">
            ← FAQ
          </a>
          <h1 className="admin-h1-large">Nouvelle question</h1>
        </div>
      </div>
      <div className="admin-card admin-card-wide">
        <FAQForm />
      </div>
    </section>
  );
}
