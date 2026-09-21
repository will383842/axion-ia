// Tableau de bord de pilotage — les candidats apporteurs qui attendent.
//
// ── Pourquoi une TUILE, et surtout pas une alerte ─────────────────────────
// 🔑 C'est la mesure qui a tranché, pas une préférence. Le 19/09, en
// production : 15 personnes en attente, la plus ancienne depuis 26 JOURS. Un
// seuil de quelques heures aurait sonné dès le premier jour et n'aurait plus
// jamais cessé — et une alerte qui sonne toujours ne dit plus rien. Le
// chiffre, lui, se lit d'un coup d'œil et ne réclame rien.
//
// ── Ce que l'écran dit quand il n'y a rien à dire ────────────────────────
// Il reste visible, et il le dit en vert. Une section qui disparaît quand tout
// va bien laisse le lecteur se demander si elle a disparu ou si elle est
// cassée — même parti pris que les alertes critiques, juste à côté.
//
// Le compte porte sur des PERSONNES, jamais sur des formulaires : la même
// personne en remplit souvent deux ou trois, et « 17 en attente » pour 12
// personnes est un chiffre faux mais plausible — la pire espèce.

import Link from "next/link";

import { AdminCard, AdminBadge } from "@/components/admin/ui";
import type { ApporteursEnAttente } from "@/server/admin/pilotage-dashboard";

interface Props {
  adminPrefix: string;
  apporteurs: ApporteursEnAttente;
}

/** « depuis 26 jours », « depuis hier », « aujourd'hui ». */
function depuis(jours: number): string {
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return "depuis hier";
  return `depuis ${jours} jours`;
}

/**
 * Le ton de l'attente.
 *
 * Trois paliers, sans seuil d'alerte : une semaine sans réponse est tenable,
 * un mois ne l'est plus. C'est une nuance de lecture, jamais un blocage.
 */
function ton(jours: number | null): "success" | "warning" | "destructive" {
  if (jours === null) return "success";
  if (jours >= 21) return "destructive";
  if (jours >= 7) return "warning";
  return "success";
}

export function ApporteursEnAttenteSection({ adminPrefix, apporteurs }: Props): React.ReactElement {
  const base = `/fr/${adminPrefix}`;
  const { personnes, plusAncienJours } = apporteurs;

  return (
    <AdminCard className="mb-[var(--space-admin-6)]">
      <div className="mb-[var(--space-admin-4)] flex items-center justify-between gap-[var(--space-admin-4)]">
        <h2 className="text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Apporteurs en attente
        </h2>
        {/* 🔑 Le lien porte le MEME filtre que le compte. Un chiffre d'accueil
            qu'on ne peut pas reproduire en ouvrant la liste apprend a se
            mefier des deux ecrans. */}
        <Link
          href={`${base}/contacts/commercial?replyStatus=unanswered`}
          className="admin-button-ghost"
        >
          Ouvrir la liste →
        </Link>
      </div>

      {personnes === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-success)]">
          Personne n&apos;attend de réponse.
        </p>
      ) : (
        <div className="flex flex-wrap items-baseline gap-[var(--space-admin-4)]">
          <span className="text-[length:var(--text-admin-2xl)] font-semibold text-[color:var(--color-admin-fg)]">
            {personnes}
          </span>
          <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            {personnes === 1 ? "personne attend une réponse" : "personnes attendent une réponse"}
          </span>
          {plusAncienJours !== null ? (
            <AdminBadge tone={ton(plusAncienJours)} dot>
              la plus ancienne {depuis(plusAncienJours)}
            </AdminBadge>
          ) : null}
        </div>
      )}
    </AdminCard>
  );
}
