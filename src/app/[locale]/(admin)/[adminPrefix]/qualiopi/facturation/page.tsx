/**
 * Hub Facturation — vue unifiée des factures CRM des 5 activités
 * (formation, 1-to-1, audit, implémentation, site web augmenté).
 *
 * Gaté par `FACTURATION_HUB_ENABLED` (raw env, cf. qualiopi/config/flag.ts) :
 * notFound() tant que Will n'active pas le flag côté Coolify — rollout sans
 * risque, l'écran est livré éteint.
 *
 * KPIs (émis / encaissé / en retard) + filtres activité & statut. Le badge
 * « Chorus Pro » signale les clients secteur public (dépôt obligatoire).
 * Les devis restent sur l'écran Devis (CRM) ; les factures booking héritées
 * gardent leurs écrans dédiés — ce Hub est la vue de PILOTAGE transverse.
 */

import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFacturationHubEnabled } from "@/server/qualiopi/config/flag";
import { ACTIVITE_LABELS } from "@/server/qualiopi/financements/facture-libre-pur";
import { AdminFilterTabs } from "@/components/admin/ui";
import { AdminListScaffold } from "../../_v2/AdminListScaffold";
import type { AdminListScaffoldRow } from "../../_v2/AdminListScaffold";
import type {
  ActiviteFacturation,
  FactureFormationStatut,
  Prisma,
} from "../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Facturation (Hub) | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 25;

const STATUT_LABELS: Record<FactureFormationStatut, string> = {
  brouillon: "Brouillon",
  emise: "Émise",
  partiellement_payee: "Partiellement payée",
  en_retard: "En retard",
  payee: "Payée",
  annulee: "Annulée",
};

const STATUTS: ReadonlyArray<FactureFormationStatut> = [
  "brouillon",
  "emise",
  "partiellement_payee",
  "en_retard",
  "payee",
  "annulee",
];

const ACTIVITES: ReadonlyArray<ActiviteFacturation> = [
  "formation",
  "un_a_un",
  "audit",
  "implementation",
  "site_web",
];

function fmtEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function fmtDate(d: Date | null): string {
  return d ? d.toLocaleDateString("fr-FR") : "—";
}

function isStatut(v: string | undefined): v is FactureFormationStatut {
  return v !== undefined && (STATUTS as readonly string[]).includes(v);
}

function isActivite(v: string | undefined): v is ActiviteFacturation {
  return v !== undefined && (ACTIVITES as readonly string[]).includes(v);
}

export default async function FacturationHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isFacturationHubEnabled()) notFound();
  const { locale, adminPrefix } = await params;
  const userSession = await auth();
  const role = userSession?.user?.role;
  if (!userSession?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const sp = await searchParams;

  const statutParam = typeof sp["statut"] === "string" ? sp["statut"] : undefined;
  const activiteParam = typeof sp["activite"] === "string" ? sp["activite"] : undefined;
  const pageParam = typeof sp["page"] === "string" ? Number.parseInt(sp["page"], 10) : 1;
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1;

  const where: Prisma.FactureFormationWhereInput = {
    ...(isStatut(statutParam) ? { statut: statutParam } : {}),
    ...(isActivite(activiteParam) ? { activite: activiteParam } : {}),
  };

  const base = `/${adminPrefix}/qualiopi/facturation`;
  const hrefWith = (patch: Record<string, string | undefined>): string => {
    const params2 = new URLSearchParams();
    const merged = { statut: statutParam, activite: activiteParam, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params2.set(k, v);
    const qs = params2.toString();
    return qs ? `${base}?${qs}` : base;
  };

  // Requêtes en parallèle : page courante + total + KPIs transverses (hors filtre).
  const [factures, total, aggEmis, aggEncaisse, retards] = await Promise.all([
    prisma.factureFormation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        numero: true,
        activite: true,
        statut: true,
        destinataireNom: true,
        refClient: true,
        montantHtCents: true,
        montantTtcCents: true,
        emiseAt: true,
        echeanceAt: true,
        avoirDeId: true,
        client: { select: { estPublic: true } },
      },
    }),
    prisma.factureFormation.count({ where }),
    prisma.factureFormation.aggregate({
      where: { statut: { in: ["emise", "partiellement_payee", "en_retard", "payee"] } },
      _sum: { montantTtcCents: true },
    }),
    prisma.payment.aggregate({
      where: { factureFormationId: { not: null }, status: "succeeded" },
      _sum: { amountCents: true },
    }),
    prisma.factureFormation.aggregate({
      where: { statut: "en_retard" },
      _sum: { montantTtcCents: true },
      _count: { _all: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const kpis = [
    { label: "Émis (TTC)", value: fmtEur(aggEmis._sum.montantTtcCents ?? 0) },
    { label: "Encaissé", value: fmtEur(aggEncaisse._sum.amountCents ?? 0) },
    {
      label: `En retard (${retards._count._all})`,
      value: fmtEur(retards._sum.montantTtcCents ?? 0),
    },
  ];

  const rows: AdminListScaffoldRow[] = factures.map((f) => ({
    id: f.id,
    cells: [
      <span key="num" className="font-mono text-[length:var(--text-admin-xs)]">
        {f.numero}
        {f.avoirDeId !== null ? " (avoir)" : ""}
      </span>,
      f.activite !== null ? ACTIVITE_LABELS[f.activite] : "—",
      <span key="client">
        {f.destinataireNom}
        {f.client?.estPublic === true ? (
          <span
            className="ml-[var(--space-admin-2)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
            title="Client secteur public — dépôt Chorus Pro obligatoire"
          >
            Chorus Pro
          </span>
        ) : null}
      </span>,
      f.refClient ?? "—",
      fmtEur(f.montantTtcCents ?? f.montantHtCents),
      STATUT_LABELS[f.statut],
      fmtDate(f.emiseAt),
      fmtDate(f.echeanceAt),
    ],
  }));

  return (
    <>
      <AdminListScaffold
        title="Facturation (Hub)"
        itemLabel="facture(s)"
        total={total}
        page={page}
        totalPages={totalPages}
        filters={
          <div className="space-y-[var(--space-admin-4)]">
            <div className="flex flex-wrap items-center gap-[var(--space-admin-4)]">
              {kpis.map((k) => (
                <div
                  key={k.label}
                  className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-4)] py-[var(--space-admin-3)]"
                >
                  <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                    {k.label}
                  </p>
                  <p className="text-[length:var(--text-admin-lg)] font-semibold">{k.value}</p>
                </div>
              ))}
              <Link href={`/${adminPrefix}/qualiopi/devis/new`} className="admin-button">
                + Nouveau devis
              </Link>
            </div>
            <AdminFilterTabs
              label="Activité"
              current={isActivite(activiteParam) ? activiteParam : ""}
              options={[
                { value: "", label: "Toutes", href: hrefWith({ activite: undefined }) },
                ...ACTIVITES.map((a) => ({
                  value: a,
                  label: ACTIVITE_LABELS[a],
                  href: hrefWith({ activite: a }),
                })),
              ]}
            />
            <AdminFilterTabs
              label="Statut"
              current={isStatut(statutParam) ? statutParam : ""}
              options={[
                { value: "", label: "Tous", href: hrefWith({ statut: undefined }) },
                ...STATUTS.map((s) => ({
                  value: s,
                  label: STATUT_LABELS[s],
                  href: hrefWith({ statut: s }),
                })),
              ]}
            />
          </div>
        }
        columnHeaders={[
          "Numéro",
          "Activité",
          "Client",
          "Réf. commande",
          "Montant TTC",
          "Statut",
          "Émise",
          "Échéance",
        ]}
        rows={rows}
        emptyTitle="Aucune facture"
        emptyDescription="Créer un devis puis le facturer, ou émettre une facture libre."
        paginationBaseHref={base}
        paginationPreservedParams={{ statut: statutParam, activite: activiteParam }}
      />
    </>
  );
}
