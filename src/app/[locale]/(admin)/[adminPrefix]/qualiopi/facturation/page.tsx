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
  // Lecture ouverte aussi à editor/reader (rôle « comptable » lecture seule —
  // C7 du plan). Les ACTIONS restent gardées par requireAdminWrite.
  const rolesAutorises = ["admin", "super_admin", "editor", "reader"];
  if (!userSession?.user || !rolesAutorises.includes(role ?? "")) {
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
  const now = new Date();
  const [factures, total, aggEmis, aggEncaisse, retards, ouvertes, dossiersEnCours] =
    await Promise.all([
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
      // Balance âgée : toutes les factures ouvertes (émise/partielle/retard)
      // avec leur échéance — buckets calculés côté serveur (volume TPE, trivial).
      prisma.factureFormation.findMany({
        where: {
          statut: { in: ["emise", "partiellement_payee", "en_retard"] },
          avoirDeId: null,
        },
        select: { montantTtcCents: true, montantHtCents: true, echeanceAt: true },
      }),
      prisma.dossierFinancement.findMany({
        where: { statut: { not: "clos" } },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          type: true,
          statut: true,
          financeurNom: true,
          numeroDossierExterne: true,
          montantDemandeCents: true,
          montantAccordeCents: true,
          subrogation: true,
          client: { select: { raisonSociale: true } },
          payeurs: { select: { id: true } },
        },
      }),
    ]);

  // Buckets d'ancienneté des créances ouvertes (0-30 / 31-60 / 60+ jours).
  const buckets = { courant: 0, b0_30: 0, b31_60: 0, b60plus: 0 };
  for (const f of ouvertes) {
    const montant = f.montantTtcCents ?? f.montantHtCents;
    if (f.echeanceAt === null || f.echeanceAt >= now) {
      buckets.courant += montant;
      continue;
    }
    const jours = Math.floor((now.getTime() - f.echeanceAt.getTime()) / 86_400_000);
    if (jours <= 30) buckets.b0_30 += montant;
    else if (jours <= 60) buckets.b31_60 += montant;
    else buckets.b60plus += montant;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const kpis = [
    { label: "Émis (TTC)", value: fmtEur(aggEmis._sum.montantTtcCents ?? 0) },
    { label: "Encaissé", value: fmtEur(aggEncaisse._sum.amountCents ?? 0) },
    {
      label: `En retard (${retards._count._all})`,
      value: fmtEur(retards._sum.montantTtcCents ?? 0),
    },
    { label: "À échoir", value: fmtEur(buckets.courant) },
    { label: "Retard 0-30 j", value: fmtEur(buckets.b0_30) },
    { label: "Retard 31-60 j", value: fmtEur(buckets.b31_60) },
    { label: "Retard 60 j +", value: fmtEur(buckets.b60plus) },
  ];

  const DOSSIER_STATUT_LABELS: Record<string, string> = {
    a_monter: "À monter",
    envoye: "Envoyé",
    accord_recu: "Accord reçu",
    refuse: "Refusé",
    facture: "Facturé",
    paiement_recu: "Paiement reçu",
  };
  const DOSSIER_TYPE_LABELS: Record<string, string> = {
    opco: "OPCO",
    france_travail: "France Travail",
    cpf: "CPF",
    mixte: "Mixte",
  };

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
            {dossiersEnCours.length > 0 ? (
              <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]">
                <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                  Dossiers de financement en cours
                </p>
                <ul className="space-y-[var(--space-admin-2)]">
                  {dossiersEnCours.map((d) => (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]"
                    >
                      <span className="font-semibold">
                        {DOSSIER_TYPE_LABELS[d.type] ?? d.type}
                        {d.subrogation ? " (subrogé)" : ""}
                      </span>
                      <span>{d.financeurNom ?? "Financeur à identifier"}</span>
                      <span className="text-[color:var(--color-admin-fg-muted)]">
                        {d.client?.raisonSociale ?? "—"}
                        {d.numeroDossierExterne ? ` · n° ${d.numeroDossierExterne}` : ""}
                        {` · ${d.payeurs.length} payeur(s)`}
                      </span>
                      <span>
                        {d.montantAccordeCents !== null
                          ? `accordé ${fmtEur(d.montantAccordeCents)}`
                          : d.montantDemandeCents !== null
                            ? `demandé ${fmtEur(d.montantDemandeCents)}`
                            : ""}
                      </span>
                      <span className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] text-[length:var(--text-admin-xs)]">
                        {DOSSIER_STATUT_LABELS[d.statut] ?? d.statut}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
