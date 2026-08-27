/**
 * Admin — relecture des sorties de démonstration d'une session.
 *
 * L'écran qui rend la validation honnête. Les fiches promettent au formateur
 * que « les sorties du kit ont été vérifiées » : cette page est l'endroit où
 * cette vérification a réellement lieu.
 *
 * Chaque sortie est affichée en entier, sous la demande qui l'a produite —
 * parce qu'on ne peut juger une réponse sans relire la question. On ne montre
 * ni score, ni résumé, ni indicateur de confiance : il n'y a rien à automatiser
 * ici, il faut lire.
 *
 * Server Component. Force-dynamic. Robots noindex (hérité de la coquille admin).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { prisma } from "@/lib/prisma";
import { lirePreparation, lireSortiesSession } from "@/server/qualiopi/kit-session/preparation";
import { PreparationKitSession } from "@/components/admin/qualiopi/PreparationKitSession";
import { genererSortiesAction, validerSortiesAction } from "@/server/actions/qualiopi/kit-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Relecture des sorties du kit",
  robots: { index: false, follow: false },
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}): Promise<React.ReactElement> {
  const { locale, adminPrefix, id } = await params;

  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const infos = await prisma.trainingSession.findUnique({
    where: { id },
    select: { titreSession: true, numero: true },
  });
  if (infos === null) notFound();

  const prep = await lirePreparation(id);
  const sorties = await lireSortiesSession(id);
  const base = `/${locale}/${adminPrefix}/qualiopi/sessions/${id}`;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={`Sorties de démonstration — ${infos.titreSession}`}
        description={`Session ${infos.numero}. Lisez chaque sortie sous la demande qui l'a produite : c'est ce que le formateur aura entre les mains si l'outil tombe en salle.`}
      />

      <Link
        href={base}
        className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline"
      >
        ← Retour à la session
      </Link>

      <div className="mt-[var(--space-admin-4)]">
        {prep !== null ? (
          <PreparationKitSession
            sessionId={id}
            etape={prep.etape}
            aFaire={prep.aFaire}
            nbSorties={prep.nbSorties}
            valideLe={prep.valideLe ? dateFmt.format(prep.valideLe) : null}
            hrefRelecture={`${base}/kit`}
            genererAction={genererSortiesAction}
            validerAction={validerSortiesAction}
          />
        ) : null}
      </div>

      <div className="mt-[var(--space-admin-5)] space-y-[var(--space-admin-5)]">
        {sorties.length === 0 ? (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Aucune sortie produite pour l&apos;instant.
          </p>
        ) : null}

        {sorties.map((s, i) => (
          <article
            key={`${s.moduleId}-${i}`}
            className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
          >
            <h2 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
              {s.moduleTitre}
            </h2>
            <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              Produite par {s.provider ?? "?"} · {s.model ?? "?"}. Ce n&apos;est pas une capture
              d&apos;écran : c&apos;est le texte de la réponse.
            </p>

            <h3 className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]">
              La demande
            </h3>
            <pre className="mt-[var(--space-admin-1)] overflow-x-auto rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-bg-subtle)] p-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] whitespace-pre-wrap text-[color:var(--color-admin-fg)]">
              {s.prompt}
            </pre>

            <h3 className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]">
              Ce que l&apos;outil a répondu
            </h3>
            <pre className="mt-[var(--space-admin-1)] overflow-x-auto rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] whitespace-pre-wrap text-[color:var(--color-admin-fg)]">
              {s.sortie}
            </pre>

            <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              À vérifier : la démonstration tient-elle ? Le défaut que vous vouliez montrer est-il
              bien là ? Si non, reproduisez — une démonstration qui rate en salle coûte plus cher
              qu&apos;une minute de génération.
            </p>
          </article>
        ))}
      </div>
    </AdminPageShell>
  );
}
