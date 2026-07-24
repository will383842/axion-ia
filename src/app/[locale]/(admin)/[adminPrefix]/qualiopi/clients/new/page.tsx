/**
 * Admin — Qualiopi · Nouveau client (entreprise B2B ou particulier B2C, R-B2C).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { ClientForm, type ClientFormInitialValues } from "@/components/admin/qualiopi/ClientForm";
import { getSubmissionDetailAction } from "@/features/admin-submissions/actions";
import { buildClientPrefillFromSubmission } from "@/server/qualiopi/crm/submission-to-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Nouveau client | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NouveauClientPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const base = `/${locale}/${adminPrefix}/qualiopi/clients`;

  // Pré-remplissage depuis une demande de contact (« Convertir en client »).
  // L'URL ne porte QUE l'id : la Submission est rechargée et DÉCHIFFRÉE côté
  // serveur (getSubmissionDetailAction) — aucune PII ne transite par l'URL.
  let initialValues: ClientFormInitialValues | undefined;
  let prefillNotice: string | undefined;
  const fromSubmission = (await searchParams)["fromSubmission"];
  if (typeof fromSubmission === "string" && fromSubmission.length > 0) {
    const submission = await getSubmissionDetailAction(fromSubmission);
    if (submission) {
      const p = buildClientPrefillFromSubmission({
        id: submission.id,
        companyName: submission.companyName,
        contactName: submission.contactName,
        contactEmail: submission.contactEmail,
        contactPhone: submission.contactPhone,
        contactRole: submission.contactRole,
        sector: submission.sector,
        employeesCount: submission.employeesCount,
        address: submission.address,
        details: submission.details,
      });
      initialValues = p;
      const nom = p.raisonSociale || "cette demande";
      prefillNotice = `Pré-rempli depuis la demande de « ${nom} ».`;
    }
  }

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Nouveau client"
        description="Entreprise (B2B) ou particulier (B2C, ex. CPF perso). Les champs entreprise sont masqués pour un particulier."
      />
      <ClientForm
        baseHref={base}
        {...(initialValues ? { initialValues } : {})}
        {...(prefillNotice ? { prefillNotice } : {})}
      />
    </AdminPageShell>
  );
}
