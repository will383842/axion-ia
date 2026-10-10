/**
 * Admin — Conformité RGPD · fiche d'une activité du registre : tous ses champs, puis
 * ses points à corriger. Lecture seule ; le registre se met à jour par import.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import {
  CarteEcart,
  PastilleEtat,
  TIRET,
  texteOuTiret,
} from "@/components/admin/conformite-rgpd/blocs";
import { lireRegistre } from "@/features/conformite-rgpd/stockage";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Conformité RGPD — fiche | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

function Champ({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-[var(--space-admin-1)] border-b border-[color:var(--color-admin-border)] py-[var(--space-admin-3)] last:border-b-0 md:grid-cols-[14rem_1fr]">
      <dt className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {libelle}
      </dt>
      <dd className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
        {children}
      </dd>
    </div>
  );
}

export default async function FicheTraitementPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  }
  const base = `/fr/${adminPrefix}/conformite-rgpd`;
  const lecture = await lireRegistre();
  if (lecture.etat !== "ok") notFound();
  const t = lecture.registre.traitements.find((x) => x.id === id);
  if (!t) notFound();

  return (
    <AdminPageShell width="wide">
      <div className="flex flex-col gap-[var(--space-admin-5)]">
        <AdminPageHeader
          title={t.nom}
          breadcrumbs={
            <Link href={base} className="underline-offset-2 hover:underline">
              ← Conformité RGPD
            </Link>
          }
          meta={<PastilleEtat traitement={t} />}
        />
        <dl className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-4)]">
          <Champ libelle="Personnes concernées">{texteOuTiret(t.personnes.join(", "))}</Champ>
          <Champ libelle="Données">{texteOuTiret(t.donnees.join(", "))}</Champ>
          <Champ libelle="Finalité">{texteOuTiret(t.finalite)}</Champ>
          <Champ libelle="Base légale">{texteOuTiret(t.baseLegale)}</Champ>
          <Champ libelle="Conservation annoncée">{texteOuTiret(t.conservationAnnoncee)}</Champ>
          <Champ libelle="Conservation réelle">{texteOuTiret(t.conservationReelle)}</Champ>
          <Champ libelle="Destinataires">
            {t.destinataires.length === 0 ? (
              TIRET
            ) : (
              <ul className="flex flex-col gap-[var(--space-admin-1)]">
                {t.destinataires.map((d, i) => (
                  <li
                    key={`${d.nom}-${i}`}
                    className="flex flex-wrap items-center gap-[var(--space-admin-2)]"
                  >
                    <span>{d.nom}</span>
                    <span className="text-[color:var(--color-admin-fg-muted)]">
                      {texteOuTiret(d.pays)}
                    </span>
                    {d.horsUE === true ? <AdminBadge tone="warning">Hors UE</AdminBadge> : null}
                  </li>
                ))}
              </ul>
            )}
          </Champ>
          <Champ libelle="Sécurité">{texteOuTiret(t.securite)}</Champ>
          <Champ libelle="Droits des personnes">{texteOuTiret(t.droits)}</Champ>
        </dl>
        <h2 className="text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Points à corriger
        </h2>
        {t.ecarts.length === 0 ? (
          <AdminEmptyState variant="inline" title="Aucun point relevé." />
        ) : (
          <ul className="flex flex-col gap-[var(--space-admin-3)]">
            {t.ecarts.map((e, i) => (
              <CarteEcart key={`${e.code ?? "e"}-${i}`} ecart={e} />
            ))}
          </ul>
        )}
      </div>
    </AdminPageShell>
  );
}
