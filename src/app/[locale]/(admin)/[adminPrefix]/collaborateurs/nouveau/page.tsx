/** Admin — nouvelle fiche collaborateur. Réservé aux administrateurs. */
import type { Metadata } from "next";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import {
  CollaborateurForm,
  type FicheInitiale,
} from "@/components/admin/collaborateurs/CollaborateurForm";
import { gardePageCollaborateurs } from "@/server/equipe-garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Nouvelle fiche collaborateur | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const VIDE: FicheInitiale = {
  status: "brouillon",
  publishedAt: false,
  category: "autres",
  firstName: "",
  organizationName: "",
  jobTitle: "",
  headline: "",
  bioMd: "",
  skills: "",
  languages: "",
  websiteUrl: "",
  linkedinUrl: "",
  citySlug: "",
  departmentCode: "",
  locationLabel: "",
  showOnMap: false,
  slug: "",
  sortOrder: 100,
  consentPublication: false,
  consentLinkedin: false,
  consentNote: "",
  photoKind: "avatar",
  photoConsent: false,
  photoUrl256: null,
  questionnaireVersion: null,
  categoryAnswers: null,
};

export default async function NouveauCollaborateurPage({
  params,
}: {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePageCollaborateurs(`/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader title="Nouvelle fiche collaborateur" />
      <CollaborateurForm initial={VIDE} />
    </AdminPageShell>
  );
}
