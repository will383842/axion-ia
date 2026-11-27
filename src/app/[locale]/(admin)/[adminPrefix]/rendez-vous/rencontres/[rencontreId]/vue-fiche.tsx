/**
 * Fiche d'une rencontre — pièces de PRÉSENTATION (refonte visuelle).
 *
 * Composants serveur purs : aucune requête, aucun état, aucun gestionnaire.
 * Ils reçoivent des données déjà lues par `page.tsx` et ne font que les montrer :
 * tuiles de chiffres clés, cartes à bordure colorée, encadrés teintés.
 * Jetons de `admin.css` uniquement.
 */

import {
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  FileCheck2,
  History,
  ListChecks,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";

export type TonCarte = "success" | "warning" | "info" | "neutral" | "destructive";

const BORDURE_GAUCHE: Readonly<Record<TonCarte, string>> = {
  success: "border-l-[color:var(--color-admin-success)]",
  warning: "border-l-[color:var(--color-admin-warning)]",
  info: "border-l-[color:var(--color-admin-info)]",
  neutral: "border-l-[color:var(--color-admin-border-strong)]",
  destructive: "border-l-[color:var(--color-admin-destructive)]",
};

const FOND_ENCART: Readonly<Record<TonCarte, string>> = {
  success: "bg-[color:var(--color-admin-success-soft)] border-l-[color:var(--color-admin-success)]",
  warning: "bg-[color:var(--color-admin-warning-soft)] border-l-[color:var(--color-admin-warning)]",
  info: "bg-[color:var(--color-admin-info-soft)] border-l-[color:var(--color-admin-info)]",
  neutral:
    "bg-[color:var(--color-admin-neutral-soft)] border-l-[color:var(--color-admin-border-strong)]",
  destructive:
    "bg-[color:var(--color-admin-destructive-soft)] border-l-[color:var(--color-admin-destructive)]",
};

/** Encadré teinté lisible : alertes, motifs, remarques. */
export function EncartTeinte({
  ton,
  role,
  children,
}: {
  ton: TonCarte;
  role?: "status" | "alert";
  children: ReactNode;
}) {
  return (
    <div
      {...(role ? { role } : {})}
      data-encart={ton}
      className={`rounded-[var(--radius-admin-sm)] border-l-4 px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg)] ${FOND_ENCART[ton]}`}
    >
      {children}
    </div>
  );
}

export interface DonneesTuiles {
  readonly compteRenduValide: boolean;
  readonly nbFaits: number;
  readonly nbVersions: number;
  readonly suiteFaite: boolean;
}

/** Chiffres clés, calculés sur les données déjà chargées. */
export function TuilesRencontre({ d }: { d: DonneesTuiles }) {
  return (
    <div
      data-tuiles="rencontre"
      className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2 lg:grid-cols-4"
    >
      <AdminStatCard
        label="Compte rendu"
        value={d.compteRenduValide ? "Validé" : "À écrire"}
        tone={d.compteRenduValide ? "success" : "warning"}
        icon={FileCheck2}
      />
      <AdminStatCard
        label="Faits retenus"
        value={d.nbFaits}
        tone={d.nbFaits > 0 ? "info" : "default"}
        icon={ListChecks}
      />
      <AdminStatCard
        label="Versions du compte rendu"
        value={d.nbVersions}
        tone="default"
        icon={History}
      />
      <AdminStatCard
        label="Suite"
        value={d.suiteFaite ? "Faite" : "À faire"}
        tone={d.suiteFaite ? "success" : "warning"}
        icon={CalendarClock}
      />
    </div>
  );
}

/** Une carte (fait retenu, ligne de version, suite) à bordure gauche colorée. */
export function CarteLigne({
  ton,
  pastille,
  titre,
  children,
}: {
  ton: TonCarte;
  pastille?: ReactNode;
  titre: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li
      data-carte={ton}
      className={`rounded-[var(--radius-admin-md)] border border-l-4 border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)] ${BORDURE_GAUCHE[ton]}`}
    >
      <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
        {pastille}
        <span className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          {titre}
        </span>
      </div>
      {children ? (
        <div className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] whitespace-pre-line text-[color:var(--color-admin-fg-soft)]">
          {children}
        </div>
      ) : null}
    </li>
  );
}

/** Pastille d'état LARGE avec icône. */
export function PastilleEtat({
  ton,
  valide,
  children,
}: {
  ton: TonCarte;
  valide: boolean;
  children: ReactNode;
}) {
  const Icone = valide ? CheckCircle2 : CircleDashed;
  return (
    <AdminBadge tone={ton === "neutral" ? "neutral" : ton} plein compact={false}>
      <span className="inline-flex items-center gap-[var(--space-admin-2)]">
        <Icone aria-hidden="true" size={16} data-icone="etat" />
        {children}
      </span>
    </AdminBadge>
  );
}

/**
 * Phrases sous le compte rendu : où trouver celui de l'enregistrement, et le lien
 * « E-mail de suivi au client » avec sa phrase, toujours VISIBLE (l'e-mail part chez
 * un vrai client : rien n'est replié).
 */
export function NotesEnregistrementEtSuite({
  hrefEmailSuivi,
  enregistrementAbsent,
}: {
  hrefEmailSuivi: string;
  enregistrementAbsent: boolean;
}) {
  return (
    <>
      <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {enregistrementAbsent
          ? "Aucun enregistrement de ce rendez-vous n'a encore donné de compte rendu."
          : "Le compte rendu de l'enregistrement est plus bas sur cette page."}
      </p>
      <p className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
        <Link
          href={hrefEmailSuivi}
          className="inline-flex min-h-[44px] items-center font-semibold text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          E-mail de suivi au client
        </Link>
      </p>
      <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Il est préparé depuis les faits validés et attend votre validation avant de partir.
      </p>
    </>
  );
}
