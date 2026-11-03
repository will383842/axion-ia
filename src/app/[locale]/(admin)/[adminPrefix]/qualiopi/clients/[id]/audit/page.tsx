/**
 * Admin — Écran « Audit » d'une fiche client (audit présentiel, PR3).
 *
 * Sous-page (comme `questionnaire/`) et NON un onglet : la page des onglets est figée par une garde
 * d'empreinte. Réservée au super_admin ; la garde passe AVANT toute lecture (un non-habilité ne
 * apprend même pas si la fiche existe). Lecture seule hors îlots (jeton, révocation, validation).
 * Les contenus chiffrés sont lus par `dechiffrerParole` ; rien n'est journalisé.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PanneauAudit } from "@/components/admin/audit-terrain/PanneauAudit";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { gardeLectureEchanges } from "@/features/dossier-client/acces";
import { prisma } from "@/lib/prisma";
import { journaliserConsultation } from "@/server/audit-terrain/consultation";
import { lireEcranAudit } from "@/server/audit-terrain/lecture";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Audit | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AuditPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  // 🔴 Première instruction : la garde, AVANT toute lecture.
  const acces = await gardeLectureEchanges(`/${locale}/${adminPrefix}/login`);
  const clientsBase = `/${locale}/${adminPrefix}/qualiopi/clients`;
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={clientsBase} />;
  if (acces.role !== "super_admin") {
    return (
      <AccesRefuse
        motif="L'écran Audit est réservé au super administrateur : il contient la parole des collaborateurs."
        retourHref={clientsBase}
      />
    );
  }
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;

  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, raisonSociale: true },
  });
  if (client === null) notFound();
  const ficheHref = `${clientsBase}/${client.id}`;

  let ecran: Awaited<ReturnType<typeof lireEcranAudit>> | null = null;
  try {
    const lu = await lireEcranAudit(client.id, typeof sp.s === "string" ? sp.s : undefined);
    // Chaque consultation est journalisée AVANT affichage (sans contenu) ; si le journal échoue, on n'affiche rien.
    await journaliserConsultation(client.id, lu.courante?.id ?? null);
    ecran = lu;
  } catch {
    ecran = null; // jamais de message technique (il pourrait citer une valeur) : écran d'erreur sobre
  }

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={`/${locale}/${adminPrefix}/qualiopi/clients/${id}`}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← {client.raisonSociale}
        </Link>
      </div>
      <AdminPageHeader title="Audit présentiel" />
      {ecran === null ? (
        <p role="alert" className="text-[color:var(--color-admin-error)]">
          Lecture de l&apos;audit impossible pour le moment. Rien n&apos;est perdu : l&apos;outil du
          PC garde ses copies. Réessayez dans un instant.
        </p>
      ) : (
        <PanneauAudit
          clientId={client.id}
          ecran={ecran}
          ficheHref={ficheHref}
          maintenant={new Date()}
        />
      )}
    </AdminPageShell>
  );
}
