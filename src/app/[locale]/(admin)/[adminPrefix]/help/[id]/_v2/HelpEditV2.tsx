// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Help [id] edit V2 — AdminPageShell + AdminPageHeader + AdminCard + breadcrumbs.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBreadcrumbs,
} from "@/components/admin/ui";
import { HelpForm } from "../../HelpForm";

interface CategoryOption {
  id: string;
  slug: string;
  nameFr: string;
}
interface TranslationInitial {
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  metaTitle: string | null;
  metaDescription: string | null;
}
interface Initial {
  id: string;
  categoryId: string | null;
  isTutorial: boolean;
  status: string;
  publishedAt: Date | null;
  fr: TranslationInitial;
  en: TranslationInitial;
}

interface Props {
  adminPrefix: string;
  categories: ReadonlyArray<CategoryOption>;
  initial: Initial;
  title: string;
  updatedAtIso: string;
}

export function HelpEditV2({
  adminPrefix,
  categories,
  initial,
  title,
  updatedAtIso,
}: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={`Éditer : ${title}`}
        description={`Mise à jour : ${updatedAtIso}`}
        breadcrumbs={
          <AdminBreadcrumbs
            items={[{ label: "Centre d'aide", href: `/fr/${adminPrefix}/help` }, { label: title }]}
          />
        }
      />
      <AdminCard>
        <HelpForm categories={categories} initial={initial} />
      </AdminCard>
    </AdminPageShell>
  );
}
