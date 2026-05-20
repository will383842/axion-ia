// Page admin /faq/[id] — edition FAQ.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getFAQDetailAction, archiveFAQAction } from "@/features/admin-faq/actions";
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

// Helper export
export { archiveFAQAction };
