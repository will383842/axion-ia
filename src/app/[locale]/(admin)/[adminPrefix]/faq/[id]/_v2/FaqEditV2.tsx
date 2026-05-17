// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// FAQ [id] edit V2 — AdminPageShell + AdminPageHeader + AdminCard + breadcrumbs.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBreadcrumbs,
} from "@/components/admin/ui";
import { FAQForm } from "../../FAQForm";
import { ArchiveButton } from "../ArchiveButton";

interface Initial {
  id: string;
  slug: string;
  category: string;
  status: string;
  questionFr: string;
  questionEn: string;
  answerFr: string;
  answerEn: string;
  metaTitle: string | null;
  metaDescription: string | null;
  displayOrder: number;
}

interface Props {
  adminPrefix: string;
  initial: Initial;
  viewCount: number;
  helpfulCount: number;
  updatedAtIso: string;
  status: string;
  faqId: string;
}

export function FaqEditV2({
  adminPrefix,
  initial,
  viewCount,
  helpfulCount,
  updatedAtIso,
  status,
  faqId,
}: Props): React.ReactElement {
  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Éditer la question"
        description={`Vues : ${viewCount} · Utiles : ${helpfulCount} · Mise à jour : ${updatedAtIso}`}
        breadcrumbs={
          <AdminBreadcrumbs
            items={[{ label: "FAQ", href: `/fr/${adminPrefix}/faq` }, { label: "Édition" }]}
          />
        }
        actions={status !== "archived" ? <ArchiveButton id={faqId} /> : null}
      />
      <AdminCard>
        <FAQForm initial={initial} />
      </AdminCard>
    </AdminPageShell>
  );
}
