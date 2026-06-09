// Édition d'une offre d'emploi (admin) + actions lifecycle + lien preview public.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";
import { getJobOfferDetailAction } from "@/features/admin-job-offers/actions";
import { JobOfferForm, type JobOfferFormInitial } from "../JobOfferForm";
import { OfferLifecycleActions } from "./OfferLifecycleActions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

const fmtDate = (d: Date | null): string => (d ? d.toISOString().slice(0, 10) : "");
const fmtJson = (v: unknown): string => (v == null ? "" : JSON.stringify(v));

export default async function EditJobOfferPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const o = await getJobOfferDetailAction(id);
  if (!o) notFound();

  const initial: JobOfferFormInitial = {
    id: o.id,
    slug: o.slug,
    status: o.status,
    category: o.category,
    titleFr: o.titleFr,
    titleEn: o.titleEn,
    summaryFr: o.summaryFr,
    summaryEn: o.summaryEn,
    bodyFrHtml: o.bodyFr,
    bodyEnHtml: o.bodyEn,
    employmentType: o.employmentType,
    contractLabel: o.contractLabel ?? "",
    workMode: o.workMode,
    remoteDaysPerWeek: o.remoteDaysPerWeek?.toString() ?? "",
    city: o.city ?? "",
    region: o.region ?? "",
    country: o.country,
    salaryMin: o.salaryMin?.toString() ?? "",
    salaryMax: o.salaryMax?.toString() ?? "",
    salaryPeriod: o.salaryPeriod,
    salaryCurrency: o.salaryCurrency,
    salaryVisible: o.salaryVisible,
    isCommission: o.isCommission,
    requiresDriverLicense: o.requiresDriverLicense,
    requiresVehicle: o.requiresVehicle,
    screeningQuestions: fmtJson(o.screeningQuestions),
    perks: fmtJson(o.perks),
    startDate: fmtDate(o.startDate),
    applicationDeadline: fmtDate(o.applicationDeadline),
    validThrough: fmtDate(o.validThrough),
    teamName: o.teamName ?? "",
    managerName: o.managerName ?? "",
    heroImagePath: o.heroImagePath ?? "",
    ogImagePath: o.ogImagePath ?? "",
    metaTitle: o.metaTitle ?? "",
    metaDescription: o.metaDescription ?? "",
    indexationTier: o.indexationTier,
    displayOrder: o.displayOrder,
  };

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={`Éditer : ${o.titleFr}`}
        description={`Statut : ${o.status}${o.filledAt ? " · pourvu" : ""}`}
        actions={
          <div className="admin-actions-row">
            <Link
              href={`/fr/carrieres/${o.slug}`}
              target="_blank"
              rel="noopener"
              className="admin-button-ghost"
            >
              Prévisualiser ↗
            </Link>
            <Link href={`/fr/${adminPrefix}/offres-emploi`} className="admin-button-ghost">
              ← Liste
            </Link>
          </div>
        }
      />
      <OfferLifecycleActions id={o.id} />
      <JobOfferForm initial={initial} />
    </AdminPageShell>
  );
}
