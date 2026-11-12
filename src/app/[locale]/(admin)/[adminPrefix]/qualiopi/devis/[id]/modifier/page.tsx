/**
 * Admin — Qualiopi · Modifier un brouillon de devis à formules.
 *
 * Interrupteur `devis_assistant` ALLUMÉ : la page n'édite plus rien, elle renvoie vers
 * l'assistant (`/qualiopi/devis/new?devis=<id>`, fiche S11) — un devis qui n'est plus brouillon
 * va à sa fiche, jamais à l'édition. ÉTEINT : comportement d'avant, à l'identique.
 *
 * Server Component — garde d'écriture, force-dynamic, noindex. 404 si l'interrupteur est
 * éteint, si le devis n'existe pas, n'est plus un brouillon ou n'a pas été créé en mode formules.
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { DevisFormulesEdition } from "@/components/admin/qualiopi/DevisFormulesEdition";
import { gardePage } from "@/server/auth/garde-page";
import { prisma } from "@/lib/prisma";
import { isUuid } from "@/lib/is-uuid";
import { assistantDevisActif } from "@/server/qualiopi/devis/interrupteur-assistant";
import { formulesActives } from "@/server/qualiopi/devis/interrupteur-formules";
import { offreDevisV1 } from "@/server/qualiopi/devis/offre-devis";
import { offreVersSaisie } from "@/components/admin/qualiopi/devis-formules/saisie";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Modifier le brouillon | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

export default async function QualiopiDevisModifierPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const acces = await gardePage("ecriture", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  if (!isUuid(id)) notFound();

  if (await assistantDevisActif()) {
    const existant = await prisma.devis.findUnique({ where: { id }, select: { statut: true } });
    if (!existant) notFound();
    const base = `/${locale}/${adminPrefix}/qualiopi/devis`;
    redirect(existant.statut === "brouillon" ? `${base}/new?devis=${id}` : `${base}/${id}`);
  }

  if (!(await formulesActives())) notFound();

  const devis = await prisma.devis.findUnique({
    where: { id },
    select: {
      id: true,
      numero: true,
      statut: true,
      offre: true,
      offreSha256: true,
      updatedAt: true,
    },
  });
  if (!devis || devis.statut !== "brouillon" || devis.offre === null) notFound();
  const offre = offreDevisV1.safeParse(devis.offre);
  if (!offre.success) notFound();

  const retourHref = `/${locale}/${adminPrefix}/qualiopi/devis/${devis.id}`;
  return (
    <AdminPageShell width="narrow">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={retourHref}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Retour au devis
        </Link>
      </div>
      <AdminPageHeader
        title={`Modifier le brouillon ${devis.numero}`}
        description="Un devis envoyé ne se modifie pas : il se révise. Si ce brouillon a été enregistré depuis un autre onglet, la page demandera de recharger."
      />
      <DevisFormulesEdition
        devisId={devis.id}
        attenduMajLe={devis.updatedAt.toISOString()}
        saisieInitiale={offreVersSaisie(offre.data)}
        textes={offre.data.textes}
        retourHref={retourHref}
      />
    </AdminPageShell>
  );
}
