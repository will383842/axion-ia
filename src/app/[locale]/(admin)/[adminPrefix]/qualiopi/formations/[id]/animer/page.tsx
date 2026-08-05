/**
 * Admin — Qualiopi · « Tout pour animer » d&apos;une formation.
 *
 * Rassemble sur UN écran ce qu&apos;il faut pour animer la formation :
 *   - « Projeté en salle » : le kit UPLOADÉ de la bibliothèque (slot diaporama
 *     .pptx + scénario pédagogique), avec état déposé/manquant ;
 *   - « Pour le formateur » / « Pour les stagiaires » : les supports PDF
 *     GÉNÉRÉS (SupportFormation), avec en regard l&apos;équivalent du kit quand
 *     il existe (SUPPORT_TYPE_TO_SLOT).
 *
 * ⚠️ La jointure Formation ↔ kit n&apos;existe que par convention
 * (`Formation.slug === interventionSlug`), résolue STRICTEMENT par
 * vente/kit-formation.ts. Pas de kit résolvable (sur-mesure, dupliquée) →
 * encart explicite, jamais une section vide.
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, MonitorPlay, GraduationCap, Users } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { getFormationById } from "@/server/qualiopi/formations/formations";
import { SUPPORT_TYPE_LABELS } from "@/server/qualiopi/supports/support-builder";
import {
  resolveInterventionSlugForFormation,
  SUPPORT_TYPE_TO_SLOT,
  SLOTS_PROJETES_EN_SALLE,
} from "@/server/qualiopi/vente/kit-formation";
import { getSlot } from "@/content/intervention-documents-catalog";
import type { SupportType } from "../../../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Tout pour animer | Axion-IA Admin",
  robots: { index: false, follow: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// Groupes d'affichage des supports générés (par destinataire)
// ─────────────────────────────────────────────────────────────────────────────

const TYPES_FORMATEUR: SupportType[] = ["slides_formateur", "guide_animation", "grille_eval"];
const TYPES_STAGIAIRES: SupportType[] = [
  "slides_stagiaire",
  "livret_stagiaire",
  "memo",
  "exercices",
];

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function QualiopiFormationAnimerPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;

  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const formation = await getFormationById(id);
  if (formation === null) {
    redirect(`/${locale}/${adminPrefix}/qualiopi/formations`);
  }

  const kitSlug = resolveInterventionSlugForFormation(formation);
  const kitHref =
    kitSlug !== null
      ? `/${locale}/${adminPrefix}/documents-interventions/formations/${kitSlug}`
      : `/${locale}/${adminPrefix}/documents-interventions`;

  // ── Dépôts du kit (bibliothèque) — « déposé » = version COURANTE publiée ───
  const slotsSuivis: string[] = [
    ...SLOTS_PROJETES_EN_SALLE,
    ...Object.values(SUPPORT_TYPE_TO_SLOT).filter((s): s is string => s !== null),
  ];
  // Slot déposé → date de sa version courante (publication, sinon création) :
  // l'ancienneté est affichée, et > 3 mois vaut « à revoir » (standard Will —
  // un diaporama projeté depuis un trimestre mérite une relecture).
  const slotsDeposes = new Map<string, Date | null>();
  if (kitSlug !== null) {
    try {
      const docs = await prisma.interventionDocument.findMany({
        where: {
          interventionSlug: kitSlug,
          slot: { in: slotsSuivis },
          currentVersionId: { not: null },
        },
        select: {
          slot: true,
          currentVersion: { select: { publishedAt: true, createdAt: true } },
        },
      });
      for (const d of docs) {
        slotsDeposes.set(d.slot, d.currentVersion?.publishedAt ?? d.currentVersion?.createdAt ?? null);
      }
    } catch {
      // stub-safe : stub Proxy → [] au build
    }
  }

  // ── Supports générés (SupportFormation) ────────────────────────────────────
  let supports: Array<{
    id: string;
    type: SupportType;
    titre: string;
    version: number;
    pdfUrl: string | null;
  }> = [];
  try {
    supports = await prisma.supportFormation.findMany({
      where: { formationId: id },
      orderBy: { type: "asc" },
      select: { id: true, type: true, titre: true, version: true, pdfUrl: true },
    });
  } catch {
    // stub-safe : stub Proxy → [] au build
  }
  const supportByType = new Map(supports.map((s) => [s.type, s]));

  const formationBase = `/${locale}/${adminPrefix}/qualiopi/formations/${id}`;

  const sectionHeadCls =
    "flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)] mb-[var(--space-admin-3)]";
  const cardCls =
    "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]";
  const mutedCls = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";

  // Badge d'état d'un dépôt de kit (icône lucide, jamais d'emoji).
  // `deposeLe` : la date rend l'ancienneté LISIBLE, et > 3 mois ajoute
  // « à revoir » — sans date on affichait un « Déposé » éternellement vert.
  function EtatDepot({ depose, deposeLe }: { depose: boolean; deposeLe?: Date | null }) {
    if (!depose) {
      return (
        <span className="inline-flex items-center gap-1 text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-warning)]">
          <AlertTriangle aria-hidden className="h-3.5 w-3.5" /> Manquant
        </span>
      );
    }
    const aRevoir = deposeLe != null && new Date().getTime() - deposeLe.getTime() > 92 * 86_400_000;
    return (
      <>
        <span className="inline-flex items-center gap-1 text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-success)]">
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" /> Déposé
          {deposeLe != null ? ` le ${deposeLe.toLocaleDateString("fr-FR")}` : ""}
        </span>
        {aRevoir ? (
          <span className="ml-1 inline-flex items-center gap-1 text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-warning)]">
            <AlertTriangle aria-hidden className="h-3.5 w-3.5" /> à revoir (+3 mois)
          </span>
        ) : null}
      </>
    );
  }

  // Ligne d'un support généré + son équivalent uploadé du kit (même usage).
  function LigneSupport({ type }: { type: SupportType }) {
    const support = supportByType.get(type);
    const slotEquivalent = SUPPORT_TYPE_TO_SLOT[type];
    const slotMeta = slotEquivalent !== null ? getSlot("formation", slotEquivalent) : undefined;
    return (
      <li className="flex flex-wrap items-center justify-between gap-[var(--space-admin-3)] border-b border-[color:var(--color-admin-border)] py-[var(--space-admin-3)] last:border-b-0">
        <div>
          <p className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]">
            {SUPPORT_TYPE_LABELS[type]}
          </p>
          {support != null ? (
            <p className={mutedCls}>
              {support.titre} · v{support.version}
            </p>
          ) : (
            <p className={mutedCls}>Non généré</p>
          )}
          {kitSlug !== null && slotMeta !== undefined && (
            <p className={`${mutedCls} mt-0.5`}>
              Kit bibliothèque — {slotMeta.titre} :{" "}
              <EtatDepot
                depose={slotsDeposes.has(slotMeta.key)}
                deposeLe={slotsDeposes.get(slotMeta.key) ?? null}
              />
            </p>
          )}
        </div>
        <div className="flex items-center gap-[var(--space-admin-3)]">
          {support?.pdfUrl != null ? (
            /* `pdfUrl` = témoin d'upload R2 (URL pré-signée périmée) : la route
               re-signe à la demande depuis `pdfKey`. */
            <a
              href={`/api/qualiopi/supports/${support.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-button-ghost"
            >
              Télécharger
            </a>
          ) : (
            <span className={mutedCls}>—</span>
          )}
        </div>
      </li>
    );
  }

  return (
    <AdminPageShell width="wide">
      {/* Fil d'Ariane */}
      <div className="mb-[var(--space-admin-4)] flex items-center gap-[var(--space-admin-3)]">
        <Link
          href={formationBase}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Formation {formation.numero}
        </Link>
      </div>

      <AdminPageHeader
        title={`Tout pour animer — ${formation.titre}`}
        description="Le nécessaire de séance en un écran : le kit projeté en salle (bibliothèque) et les supports PDF générés, formateur et stagiaires."
      />

      {/* ── Projeté en salle ─────────────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>
          <MonitorPlay aria-hidden className="h-4 w-4" /> Projeté en salle
        </h2>

        {kitSlug === null ? (
          /* Fail-visible : pas de kit résolvable, on le DIT — jamais une
             section vide qui laisserait croire que tout est en ordre. */
          <div
            role="status"
            className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
          >
            <p className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
              Cette formation (adaptation ou sur-mesure) n&apos;a pas de kit dans la bibliothèque
            </p>
            <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              Son slug « {formation.slug} » ne correspond à aucune prestation du catalogue — la
              bibliothèque est jointe par convention de slug, il n&apos;y a rien à afficher ici.
              Déposez le diaporama et le déroulé depuis{" "}
              <Link
                href={kitHref}
                className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
              >
                Documents interventions
              </Link>
              , sur la prestation d&apos;origine ou une prestation dédiée.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
            {SLOTS_PROJETES_EN_SALLE.map((slotKey) => {
              const slot = getSlot("formation", slotKey);
              if (slot === undefined) return null;
              return (
                <div key={slotKey} className={cardCls}>
                  <div className="flex items-start justify-between gap-[var(--space-admin-3)]">
                    <div>
                      <p className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]">
                        {slot.titre}
                      </p>
                      {slot.note != null && <p className={`${mutedCls} mt-0.5`}>{slot.note}</p>}
                    </div>
                    <EtatDepot
                      depose={slotsDeposes.has(slotKey)}
                      deposeLe={slotsDeposes.get(slotKey) ?? null}
                    />
                  </div>
                  <div className="mt-[var(--space-admin-3)]">
                    <Link href={kitHref} className="admin-button-ghost">
                      {slotsDeposes.has(slotKey)
                        ? "Ouvrir dans la bibliothèque"
                        : "Déposer le fichier"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Pour le formateur ────────────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>
          <GraduationCap aria-hidden className="h-4 w-4" /> Pour le formateur
        </h2>
        <div className={cardCls}>
          <ul>
            {TYPES_FORMATEUR.map((type) => (
              <LigneSupport key={type} type={type} />
            ))}
          </ul>
        </div>
      </section>

      {/* ── Pour les stagiaires ──────────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>
          <Users aria-hidden className="h-4 w-4" /> Pour les stagiaires
        </h2>
        <div className={cardCls}>
          <ul>
            {TYPES_STAGIAIRES.map((type) => (
              <LigneSupport key={type} type={type} />
            ))}
          </ul>
        </div>
        <p className={`${mutedCls} mt-[var(--space-admin-3)]`}>
          Les supports non générés se créent depuis{" "}
          <Link
            href={`${formationBase}/supports`}
            className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
          >
            Supports pédagogiques
          </Link>{" "}
          (génération type par type ou tous d&apos;un coup).
        </p>
      </section>
    </AdminPageShell>
  );
}
