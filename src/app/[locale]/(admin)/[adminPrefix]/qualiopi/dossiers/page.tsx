/**
 * Admin — Qualiopi · 📁 Dossiers (pipeline) — refonte console phase 2, 2026-08-01.
 *
 * Répond à la deuxième question du plan (« À traiter » répond à la première) :
 * « où en est chaque affaire ? ». Avant cette page, un client vivait dans six
 * onglets sans lien — devis ici, session là, facture ailleurs — et reconstituer
 * l'état d'une affaire demandait une tournée complète de la console.
 *
 * UNE ligne par affaire, rangée dans une colonne de pipeline qui suit le cycle
 * de vie : 📥 Devis en attente → ✍️ Signature en attente → 📅 À préparer →
 * ▶️ En cours → 🧾 À solder → ✅ Soldés (30 derniers jours, pour ne pas noyer).
 *
 * 🔴 Zéro logique propre : le statut est DÉRIVÉ par `lireDossiersPipeline()`
 * (cf. `src/server/admin/dossiers-pipeline.ts`, fonction pure + spec). Cette
 * page AFFICHE, elle ne décide rien — la règle « réalisée mais impayée n'est
 * pas soldée » vit dans le module et son spec, pas dans du JSX.
 *
 * Server Component — auth + redirect, force-dynamic, noindex (même idiome que
 * la page « À traiter » de la phase 1).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import {
  lireDossiersPipeline,
  COLONNES_PIPELINE,
  ACTIVITE_LABELS,
} from "@/server/admin/dossiers-pipeline";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Dossiers (pipeline) | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

/** Dates courtes FR — la machine est en UTC, une date de session s'affiche
 *  pareil à ±2 h près, pas besoin de fuseau explicite. */
const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

/** « 10 août 2026 → 11 août 2026 », ou une seule date, ou rien. */
function plage(dateDebut: Date | null, dateFin: Date | null): string | null {
  if (dateDebut && dateFin) {
    const debut = dateFmt.format(dateDebut);
    const fin = dateFmt.format(dateFin);
    return debut === fin ? debut : `${debut} → ${fin}`;
  }
  if (dateDebut) return dateFmt.format(dateDebut);
  if (dateFin) return dateFmt.format(dateFin);
  return null;
}

export default async function DossiersPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  // Même garde que le reste de la console Qualiopi (à-traiter, alertes, sessions).
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const base = `/${locale}/${adminPrefix}`;
  const pipeline = await lireDossiersPipeline();
  const totalAffaires = COLONNES_PIPELINE.reduce((n, c) => n + pipeline[c.id].length, 0);

  // Mêmes classes que la page « À traiter » — 100 % tokens admin, aucun hex.
  const carte =
    "mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]";
  const titreCarte =
    "mb-[var(--space-admin-3)] flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]";
  const pastille =
    "inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[color:var(--color-admin-error)] px-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-bold text-white";
  const ligne =
    "flex flex-wrap items-center justify-between gap-[var(--space-admin-2)] border-b border-[color:var(--color-admin-border)] py-[var(--space-admin-2)] last:border-b-0";
  const lien =
    "text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-accent)] hover:underline";
  const badge =
    "inline-flex items-center rounded-full border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="📁 Dossiers"
        description="Où en est chaque affaire ? Une ligne par dossier client, groupée par étape du pipeline — du devis envoyé au solde encaissé. Le statut est dérivé des données existantes : rien à tenir à jour."
      />

      {totalAffaires === 0 && (
        <div className={carte}>
          <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg)]">
            ✨ Aucune affaire dans le pipeline — pas de devis en attente, pas de session vivante,
            rien à solder.
          </p>
        </div>
      )}

      {COLONNES_PIPELINE.map((colonne) => {
        const lignes = pipeline[colonne.id];
        // Les colonnes vides sont masquées : afficher six cadres dont quatre
        // vides redonnerait exactement le bruit que la refonte veut supprimer.
        if (lignes.length === 0) return null;
        return (
          <div key={colonne.id} className={carte}>
            <h2 className={titreCarte}>
              {colonne.label} <span className={pastille}>{lignes.length}</span>
            </h2>
            <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              {colonne.description}
            </p>
            <ul>
              {lignes.map((l) => {
                const dates = plage(l.dateDebut, l.dateFin);
                return (
                  <li key={l.cle} className={ligne}>
                    <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                      <span className={badge}>{ACTIVITE_LABELS[l.activite]}</span>{" "}
                      <strong>{l.client}</strong> — {l.intitule}
                      {l.reference ? ` · ${l.reference}` : ""}
                      {dates ? ` · ${dates}` : ""}
                      <span className="block text-[color:var(--color-admin-fg-muted)]">
                        {l.prochaineAction}
                      </span>
                    </span>
                    <Link href={`${base}${l.cheminFiche}`} className={lien}>
                      Ouvrir →
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </AdminPageShell>
  );
}
