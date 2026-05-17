// Page admin /faq/[id] — edition FAQ.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getFAQDetailAction, archiveFAQAction } from "@/features/admin-faq/actions";
import { FAQForm } from "../FAQForm";
import { ArchiveButton } from "./ArchiveButton";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { FaqEditV2 } from "./_v2/FaqEditV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

export default async function EditFAQPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  const faq = await getFAQDetailAction(id);
  if (!faq) notFound();

  const initialPayload = {
    id: faq.id,
    slug: faq.slug,
    category: faq.category,
    status: faq.status,
    questionFr: faq.questionFr,
    questionEn: faq.questionEn,
    answerFr: faq.answerFr,
    answerEn: faq.answerEn,
    metaTitle: faq.metaTitle,
    metaDescription: faq.metaDescription,
    displayOrder: faq.displayOrder,
  };

  if (await isAdminV2Enabled()) {
    return (
      <FaqEditV2
        adminPrefix={adminPrefix}
        initial={initialPayload}
        viewCount={faq.viewCount}
        helpfulCount={faq.helpfulCount}
        updatedAtIso={faq.updatedAt.toISOString().slice(0, 10)}
        status={faq.status}
        faqId={faq.id}
      />
    );
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <a href={`/fr/${adminPrefix}/faq`} className="admin-link admin-back">
            ← FAQ
          </a>
          <h1 className="admin-h1-large">Éditer la question</h1>
          <p className="admin-meta">
            Vues : {faq.viewCount} • Utiles : {faq.helpfulCount} • Mise à jour :{" "}
            {faq.updatedAt.toISOString().slice(0, 10)}
          </p>
        </div>
        {faq.status !== "archived" && <ArchiveButton id={faq.id} />}
      </div>
      <div className="admin-card admin-card-wide">
        <FAQForm
          initial={{
            id: faq.id,
            slug: faq.slug,
            category: faq.category,
            status: faq.status,
            questionFr: faq.questionFr,
            questionEn: faq.questionEn,
            answerFr: faq.answerFr,
            answerEn: faq.answerEn,
            metaTitle: faq.metaTitle,
            metaDescription: faq.metaDescription,
            displayOrder: faq.displayOrder,
          }}
        />
      </div>
    </section>
  );
}

// Helper export
export { archiveFAQAction };
